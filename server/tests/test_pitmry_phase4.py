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
from server.pitmry.dashboard import feed, graph, journey, relations, summary, workspace_summary, records_page, record_detail
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

    def test_workspace_metadata_uses_resolved_states_and_ignores_relation_rows(self):
        earlier = capture_decision(self.store, "Earlier", "First choice", source_id="earlier")
        later = capture_decision(self.store, "Later", "Second choice", source_id="later")
        capture_relation(self.store, later.id, earlier.id, RelationType.supersedes,
                         [{"record_id": later.id}])
        result = workspace_summary(self.root)
        self.assertEqual(result["stats"]["total_records"], 2)
        self.assertEqual(result["current_decision_count"], 1)
        self.assertEqual(result["project_options"][0]["record_count"], 2)
        self.assertEqual(result["current_decisions"][0]["id"], later.id)

    def test_work_log_pages_all_records_without_repeating_rows(self):
        created = [capture_decision(self.store, f"Choice {index}", f"Use {index}",
                                    source_id=f"choice:{index}") for index in range(4)]
        first = records_page(limit=2, root=self.root)
        second = records_page(cursor=first["next_cursor"], limit=2, root=self.root)
        self.assertEqual(first["total"], 4)
        self.assertEqual(len(first["items"]), 2)
        self.assertEqual(len(second["items"]), 2)
        self.assertIsNone(second["next_cursor"])
        self.assertEqual({item["id"] for item in first["items"] + second["items"]},
                         {item.id for item in created})
        self.assertEqual(records_page(state="CURRENT", root=self.root)["total"], 4)

    def test_record_detail_keeps_evidence_separate_from_suggestions(self):
        old = capture_decision(self.store, "Old CMS", "Use Payload", source_id="old")
        new = capture_decision(self.store, "Current CMS", "Use Sanity", source_id="new")
        capture_relation(self.store, new.id, old.id, RelationType.supersedes, [new.id])
        result = record_detail(old.id, root=self.root)
        self.assertEqual(result["record"]["state"], "SUPERSEDED")
        self.assertEqual(result["explicit"][0]["id"], new.id)
        self.assertTrue(result["explicit"][0]["evidence_refs"])
        self.assertTrue(all(item["provenance"] == "inferred" for item in result["inferred"]))
        self.assertEqual(record_detail("dec_" + "0" * 24, root=self.root)["status"], "NO_MATCH")


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
