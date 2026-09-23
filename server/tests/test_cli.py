"""Tests for the Phase 1 CLI surface.

These use temporary directories and never touch real user data. They cover the
argument contract as well as behavior: an agent that writes `--root` after the
subcommand must not fail, because a global-only option is parsed before the
subcommand only.
"""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_DIR))

from server.pitmry.cli import main  # noqa: E402


class CliTestCase(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)

    def run_cli(self, *argv):
        """Run the CLI in-process and capture its exit code."""
        import io
        from contextlib import redirect_stdout, redirect_stderr

        out, err = io.StringIO(), io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            code = main(list(argv))
        return code, out.getvalue(), err.getvalue()


class InitCommandTests(CliTestCase):
    def test_init_reports_the_paths_it_created(self):
        code, out, _ = self.run_cli("init", "--root", str(self.root), "--name", "demo")
        self.assertEqual(code, 0)
        self.assertIn("demo", out)
        self.assertTrue((self.root / ".pitmry" / "manifest.json").is_file())
        self.assertTrue((self.root / ".pitmry" / "records").is_dir())

    def test_init_json_is_machine_readable(self):
        code, out, _ = self.run_cli("init", "--root", str(self.root), "--json")
        self.assertEqual(code, 0)
        manifest = json.loads(out)
        self.assertTrue(manifest["project_id"].startswith("prj_"))
        self.assertEqual(manifest["schema_version"], 1)


class ValidateCommandTests(CliTestCase):
    def test_validate_on_a_fresh_project_passes(self):
        self.run_cli("init", "--root", str(self.root))
        code, out, _ = self.run_cli("validate", "--root", str(self.root))
        self.assertEqual(code, 0)
        self.assertIn("valid", out)

    def test_validate_on_an_uninitialized_project_fails_loudly(self):
        code, _, err = self.run_cli("validate", "--root", str(self.root))
        self.assertEqual(code, 2)
        self.assertIn("init", err)

    def test_validate_reports_a_malformed_record_with_exit_1(self):
        self.run_cli("init", "--root", str(self.root))
        (self.root / ".pitmry" / "records" / "dec_broken.json").write_text(
            '{"schema_version": 1, "id": "dec_broken"}', encoding="utf-8"
        )
        # The report goes to stdout so a human can read it. Stderr carries
        # only genuine failures such as an uninitialized project.
        code, out, _ = self.run_cli("validate", "--root", str(self.root))
        self.assertEqual(code, 1)
        self.assertIn("dec_broken.json", out)
        self.assertIn("missing required fields", out)

    def test_validate_json_returns_the_problem_list(self):
        self.run_cli("init", "--root", str(self.root))
        (self.root / ".pitmry" / "records" / "dec_broken.json").write_text(
            '{"schema_version": 1, "id": "dec_broken"}', encoding="utf-8"
        )
        code, out, _ = self.run_cli("validate", "--root", str(self.root), "--json")
        self.assertEqual(code, 1)
        payload = json.loads(out)
        self.assertFalse(payload["valid"])
        self.assertTrue(payload["problems"])

    def test_validate_reports_a_malformed_manifest_without_traceback(self):
        self.run_cli("init", "--root", str(self.root))
        manifest_path = self.root / ".pitmry" / "manifest.json"
        manifest_path.write_text('{"schema_version":2}', encoding="utf-8")
        code, out, err = self.run_cli("validate", "--root", str(self.root))
        self.assertEqual(code, 1)
        self.assertIn("schema_version", out)
        self.assertEqual(err, "")


class GetCommandTests(CliTestCase):
    def test_get_returns_exit_1_for_an_unknown_record(self):
        self.run_cli("init", "--root", str(self.root))
        code, _, err = self.run_cli("get", "dec_" + "0" * 24, "--root", str(self.root))
        self.assertEqual(code, 1)
        self.assertIn("not found", err)

    def test_get_prints_a_written_record(self):
        # Write through the store so the test does not depend on CLI writes.
        from server.pitmry.canonical_store import CanonicalStore
        from server.tests.test_canonical_store_helpers import make_decision

        store = CanonicalStore(self.root)
        store.init_project(name="demo")
        record = make_decision(project_id=store.project_id)
        store.write(record)

        code, out, _ = self.run_cli("get", record.id, "--root", str(self.root))
        self.assertEqual(code, 0)
        self.assertIn(record.id, out)
        self.assertIn("Use Sanity", out)

    def test_get_json_round_trips_the_record(self):
        from server.pitmry.canonical_store import CanonicalStore
        from server.pitmry.models import record_to_dict
        from server.tests.test_canonical_store_helpers import make_decision

        store = CanonicalStore(self.root)
        store.init_project(name="demo")
        record = make_decision(project_id=store.project_id)
        store.write(record)

        code, out, _ = self.run_cli("get", record.id, "--root", str(self.root), "--json")
        self.assertEqual(code, 0)
        payload = json.loads(out)
        stored = record_to_dict(store.get(record.id))
        self.assertEqual(payload["id"], stored["id"])
        self.assertEqual(payload["authority"], stored["authority"])
        self.assertEqual(payload["content"], stored["content"])

    def test_get_prints_relation_records(self):
        from server.pitmry.canonical_store import CanonicalStore
        from server.tests.test_canonical_store_helpers import make_decision, make_relation

        store = CanonicalStore(self.root)
        store.init_project(name="demo")
        old = make_decision(project_id=store.project_id, source_id="old")
        new = make_decision(project_id=store.project_id, source_id="new", title="New decision")
        relation = make_relation(store.project_id, new.id, old.id)
        store.write(old)
        store.write(new)
        store.write(relation)

        code, out, _ = self.run_cli("get", relation.id, "--root", str(self.root))
        self.assertEqual(code, 0)
        self.assertIn("relation     : supersedes (explicit)", out)
        self.assertIn(f"source       : {new.id}", out)
        self.assertIn(f"target       : {old.id}", out)


class ModuleEntryPointTests(CliTestCase):
    def test_python_dash_m_runs_the_cli(self):
        """The documented interface is `python -m server.pitmry <command>`.

        It runs from the repository root, because `server` resolves as a
        package relative to it. Running it from inside `server/` fails with
        ModuleNotFoundError, which is genuine misuse and not worth hiding.
        """
        repo_root = SERVER_DIR.parent
        proc = subprocess.run(
            [sys.executable, "-m", "server.pitmry", "validate",
             "--root", str(self.root)],
            cwd=str(repo_root), capture_output=True, text=True, timeout=60,
        )
        self.assertEqual(proc.returncode, 2)
        self.assertIn("init", proc.stderr)


if __name__ == "__main__":
    unittest.main()
