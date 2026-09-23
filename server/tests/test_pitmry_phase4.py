"""Coverage for the Phase 4 agent and dashboard compatibility surfaces."""

import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_DIR))

from server.pitmry.canonical_store import CanonicalStore
from server.pitmry.capture import capture_decision, capture_relation
from server.pitmry.dashboard import feed, graph, journey, relations, summary
from server.pitmry.doctor import doctor
from server.pitmry.enums import RelationType


class Phase4TestCase(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.store = CanonicalStore(self.root)
        self.store.init_project(name="fixture")


class DoctorTests(Phase4TestCase):
    def test_missing_vectors_are_degraded_not_canonical_failure(self):
        report = doctor(self.root)
        self.assertEqual(report["status"], "degraded")
        self.assertEqual(report["canonical"], "healthy")
        self.assertEqual(report["vectors"], "unavailable")
        self.assertIn("VECTOR_RETRIEVAL_UNAVAILABLE", report["warnings"])


class DashboardProjectionTests(Phase4TestCase):
    def test_feed_uses_canonical_ids_authority_and_resolved_state(self):
        record = capture_decision(self.store, "Primary CMS", "Use Sanity",
                                  source_id="fixture:cms", subject_key="cms.primary")
        rows = feed(root=self.root)
        self.assertEqual(rows[0]["id"], record.id)
        self.assertIsNone(rows[0]["numeric_id"])
        self.assertEqual(rows[0]["canonical_type"], "decision")
        self.assertEqual(rows[0]["state"], "CURRENT")
        self.assertEqual(rows[0]["authority"], "agent_reported")

    def test_graph_and_relations_keep_explicit_and_inferred_distinct(self):
        old = capture_decision(self.store, "Old CMS", "Use Payload", source_id="old")
        new = capture_decision(self.store, "Current CMS", "Use Sanity", source_id="new")
        edge = capture_relation(self.store, new.id, old.id, RelationType.supersedes,
                                [{"record_id": new.id}])
        relation_result = relations(old.id, root=self.root)
        self.assertEqual(relation_result["explicit"][0]["id"], edge.id)
        self.assertTrue(all(item["provenance"] == "inferred"
                            for item in relation_result["inferred"]))
        graph_result = graph(self.root)
        explicit = [item for item in graph_result["edges"] if item["provenance"] == "explicit"]
        self.assertEqual(explicit[0]["type"], "supersedes")
        self.assertIn("explicit", explicit[0]["provenance"])

    def test_lineage_does_not_label_associations_as_causal(self):
        record = capture_decision(self.store, "A decision", "Keep local storage", source_id="local")
        result = journey(record.id, root=self.root)
        self.assertEqual(result["journey_chain"], [])
        self.assertEqual(result["related_records"], [])
        self.assertEqual(result["relations"], [])

    def test_limited_graph_does_not_emit_edges_to_hidden_nodes(self):
        earlier = capture_decision(self.store, "Earlier", "Choice one", source_id="earlier")
        later = capture_decision(self.store, "Later", "Choice two", source_id="later")
        capture_relation(self.store, later.id, earlier.id, RelationType.supersedes,
                         [{"record_id": later.id}])
        result = graph(self.root, limit=1)
        visible = {node["id"] for node in result["nodes"]}
        self.assertTrue(all(edge["source"] in visible and edge["target"] in visible
                            for edge in result["edges"]))

    def test_journey_does_not_invent_similarity_or_score(self):
        earlier = capture_decision(self.store, "Earlier", "Choice one", source_id="earlier")
        later = capture_decision(self.store, "Later", "Choice two", source_id="later")
        capture_relation(self.store, later.id, earlier.id, RelationType.supersedes,
                         [{"record_id": later.id}])
        result = journey(later.id, root=self.root)
        self.assertTrue(result["journey_chain"])
        self.assertNotIn("similarity", result["journey_chain"][0])
        self.assertNotIn("score", result["journey_chain"][0])

    def test_summary_counts_only_canonical_records(self):
        capture_decision(self.store, "A decision", "A choice", source_id="summary")
        result = summary(self.root)
        self.assertEqual(result["stats"]["total_adrs"], 1)
        self.assertEqual(result["stats"]["total_records"], 1)


class EvidenceAndCliTests(Phase4TestCase):
    def test_free_form_text_cannot_create_an_explicit_relation(self):
        older = capture_decision(self.store, "Older", "Old choice", source_id="older")
        newer = capture_decision(self.store, "Newer", "New choice", source_id="newer")
        with self.assertRaises(ValueError):
            capture_relation(self.store, newer.id, older.id, RelationType.supersedes,
                             ["a conversation someone mentioned"])

    def test_existing_canonical_record_can_support_explicit_relation(self):
        older = capture_decision(self.store, "Older", "Old choice", source_id="older")
        newer = capture_decision(self.store, "Newer", "New choice", source_id="newer")
        edge = capture_relation(self.store, newer.id, older.id, RelationType.supersedes,
                                [newer.id])
        self.assertEqual(edge.evidence_refs[0]["record_id"], newer.id)

    def test_decision_cli_does_not_allow_authority_spoofing(self):
        from server.pitmry.cli import main
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = main(["decision", "--root", str(self.root), "--title", "CLI choice",
                         "--decision", "Keep project-local memory"])
        self.assertEqual(code, 0)
        created = json.loads(out.getvalue())
        self.assertEqual(created["authority"], "agent_reported")
        self.assertNotIn("human_direct", out.getvalue())


class OptionalMcpTests(Phase4TestCase):
    def test_mcp_transport_is_optional_and_core_imports_without_sdk(self):
        from server.pitmry.mcp_server import INSTRUCTIONS, run
        self.assertIn("NO_MATCH", INSTRUCTIONS)
        try:
            import mcp  # noqa: F401
        except ImportError:
            with self.assertRaisesRegex(RuntimeError, "optional"):
                run(self.root)


if __name__ == "__main__":
    unittest.main()
