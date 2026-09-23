"""Phase 3 retrieval, state, and trust regressions."""

import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SERVER_DIR = Path(__file__).resolve().parents[1]
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

from server.pitmry.canonical_store import CanonicalStore  # noqa: E402
from server.pitmry.capture import capture_decision, capture_relation  # noqa: E402
from server.pitmry.context_service import context, lineage  # noqa: E402
from server.pitmry.enums import Authority, RecordType, RelationType, TruthDomain  # noqa: E402
from server.pitmry.ids import derive_record_id  # noqa: E402
from server.pitmry.models import MemoryRecord, Provenance, SCHEMA_VERSION  # noqa: E402
from server.pitmry.rebuild import rebuild  # noqa: E402
from server.pitmry.relations import relation_view  # noqa: E402
from server.pitmry.retrieval import classify_query, retrieve, sanitize_query  # noqa: E402
from server.pitmry.state_resolver import (CONFLICTING, CURRENT, REVERTED,
                                          SUPERSEDED, resolve_states)  # noqa: E402
from server.scripts.pitmry_retrieval_eval import (  # noqa: E402
    DEFAULT_GOLD, _evaluate_state_accuracy, load_gold,
)


class RetrievalTestCase(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.store = CanonicalStore(self.root)
        self.store.init_project(name="retrieval-test")

    def decision(self, key, value, source_id, created_at="2026-09-20T00:00:00+00:00"):
        record = capture_decision(self.store, value, value,
                                  context="project architecture decision",
                                  rationale="selected for reliability",
                                  source_id=source_id, created_at=created_at,
                                  subject_key=key)
        return record

    def project(self):
        return rebuild(self.root, no_vectors=True)

    def git_record(self, sha, *, path=None):
        record = MemoryRecord(
            schema_version=SCHEMA_VERSION,
            id=derive_record_id(self.store.project_id, "git_commit", sha, "git_change"),
            project_id=self.store.project_id, type=RecordType.git_change,
            title="Capture git change", summary="Record project source changes",
            created_at="2026-09-23T00:00:00+00:00", authority=Authority.git_verified,
            truth_domain=TruthDomain.history,
            provenance=Provenance("git_commit", sha, "git", "test"),
            related_files=(path,) if path else (),
            content={"commit_sha": sha, "semantic_summary": "project source changes",
                     "changed_files": [path] if path else []})
        self.store.write(record)
        return record


class QueryClassificationTests(unittest.TestCase):
    def test_modes_use_fixed_rules(self):
        self.assertEqual(classify_query("what are we using now?"), "CURRENT")
        self.assertEqual(classify_query("what did we use before?"), "HISTORICAL")
        self.assertEqual(classify_query("dec_" + "a" * 24), "EXACT")
        self.assertEqual(classify_query("which record changed in server/pitmry/retrieval.py"), "EXACT")
        self.assertEqual(classify_query("Explain memory architecture"), "GENERAL")

    def test_fts_query_drops_operators_and_quotes_tokens(self):
        self.assertEqual(sanitize_query('sanity OR " OR -- cms'), '"sanity" "cms"')

    def test_gold_set_has_32_cases_and_at_least_25_percent_abstention(self):
        cases = load_gold(DEFAULT_GOLD)
        self.assertEqual(len(cases), 32)
        negatives = [case for case in cases if case["should_abstain"]]
        self.assertGreaterEqual(len(negatives), 8)
        self.assertGreaterEqual(len(negatives) / len(cases), 0.25)
        for case in cases:
            self.assertEqual(case["mode"], classify_query(case["query"]), case["id"])
            for record_id in case["expected_any"] + case["forbidden_current"]:
                self.assertRegex(record_id, r"^(dec|con|git|dis|obs|fail|chk|sum|test|dep|note)_[0-9a-f]{24}$")

    def test_state_accuracy_metrics_cover_conflict_and_supersession(self):
        metrics = _evaluate_state_accuracy()
        self.assertEqual(metrics["conflict_accuracy"], 1.0)
        self.assertEqual(metrics["supersession_accuracy"], 1.0)


class StateResolverTests(RetrievalTestCase):
    def test_explicit_supersession_and_reversion_set_target_state(self):
        old = self.decision("cms.primary", "Use Payload", "payload")
        new = self.decision("cms.primary", "Use Sanity", "sanity",
                            created_at="2026-09-23T00:00:00+00:00")
        capture_relation(self.store, new.id, old.id, RelationType.supersedes,
                         [{"type": "canonical_record", "record_id": new.id}])
        reverted = self.decision("cache.provider", "Use Redis", "redis")
        reverter = self.decision("cache.revert", "Revert Redis", "revert")
        capture_relation(self.store, reverter.id, reverted.id, RelationType.reverts,
                         [{"type": "canonical_record", "record_id": reverter.id}])
        records = self.store.load_all()
        states = resolve_states(records, records)
        self.assertEqual(states[old.id], SUPERSEDED)
        self.assertEqual(states[new.id], CURRENT)
        self.assertEqual(states[reverted.id], REVERTED)

    def test_same_subject_active_decisions_conflict_without_relations(self):
        first = self.decision("cms.primary", "Use Payload", "payload")
        second = self.decision("cms.primary", "Use Sanity", "sanity")
        from server.tests.test_canonical_store_helpers import make_relation
        inferred = make_relation(self.store.project_id, first.id, second.id,
                                 RelationType.semantically_related)
        states = resolve_states([first, second], [inferred])
        self.assertEqual(states[first.id], CONFLICTING)
        self.assertEqual(states[second.id], CONFLICTING)

    def test_timestamps_do_not_supersede(self):
        earlier = self.decision("cache.primary", "Use Redis", "redis")
        later = self.decision("cache.primary", "Use Valkey", "valkey",
                              created_at="2026-09-23T00:00:00+00:00")
        states = resolve_states([earlier, later], [])
        self.assertEqual(states[earlier.id], CONFLICTING)
        self.assertEqual(states[later.id], CONFLICTING)


class FtsRetrievalTests(RetrievalTestCase):
    def test_bm25_returns_canonical_record_with_ranks(self):
        record = self.decision("cms.primary", "Sanity CMS", "sanity")
        self.project()
        result = retrieve("sanity CMS", root=self.root, include_vectors=False)
        self.assertEqual(result["records"][0].id, record.id)
        self.assertEqual(result["signals"][record.id]["lexical_rank"], 1)
        self.assertIn("VECTOR_RETRIEVAL_SKIPPED", result["warnings"])

    def test_project_filter_is_bound_and_never_leaks_foreign_rows(self):
        record = self.decision("cms.primary", "Cassandra database", "cassandra")
        self.project()
        result = retrieve("Cassandra", root=self.root,
                          project_id="prj_000000000000000000000000' OR 1=1 --",
                          include_vectors=False)
        self.assertEqual(result["records"], [])
        self.assertNotIn(record.id, result["signals"])

    def test_exact_id_beats_lexical_candidates(self):
        record = self.decision("cms.primary", "Sanity CMS", "sanity")
        self.project()
        result = retrieve(record.id, root=self.root, include_vectors=False)
        self.assertEqual(result["records"][0].id, record.id)
        self.assertTrue(result["signals"][record.id]["exact_match"])

    def test_embedded_short_git_sha_is_an_exact_match(self):
        record = self.git_record("a" * 40)
        self.project()
        result = retrieve("show the change for commit aaaaaaa", root=self.root,
                          include_vectors=False)
        self.assertEqual(result["records"][0].id, record.id)
        self.assertTrue(result["signals"][record.id]["exact_match"])

    def test_embedded_path_is_an_exact_match(self):
        record = self.git_record("b" * 40, path="server/pitmry/context_service.py")
        self.project()
        result = retrieve("which record changed server/pitmry/context_service.py",
                          root=self.root, include_vectors=False)
        self.assertEqual(result["records"][0].id, record.id)
        self.assertTrue(result["signals"][record.id]["exact_match"])

    def test_vector_unavailable_keeps_fts_and_reports_degraded(self):
        record = self.decision("cms.primary", "Sanity CMS", "sanity")
        self.project()
        with patch("server.pitmry.retrieval._vector_candidates",
                   side_effect=RuntimeError("local index unavailable")):
            result = retrieve("Sanity", root=self.root, include_vectors=True)
        self.assertEqual(result["records"][0].id, record.id)
        self.assertTrue(any(item.startswith("VECTOR_RETRIEVAL_UNAVAILABLE")
                            for item in result["warnings"]))

    def test_vector_only_candidate_is_a_distinct_retrieval_signal(self):
        record = self.decision("cms.primary", "Sanity CMS", "sanity")
        self.project()
        with patch("server.pitmry.retrieval._fts_candidates", return_value=[]), \
                patch("server.pitmry.retrieval._vector_candidates",
                      return_value=([record.id], {record.id: 0.8})):
            result = retrieve("content studio", root=self.root, include_vectors=True)
        self.assertEqual(result["records"][0].id, record.id)
        signals = result["signals"][record.id]
        self.assertEqual(signals["vector_rank"], 1)
        self.assertEqual(signals["vector_similarity"], 0.8)

    def test_no_match_is_a_valid_context_result(self):
        self.project()
        result = context("Cassandra database", root=self.root, include_vectors=False)
        self.assertEqual(result["status"], "NO_MATCH")
        self.assertEqual(result["current"], [])

    def test_current_query_reports_same_subject_conflict(self):
        self.decision("cms.primary", "Use Payload CMS", "payload")
        self.decision("cms.primary", "Use Sanity CMS", "sanity")
        self.project()
        result = context("CMS current", root=self.root, include_vectors=False)
        self.assertEqual(result["status"], "CONFLICT")
        self.assertEqual(len(result["conflicts"]), 2)
        self.assertEqual({item["id"] for item in result["conflict_records"]},
                         set(result["conflicts"]))

    def test_conflict_context_expands_when_search_finds_only_one_side(self):
        payload = self.decision("cms.primary", "Use Payload CMS", "payload")
        sanity = self.decision("cms.primary", "Use Sanity CMS", "sanity")
        self.project()

        result = context("Payload", root=self.root, include_vectors=False)

        self.assertEqual(result["status"], "CONFLICT")
        self.assertEqual(result["conflicts"], sorted([payload.id, sanity.id]))
        self.assertEqual({item["id"] for item in result["conflict_records"]},
                         {payload.id, sanity.id})
        peer = next(item for item in result["conflict_records"] if item["id"] == sanity.id)
        self.assertIn("conflict_group_member:cms.primary", peer["reasons"])

    def test_conflict_ids_survive_when_record_details_exceed_budget(self):
        payload = self.decision("cms.primary", "Use Payload CMS", "payload")
        sanity = self.decision("cms.primary", "Use Sanity CMS", "sanity")
        self.project()

        result = context("Payload", root=self.root, include_vectors=False,
                         character_budget=1)

        self.assertEqual(result["conflicts"], sorted([payload.id, sanity.id]))
        self.assertEqual(result["conflict_records"], [])
        self.assertIn("CONFLICT_CONTEXT_TRUNCATED", result["warnings"])

    def test_context_bounds_oversized_canonical_text(self):
        large = "architecture detail " * 100
        self.decision("docs.long", large, "large-summary")
        self.project()
        result = context("architecture detail", root=self.root,
                         include_vectors=False, character_budget=3000)
        item = result["current"][0]
        self.assertLessEqual(len(item["title"]), 180)
        self.assertLessEqual(len(item["summary"]), 700)

    def test_current_and_historical_queries_respect_supersession(self):
        old = self.decision("cms.primary", "Payload CMS", "payload")
        new = self.decision("cms.primary", "Sanity CMS", "sanity",
                            created_at="2026-09-23T00:00:00+00:00")
        capture_relation(self.store, new.id, old.id, RelationType.supersedes,
                         [{"type": "canonical_record", "record_id": new.id}])
        self.project()
        current = context("CMS current", root=self.root, include_vectors=False)
        historical = context("CMS before", root=self.root, include_vectors=False)
        self.assertEqual(current["current"][0]["id"], new.id)
        self.assertTrue(any(item["id"] == old.id for item in historical["historical"]))


class ExplicitLineageTests(RetrievalTestCase):
    def test_unlinked_similar_records_do_not_create_lineage(self):
        first = self.decision("api.auth", "Use signed API tokens", "decision-one")
        self.decision("api.auth_notes", "Signed API token middleware", "discussion-like")
        result = lineage(first.id, root=self.root)
        self.assertEqual([item["id"] for item in result["nodes"]], [first.id])
        self.assertEqual(result["relations"], [])

    def test_explicit_implements_is_returned_as_evidence(self):
        decision = self.decision("api.auth", "Use signed API tokens", "decision")
        # Use a valid git_change record type through the existing Git capture
        # factory shape without needing an actual repository.
        from server.pitmry.models import MemoryRecord, Provenance, SCHEMA_VERSION
        from server.pitmry.enums import Authority, RecordType, TruthDomain
        from server.pitmry.ids import derive_record_id
        git_record = MemoryRecord(
            schema_version=SCHEMA_VERSION,
            id=derive_record_id(self.store.project_id, "git_commit", "a" * 40, "git_change"),
            project_id=self.store.project_id, type=RecordType.git_change,
            title="Implement API tokens", summary="Add token middleware",
            created_at="2026-09-23T00:00:00+00:00", authority=Authority.git_verified,
            truth_domain=TruthDomain.history,
            provenance=Provenance("git_commit", "a" * 40, "git", "test"),
            content={"commit_sha": "a" * 40, "semantic_summary": "token middleware"})
        self.store.write(git_record)
        capture_relation(self.store, git_record.id, decision.id, RelationType.implements,
                         [{"type": "canonical_record", "record_id": git_record.id}])
        self.project()
        result = context("signed API tokens", root=self.root, include_vectors=False)
        self.assertEqual(result["evidence"][0]["id"], git_record.id)
        self.assertEqual(result["explicit_relations"][0]["relation"], "implements")
        self.assertEqual(result["explicit_relations"][0]["provenance"], "explicit")
        relation_groups = relation_view(self.store.load_all(), decision.id)
        self.assertEqual(relation_groups["explicit"][0]["relation"], "implements")
        self.assertTrue(all(item["provenance"] == "inferred"
                            for item in relation_groups["inferred"]))
        path = lineage(decision.id, root=self.root)
        self.assertEqual(path["relations"][0]["relation"], "implements")


if __name__ == "__main__":
    unittest.main()
