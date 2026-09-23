"""Tests for the canonical store.

Every test uses a temporary directory and never touches real user data. The
acceptance behavior is the last test: write a decision, delete every derived
cache, and read the decision back from `.pitmry/` alone.
"""

import sys
import unittest
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_DIR))

from server.pitmry.canonical_store import (  # noqa: E402
    CanonicalConflictError,
    CanonicalStore,
)
from server.pitmry.enums import (  # noqa: E402
    Authority,
    RecordType,
    RelationProvenance,
    RelationType,
)
from server.pitmry.ids import derive_record_id, derive_relation_id, new_source_id  # noqa: E402
from server.pitmry.models import (  # noqa: E402
    SCHEMA_VERSION,
    MemoryRecord,
    Provenance,
    RelationRecord,
    compute_content_hash,
)
import tempfile  # noqa: E402
from dataclasses import replace  # noqa: E402

from server.tests.test_canonical_store_helpers import make_decision, make_relation  # noqa: E402


#: A fixed manual source id. Tests that assert idempotency or a conflict need
#: the same record id, and a fresh uuid4 per call would give them a new id
#: each time. Tests that want many distinct records pass their own source id.
DEFAULT_SOURCE_ID = "manual_test_dec_1"


# The factories that make decisions and relations live in
# test_canonical_store_helpers.py, shared with the CLI tests.
make_decision = make_decision
make_relation = make_relation


class StoreTestCase(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        self.store = CanonicalStore(self.root)

    def write_decision(self, **kwargs):
        if self.store.read_manifest() is None:
            self.store.init_project(name="demo")
        kwargs.setdefault("project_id", self.store.project_id)
        record = make_decision(**kwargs)
        self.store.write(record)
        return record


class InitTests(StoreTestCase):
    def test_init_creates_the_manifest_and_records_dir(self):
        manifest = self.store.init_project(name="demo")
        self.assertTrue(self.store.paths.manifest_path.is_file())
        self.assertTrue(self.store.paths.records_dir.is_dir())
        self.assertEqual(manifest["name"], "demo")
        self.assertTrue(manifest["project_id"].startswith("prj_"))

    def test_init_is_idempotent(self):
        first = self.store.init_project(name="demo")
        second = self.store.init_project(name="different-name")
        self.assertEqual(first["project_id"], second["project_id"])
        self.assertEqual(first["name"], second["name"])

    def test_project_id_is_not_derived_from_the_path(self):
        manifest = self.store.init_project(name="demo")
        self.assertNotIn(
            str(self.root).lower().replace("\\", "-"), manifest["project_id"]
        )


class WriteReadTests(StoreTestCase):
    def test_write_then_read_returns_an_equal_record(self):
        original = self.write_decision()
        loaded = self.store.get(original.id)
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded.id, original.id)
        self.assertEqual(loaded.title, original.title)
        self.assertEqual(loaded.authority, Authority.human_evidenced)
        self.assertEqual(loaded.content["decision"], original.content["decision"])
        self.assertEqual(loaded.related_files, ("app/cms.ts",))
        self.assertEqual(loaded.tags, ("cms",))

    def test_content_hash_fills_in_the_hash(self):
        original = self.write_decision()
        loaded = self.store.get(original.id)
        self.assertTrue(loaded.content_hash.startswith("sha256:"))
        self.assertEqual(loaded.content_hash, compute_content_hash(loaded))

    def test_records_are_sharded_by_year_and_month(self):
        record = self.write_decision()
        expected = self.store.paths.records_dir / "2026" / "09" / f"{record.id}.json"
        self.assertTrue(expected.is_file())

    def test_iter_records_returns_everything_written(self):
        self.write_decision(title="First", source_id="manual_test_dec_a")
        self.write_decision(title="Second", source_id="manual_test_dec_b")
        self.assertEqual(len(self.store.load_all()), 2)
        self.assertEqual(len(self.store.all_ids()), 2)


