"""The compatibility exporter writes canonical records before projections."""

import tempfile
import subprocess
import unittest
from pathlib import Path

from server.pitmry.canonical_store import CanonicalStore
from server.scripts.export_session_to_memory import export_session


class ExporterTests(unittest.TestCase):
    def test_export_is_repeatable_and_only_creates_explicit_decisions(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            subprocess.run(["git", "-C", str(root), "init", "-q"], check=True)
            store = CanonicalStore(root)
            store.init_project(name="export-test")
            first = export_session(root=root, title="Session", summary="Captured work",
                                   source_id="fixed-session", no_vectors=True)
            second = export_session(root=root, title="Session", summary="Captured work",
                                    source_id="fixed-session", no_vectors=True)
            self.assertEqual(first["records"], second["records"])
            records = store.load_all()
            self.assertEqual(len(records), 1)
            self.assertEqual(records[0].type.value, "session_summary")
            self.assertFalse(any(record.type.value == "decision" for record in records))

    def test_export_adds_a_decision_only_when_supplied(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            subprocess.run(["git", "-C", str(root), "init", "-q"], check=True)
            store = CanonicalStore(root)
            store.init_project(name="export-test")
            result = export_session(root=root, title="Decision", summary="Summary",
                                    decision="Use canonical JSON", source_id="decision-session",
                                    no_vectors=True)
            records = store.load_all()
            self.assertEqual(len(records), 2)
            self.assertEqual(sum(record.type.value == "decision" for record in records), 1)
            self.assertEqual(len(result["records"]), 2)


if __name__ == "__main__":
    unittest.main()
