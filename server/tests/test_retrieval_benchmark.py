"""Tests for the retrieval benchmark.

The fixture mode is a deterministic plumbing check. It must never be treated as
a measure of real retrieval quality, so these tests assert plumbing invariants
and the threshold/baseline contract instead of asserting a perfect score.
"""

import json
import sys
import unittest
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_DIR / "scripts"))

from retrieval_benchmark import (  # noqa: E402
    DEFAULT_GOLDEN,
    compare_baseline,
    evaluate_metrics,
    run_benchmark,
)


class FixturePlumbingTests(unittest.TestCase):
    """The synthetic corpus proves the wiring, nothing more."""

    @classmethod
    def setUpClass(cls):
        cls.result = run_benchmark(SERVER_DIR / "fixtures" / "retrieval_benchmark.json",
                                   as_json=True)

    def test_every_expected_id_is_reachable(self):
        for case in self.result["cases"]:
            self.assertIsNotNone(
                case["rank"],
                f"{case['expected_id']} was not returned for '{case['query']}'"
            )

    def test_pipeline_is_deterministic(self):
        self.assertEqual(self.result["metrics"]["deterministic"], 1.0)

    def test_ids_are_mapped_to_their_record_type(self):
        prefixes = ("adr-", "commit-", "grill-", "summary-",
                    "checkpoint-", "memory-", "observation-")
        for case in self.result["cases"]:
            self.assertTrue(case["ids"], "a case returned no ids at all")
            for item_id in case["ids"]:
                self.assertTrue(
                    item_id.startswith(prefixes),
                    f"unmapped id format: {item_id}"
                )

    def test_reports_itself_as_plumbing_only(self):
        self.assertEqual(self.result["mode"], "fixture")
        self.assertIn("does not measure real retrieval quality", self.result["note"])
        self.assertEqual(self.result["violations"], [])


class ThresholdContractTests(unittest.TestCase):
    """Threshold and baseline evaluation must fail loudly and specifically."""

    def test_lower_is_better_metric_fails_when_above_limit(self):
        violations = evaluate_metrics({"p95_latency_ms": 2500}, {"p95_latency_ms": 1500})
        self.assertEqual(len(violations), 1)
        self.assertIn("above the limit", violations[0])

    def test_higher_is_better_metric_fails_when_below_minimum(self):
        violations = evaluate_metrics({"recall_at_1": 0.5}, {"recall_at_1": 0.88})
        self.assertEqual(len(violations), 1)
        self.assertIn("below the minimum", violations[0])

    def test_unmeasured_threshold_is_a_violation(self):
        violations = evaluate_metrics({}, {"recall_at_1": 0.88})
        self.assertEqual(len(violations), 1)
        self.assertIn("not measured", violations[0])

    def test_baseline_regression_is_detected(self):
        baseline = {"metrics": {"recall_at_1": 0.96, "p95_latency_ms": 200}}
        violations = compare_baseline({"recall_at_1": 0.80, "p95_latency_ms": 210},
                                      baseline, tolerance=0.05)
        self.assertEqual(len(violations), 1)
        self.assertIn("recall_at_1", violations[0])

    def test_no_baseline_means_no_regression_claims(self):
        self.assertEqual(compare_baseline({"recall_at_1": 0.1}, None), [])


class GoldenSetTests(unittest.TestCase):
    """The golden set must stay well formed and self-describing."""

    @classmethod
    def setUpClass(cls):
        cls.golden = json.loads(DEFAULT_GOLDEN.read_text(encoding="utf-8"))

    def test_has_enough_cases_to_be_meaningful(self):
        self.assertGreaterEqual(len(self.golden["cases"]), 15)
        self.assertLessEqual(len(self.golden["cases"]), 40)

    def test_every_case_has_a_reachable_contract(self):
        for case in self.golden["cases"]:
            self.assertTrue(case.get("id"), "a case is missing an id")
            self.assertTrue(case.get("query"), f"{case['id']} has no query")
            self.assertTrue(case.get("expected_any"), f"{case['id']} has no expected ids")
            self.assertGreaterEqual(case.get("target_rank", 3), 1)

    def test_no_result_cases_use_nonsense_tokens_only(self):
        # A no-result case that contains real English words would match real
        # observations and fail the gate for the wrong reason.
        english = {"the", "and", "unrelated", "topic", "nonsense", "memory",
                   "code", "design", "server"}
        self.assertTrue(self.golden["no_result_cases"])
        for query in self.golden["no_result_cases"]:
            words = {word.lower() for word in query.split()}
            self.assertFalse(words & english,
                             f"no-result case shares real words: {query}")

    def test_known_gaps_stay_explained(self):
        # A case marked as a known gap must say why, so it cannot be quietly
        # deleted by someone who only wants a green run.
        for case in self.golden["cases"]:
            if case.get("known_gap"):
                self.assertTrue(case.get("note"), f"{case['id']} is an unexplained gap")

    def test_thresholds_cover_the_reported_metrics(self):
        thresholds = self.golden["thresholds"]
        for key in ("recall_at_1", "recall_at_3", "mean_reciprocal_rank",
                    "no_result_precision", "semantic_source_share",
                    "p95_latency_ms", "index_freshness"):
            self.assertIn(key, thresholds)


if __name__ == "__main__":
    unittest.main()