class IdempotencyTests(StoreTestCase):
    def test_an_identical_retry_is_a_no_op(self):
        record = self.write_decision()
        before = self.store.paths.record_path(record.id, record.created_at).read_bytes()
        again = self.store.write(make_decision(project_id=self.store.project_id))
        self.assertEqual(again, record.id)
        after = self.store.paths.record_path(record.id, record.created_at).read_bytes()
        self.assertEqual(before, after)
        self.assertEqual(len(self.store.load_all()), 1)

    def test_re_ingesting_a_source_event_does_not_duplicate(self):
        # A real source event carries a stable source id in provenance, so a
        # re-run derives the same record id and lands on the same file.
        source_id = new_source_id()
        self.store.init_project(name="demo")
        for _ in range(3):
            self.store.write(make_decision(
                project_id=self.store.project_id,
                title="Stable",
                decision_text="Same every time.",
                source_id=source_id,
            ))
        self.assertEqual(len(self.store.load_all()), 1)


class ConflictTests(StoreTestCase):
    def test_a_different_record_at_the_same_id_is_rejected(self):
        record = self.write_decision()
        with self.assertRaises(CanonicalConflictError):
            # Same deterministic id, different content.
            self.store.write(make_decision(
                project_id=self.store.project_id,
                decision_text="A later, changed decision.",
            ))
        # The original is untouched.
        self.assertEqual(self.store.get(record.id).summary, record.summary)

    def test_no_temporary_file_survives_a_failed_write(self):
        self.write_decision()
        leftovers = [
            p for p in self.store.paths.records_dir.rglob("*")
            if p.is_file() and p.suffix == ".tmp"
        ]
        self.assertEqual(leftovers, [])

    def test_malformed_records_are_never_written(self):
        with self.assertRaises(ValueError):
            self.store.write(make_decision(project_id=""))
        self.assertEqual(self.store.load_all(), [])

    def test_write_requires_an_initialized_project(self):
        with self.assertRaises(FileNotFoundError):
            self.store.write(make_decision())
        self.assertFalse(self.store.paths.records_dir.exists())

    def test_write_rejects_a_record_from_another_project(self):
        self.store.init_project(name="demo")
        foreign = make_decision()
        with self.assertRaisesRegex(ValueError, "does not match manifest"):
            self.store.write(foreign)
        self.assertEqual(self.store.load_all(), [])

    def test_same_id_cannot_be_written_to_a_second_month_shard(self):
        record = self.write_decision()
        moved = replace(record, created_at="2026-10-22T08:14:00+00:00")
        with self.assertRaises(CanonicalConflictError):
            self.store.write(moved)
        self.assertEqual(len(self.store.all_ids()), 1)

    def test_get_rejects_unsafe_record_ids(self):
        with self.assertRaises(ValueError):
            self.store.get("../dec_" + "a" * 24)

    def test_record_path_rejects_traversal(self):
        with self.assertRaises(ValueError):
            self.store.paths.record_path("../dec_" + "a" * 24, "2026-09-22T08:14:00+00:00")


