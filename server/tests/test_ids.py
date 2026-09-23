"""Tests for deterministic identity.

The point of these tests is that identity survives a rebuild. If two machines
run the same ingestion, they must land on the same record id, or a rebuilt
projection silently duplicates memory.
"""

import sys
import unittest
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_DIR))

from server.pitmry.ids import (  # noqa: E402
    TYPE_PREFIXES,
    derive_record_id,
    derive_relation_id,
    new_project_id,
    new_source_id,
    prefix_for_type,
    source_uuid,
    validate_project_id,
    validate_record_id,
)


class SourceIdentityTests(unittest.TestCase):
    def test_same_inputs_give_the_same_id(self):
        first = derive_record_id("prj_a", "grill_session", "grill_18", "decision")
        second = derive_record_id("prj_a", "grill_session", "grill_18", "decision")
        self.assertEqual(first, second)

    def test_a_different_source_gives_a_different_id(self):
        first = derive_record_id("prj_a", "grill_session", "grill_18", "decision")
        second = derive_record_id("prj_a", "grill_session", "grill_19", "decision")
        self.assertNotEqual(first, second)

    def test_a_different_project_gives_a_different_id(self):
        first = derive_record_id("prj_a", "grill_session", "grill_18", "decision")
        second = derive_record_id("prj_b", "grill_session", "grill_18", "decision")
        self.assertNotEqual(first, second)


class PrefixTests(unittest.TestCase):
    def test_every_record_type_has_a_prefix(self):
        self.assertEqual(
            sorted(TYPE_PREFIXES),
            sorted({
                "decision", "constraint", "git_change", "discussion",
                "observation", "failure", "checkpoint", "session_summary",
                "test_result", "deployment", "note", "relation",
            }),
        )

    def test_the_id_starts_with_the_type_prefix(self):
        self.assertTrue(
            derive_record_id("prj_a", "git_commit", "abc123", "git_change").startswith("git_")
        )
        self.assertTrue(
            derive_record_id("prj_a", "grill_session", "g1", "discussion").startswith("dis_")
        )
        self.assertTrue(
            derive_record_id("prj_a", "manual", "m1", "observation").startswith("obs_")
        )

    def test_an_unknown_type_is_rejected(self):
        with self.assertRaises(ValueError):
            prefix_for_type("banana")

    def test_prefix_accepts_an_enum_member(self):
        from server.pitmry.enums import RecordType

        self.assertEqual(prefix_for_type(RecordType.session_summary), "sum")


class ShapeTests(unittest.TestCase):
    def test_the_id_is_prefixed_and_24_hex_characters(self):
        record_id = derive_record_id("prj_a", "git_commit", "abc", "git_change")
        prefix, _, hex_part = record_id.partition("_")
        self.assertEqual(len(hex_part), 24)
        int(hex_part, 16)  # must be valid hex

    def test_a_relation_id_is_directional(self):
        forward = derive_relation_id("prj_a", "dec_1", "dec_2", "supersedes")
        backward = derive_relation_id("prj_a", "dec_2", "dec_1", "supersedes")
        self.assertNotEqual(forward, backward)
        self.assertTrue(forward.startswith("rel_"))


class ManualSourceIdTests(unittest.TestCase):
    def test_each_fresh_source_id_is_unique(self):
        ids = {new_source_id() for _ in range(200)}
        self.assertEqual(len(ids), 200)

    def test_reusing_the_stored_source_id_reproduces_the_record(self):
        stored = new_source_id()
        first = derive_record_id("prj_a", "manual", stored, "decision")
        second = derive_record_id("prj_a", "manual", stored, "decision")
        self.assertEqual(first, second)

    def test_blank_fields_are_rejected(self):
        for bad in ("", "   "):
            with self.assertRaises(ValueError):
                source_uuid("prj_a", bad, "x")
            with self.assertRaises(ValueError):
                source_uuid("prj_a", "grill_session", bad)


class ProjectIdTests(unittest.TestCase):
    def test_project_ids_are_unique_and_stable_in_shape(self):
        ids = {new_project_id() for _ in range(200)}
        self.assertEqual(len(ids), 200)
        for project_id in ids:
            self.assertTrue(project_id.startswith("prj_"))

    def test_project_id_is_not_derived_from_a_path(self):
        # Two different directories must be able to share a project identity.
        self.assertNotEqual(new_project_id(), new_project_id())

    def test_project_id_validation_rejects_malformed_values(self):
        for value in ("prj_short", "prj_" + "A" * 24, "../prj_" + "a" * 24, None):
            with self.subTest(value=value), self.assertRaises(ValueError):
                validate_project_id(value)


class CanonicalIdValidationTests(unittest.TestCase):
    def test_all_derived_ids_pass_validation(self):
        for record_type in TYPE_PREFIXES:
            record_id = derive_record_id("prj_a", "manual", record_type, record_type)
            self.assertEqual(validate_record_id(record_id, record_type), record_id)

    def test_invalid_and_unsafe_ids_are_rejected(self):
        values = (
            "dec_short",
            "dec_" + "A" * 24,
            "dec_" + "g" * 24,
            "../dec_" + "a" * 24,
            "C:\\dec_" + "a" * 24,
            "/dec_" + "a" * 24,
        )
        for value in values:
            with self.subTest(value=value), self.assertRaises(ValueError):
                validate_record_id(value)

    def test_record_type_must_match_id_prefix(self):
        with self.assertRaises(ValueError):
            validate_record_id("dec_" + "a" * 24, "git_change")


if __name__ == "__main__":
    unittest.main()