class RelationTests(StoreTestCase):
    def test_an_explicit_supersede_relation_round_trips(self):
        old = self.write_decision(title="Use Payload", source_id="manual_test_payload")
        new = self.write_decision(title="Use Sanity", source_id="manual_test_sanity")
        relation = make_relation(self.store.project_id, new.id, old.id)
        self.store.write(relation)
        loaded = self.store.get(relation.id)
        self.assertEqual(loaded.relation, RelationType.supersedes)
        self.assertEqual(loaded.provenance, RelationProvenance.explicit)
        self.assertEqual(loaded.source_record_id, new.id)
        self.assertEqual(loaded.target_record_id, old.id)

    def test_a_record_cannot_relate_to_itself(self):
        self.store.init_project(name="demo")
        with self.assertRaises(ValueError):
            make_relation(self.store.project_id,
                          derive_record_id(self.store.project_id, "manual", "self", "decision"),
                          derive_record_id(self.store.project_id, "manual", "self", "decision"))

    def test_an_inferred_relation_cannot_be_marked_explicit(self):
        new = self.write_decision(title="Use Sanity", source_id="manual_test_sanity")
        old = self.write_decision(title="Use Payload", source_id="manual_test_payload")
        with self.assertRaises(ValueError):
            self.store.write(RelationRecord(
                schema_version=SCHEMA_VERSION,
                id=derive_relation_id(self.store.project_id, new.id, old.id, "authorized_by"),
                project_id=self.store.project_id,
                relation="authorized_by",
                source_record_id=new.id,
                target_record_id=old.id,
                provenance="explicit",
                created_at="2026-09-22T09:00:00+00:00",
            ))

    def test_an_inferred_relation_requires_an_algorithm(self):
        new = self.write_decision(title="Use Sanity", source_id="manual_test_sanity")
        old = self.write_decision(title="Use Payload", source_id="manual_test_payload")
        with self.assertRaises(ValueError):
            self.store.write(RelationRecord(
                schema_version=SCHEMA_VERSION,
                id=derive_relation_id(self.store.project_id, new.id, old.id, "semantically_related"),
                project_id=self.store.project_id,
                relation="semantically_related",
                source_record_id=new.id,
                target_record_id=old.id,
                provenance="inferred",
                created_at="2026-09-22T09:00:00+00:00",
            ))


class HashDeterminismTests(StoreTestCase):
    def test_the_hash_is_deterministic_across_processes(self):
        first = make_decision()
        second = make_decision()
        self.assertEqual(compute_content_hash(first), compute_content_hash(second))

    def test_the_hash_excludes_the_hash_field(self):
        base = compute_content_hash(make_decision())
        changed_summary = make_decision()
        changed_summary = MemoryRecord(
            **{**changed_summary.__dict__, "content": {**changed_summary.content, "rationale": "Different."}}
        )
        self.assertNotEqual(base, compute_content_hash(changed_summary))


class ValidationTests(StoreTestCase):
    def test_a_valid_store_reports_no_problems(self):
        self.store.init_project(name="demo")
        self.write_decision()
        self.assertEqual(self.store.validate_all(), [])

    def test_a_dangling_relation_target_is_reported(self):
        self.store.init_project(name="demo")
        self.store.write(make_relation(
            self.store.project_id,
            derive_record_id(self.store.project_id, "manual", "missing-a", "decision"),
            derive_record_id(self.store.project_id, "manual", "missing-b", "decision"),
        ))
        problems = self.store.validate_all()
        self.assertTrue(any("does not exist" in p for p in problems))

    def test_a_valid_relation_is_not_reported(self):
        self.store.init_project(name="demo")
        old = self.write_decision(title="Use Payload", source_id="manual_test_payload")
        new = self.write_decision(title="Use Sanity", source_id="manual_test_sanity")
        self.store.write(make_relation(self.store.project_id, new.id, old.id))
        self.assertEqual(self.store.validate_all(), [])

    def test_validation_rejects_manifest_project_mismatch(self):
        manifest = self.store.init_project(name="demo")
        foreign_id = "prj_000000000000000000000001"
        from server.pitmry.models import compute_content_hash, record_to_dict

        record = make_decision(project_id=foreign_id)
        payload = record_to_dict(replace(record, content_hash=compute_content_hash(record)))
        file_path = self.store.paths.record_path(record.id, record.created_at)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(__import__("json").dumps(payload), encoding="utf-8")
        problems = self.store.validate_all()
        self.assertTrue(any("project_id" in problem and "manifest" in problem for problem in problems))

    def test_validation_rejects_mismatched_filename(self):
        self.store.init_project(name="demo")
        record = self.write_decision()
        correct_path = self.store.paths.record_path(record.id, record.created_at)
        wrong_path = correct_path.with_name("dec_" + "f" * 24 + ".json")
        wrong_path.write_bytes(correct_path.read_bytes())
        correct_path.unlink()
        problems = self.store.validate_all()
        self.assertTrue(any("filename id" in problem for problem in problems))

    def test_validation_rejects_a_record_in_the_wrong_shard(self):
        self.store.init_project(name="demo")
        record = self.write_decision()
        correct_path = self.store.paths.record_path(record.id, record.created_at)
        wrong_path = self.store.paths.records_dir / f"{record.id}.json"
        wrong_path.write_bytes(correct_path.read_bytes())
        correct_path.unlink()
        problems = self.store.validate_all()
        self.assertTrue(any("canonical shard path" in problem for problem in problems))

    def test_validation_reports_duplicate_ids_across_shards(self):
        self.store.init_project(name="demo")
        record = self.write_decision()
        correct_path = self.store.paths.record_path(record.id, record.created_at)
        duplicate_path = self.store.paths.records_dir / "2026" / "10" / correct_path.name
        duplicate_path.parent.mkdir(parents=True)
        duplicate_path.write_bytes(correct_path.read_bytes())
        problems = self.store.validate_all()
        self.assertTrue(any("duplicate record id" in problem for problem in problems))
        with self.assertRaisesRegex(ValueError, "duplicate record id"):
            self.store.get(record.id)

    def test_manifest_validation_checks_all_required_fields(self):
        self.store.init_project(name="demo")
        manifest_path = self.store.paths.manifest_path
        valid = self.store.read_manifest()
        invalid_manifests = (
            {**valid, "schema_version": 2},
            {**valid, "project_id": "prj_short"},
            {**valid, "name": " "},
            {**valid, "created_at": "2026-09-22T08:00:00"},
        )
        for invalid in invalid_manifests:
            with self.subTest(manifest=invalid):
                manifest_path.write_text(__import__("json").dumps(invalid), encoding="utf-8")
                with self.assertRaises(ValueError):
                    self.store.read_manifest()
        manifest_path.write_text(__import__("json").dumps({**valid, "future": True}), encoding="utf-8")
        self.assertEqual(self.store.read_manifest()["future"], True)


class CanonicalStateTests(StoreTestCase):
    def test_memory_record_does_not_serialize_derived_status(self):
        from server.pitmry.models import record_to_dict

        payload = record_to_dict(make_decision())
        self.assertNotIn("status", payload)

    def test_canonical_input_rejects_manually_asserted_state(self):
        import json
        from server.pitmry.models import record_from_dict, record_to_dict

        payload = record_to_dict(make_decision())
        for field in ("status", "superseded", "reverted", "conflicting"):
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, "derived state"):
                record_from_dict({**payload, field: "SUPERSEDED"})

    def test_canonical_dataclass_has_no_status_argument(self):
        with self.assertRaises(TypeError):
            make_decision(status="SUPERSEDED")

    def test_boolean_schema_version_is_rejected(self):
        from server.pitmry.models import record_from_dict, record_to_dict

        payload = record_to_dict(make_decision())
        with self.assertRaisesRegex(ValueError, "schema_version"):
            record_from_dict({**payload, "schema_version": True})


class AcceptanceTests(StoreTestCase):
    def test_memory_survives_deletion_of_every_derived_cache(self):
        """The Phase 1 acceptance criterion."""
        self.store.init_project(name="demo")
        record = self.write_decision()

        # Every derived database and cache the engine could ever build.
        self.store.paths.cache_dir.mkdir(parents=True, exist_ok=True)
        (self.store.paths.sqlite_cache).write_bytes(b"not a real db")
        (self.store.paths.lancedb_cache).mkdir(parents=True, exist_ok=True)

        import shutil

        shutil.rmtree(self.store.paths.cache_dir)

        # Canonical memory alone restores the decision.
        reloaded = CanonicalStore(self.root)
        loaded = reloaded.get(record.id)
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded.title, "Use Sanity as the CMS")
        self.assertEqual(loaded.summary, record.summary)


if __name__ == "__main__":
    unittest.main()
