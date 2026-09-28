"""Acceptance coverage for the canonical Project Intelligence service layer."""

import sys
import subprocess
import sqlite3
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_DIR))

from server.pitmry.canonical_store import CanonicalStore
from server.pitmry.capture import capture_decision
from server.pitmry.enums import RecordType
from server.pitmry.project_intelligence import (
    ProjectIntelligenceError,
    add_dependency,
    baseline_project,
    create_phase,
    create_work_unit,
    dependency_cycle,
    evaluate_readiness,
    finish_session,
    import_decomposition,
    ingest_markdown,
    record_reconciliation,
    resolve_reconciliation,
    start_session,
    state_of,
    verify_work,
    verification_staleness,
    project_intelligence_doctor,
    project_sqlite_state,
)
from server.pitmry.sqlite_projection import initialize, project_record


class ProjectIntelligenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        subprocess.run(["git", "init", "-q", str(self.root)], check=True)
        subprocess.run(["git", "-C", str(self.root), "config", "user.name", "PITMRY Test"], check=True)
        subprocess.run(["git", "-C", str(self.root), "config", "user.email", "pitmry-test@example.invalid"], check=True)
        (self.root / "README.md").write_text("fixture\n", encoding="utf-8")
        subprocess.run(["git", "-C", str(self.root), "add", "README.md"], check=True)
        subprocess.run(["git", "-C", str(self.root), "commit", "-q", "-m", "fixture"], check=True)
        self.commit = subprocess.run(["git", "-C", str(self.root), "rev-parse", "HEAD"],
                                     check=True, capture_output=True, text=True).stdout.strip()
        self.store = CanonicalStore(self.root)
        self.store.init_project(name="pi-fixture")
        (self.root / "docs").mkdir()
        (self.root / "docs" / "prd.md").write_text("# Fixture\n\nThe system must retain evidence.\n", encoding="utf-8")

    def test_intake_preserves_source_and_reingestion_is_idempotent(self):
        first = ingest_markdown(self.store, "docs/prd.md")
        second = ingest_markdown(self.store, "docs/prd.md")
        self.assertEqual(first.id, second.id)
        self.assertIn("The system must retain evidence", first.content["original_text"])
        self.assertEqual(first.content["source_hash"], second.content["source_hash"])

    def test_source_path_must_stay_inside_repo_and_be_markdown(self):
        with self.assertRaises(ProjectIntelligenceError):
            ingest_markdown(self.store, "../outside.md")
        with self.assertRaises(ProjectIntelligenceError):
            ingest_markdown(self.store, "pyproject.toml")

    def _import_one_requirement(self):
        source = ingest_markdown(self.store, "docs/prd.md")
        result = import_decomposition(self.store, source.id, {
            "artifact_id": source.id,
            "requirements": [{"temporary_key": "R1", "kind": "backend",
                              "statement": "The system must retain evidence.",
                              "source_locator": {"section": "Fixture", "ordinal": 1},
                              "acceptance_criteria": ["A canonical record retains the source hash."]}],
        })
        return source, result["requirements"][0]

    def test_decomposition_stays_proposed_and_repeat_import_is_idempotent(self):
        source, requirement_id = self._import_one_requirement()
        again = import_decomposition(self.store, source.id, {
            "artifact_id": source.id,
            "requirements": [{"temporary_key": "R1", "kind": "backend",
                              "statement": "The system must retain evidence.",
                              "source_locator": {"section": "Fixture", "ordinal": 1},
                              "acceptance_criteria": ["A canonical record retains the source hash."]}],
        })
        self.assertEqual(again["requirements"], [requirement_id])
        self.assertEqual(state_of(self.store, requirement_id), "PROPOSED")

    def test_baseline_requires_resolution_of_critical_conflicts(self):
        source, requirement_id = self._import_one_requirement()
        other = capture_decision(self.store, "Conflicting intent", "Another policy", source_id="conflicting-policy")
        conflict = record_reconciliation(self.store, "CONFLICT", [requirement_id, other], "These statements conflict.")
        with self.assertRaises(ProjectIntelligenceError):
            baseline_project(self.store, [requirement_id], confirmation="pi-fixture")
        resolve_reconciliation(self.store, conflict.id, "Keep the source requirement.")
        marker = baseline_project(self.store, [requirement_id], confirmation="pi-fixture")
        self.assertEqual(marker.content["checkpoint_kind"], "project_intelligence_baseline")
        self.assertEqual(state_of(self.store, requirement_id), "ACCEPTED")

    def test_dependency_cycle_is_rejected(self):
        _, requirement_id = self._import_one_requirement()
        baseline_project(self.store, [requirement_id], confirmation="pi-fixture")
        phase = create_phase(self.store, "Phase", 1, "Build the feature")
        one = create_work_unit(self.store, phase.id, "One", "First work", [requirement_id])
        two = create_work_unit(self.store, phase.id, "Two", "Second work", [requirement_id])
        add_dependency(self.store, one.id, two.id)
        with self.assertRaisesRegex(ProjectIntelligenceError, "DEPENDENCY_CYCLE"):
            add_dependency(self.store, two.id, one.id)
        self.assertFalse(dependency_cycle(self.store))

    def test_readiness_blocks_unaccepted_requirements_and_session_claim_is_exclusive(self):
        _, requirement_id = self._import_one_requirement()
        phase = create_phase(self.store, "Phase", 1, "Build the feature")
        work = create_work_unit(self.store, phase.id, "Implement", "Implement the requirement", [requirement_id])
        readiness = evaluate_readiness(self.store, work.id)
        self.assertFalse(readiness["ready"])
        self.assertIn("REQUIREMENT_NOT_ACCEPTED", {item["code"] for item in readiness["blocking_reasons"]})
        baseline_project(self.store, [requirement_id], confirmation="pi-fixture")
        claimed = start_session(self.store, work.id, agent="test", lease_seconds=60)
        with self.assertRaises(ProjectIntelligenceError):
            start_session(self.store, work.id, agent="second", lease_seconds=60)
        self.assertEqual(claimed["contract"]["work_unit_id"], work.id)

    def test_two_threads_cannot_claim_the_same_work(self):
        _, requirement_id = self._import_one_requirement()
        baseline_project(self.store, [requirement_id], confirmation="pi-fixture")
        phase = create_phase(self.store, "Phase", 1, "Build the feature")
        work = create_work_unit(self.store, phase.id, "Implement", "Implement the requirement", [requirement_id])
        barrier = threading.Barrier(2)
        def claim(agent):
            barrier.wait()
            try:
                return start_session(self.store, work.id, agent=agent, lease_seconds=60)["session"].id
            except ProjectIntelligenceError:
                return None
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(claim, ("first", "second")))
        self.assertEqual(sum(item is not None for item in results), 1)

    def test_project_intelligence_state_rebuilds_into_sqlite(self):
        _, requirement_id = self._import_one_requirement()
        baseline_project(self.store, [requirement_id], confirmation="pi-fixture")
        phase = create_phase(self.store, "Phase", 1, "Build the feature")
        create_work_unit(self.store, phase.id, "Implement", "Implement the requirement", [requirement_id])
        conn = initialize(Path(self.root) / "projection.db")
        try:
            for record in self.store.load_all():
                project_record(conn, record)
            summary = project_sqlite_state(conn, self.store)
            self.assertEqual(summary["work_units"], 1)
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM pi_work_readiness").fetchone()[0], 1)
        finally:
            conn.close()

    def test_verification_requires_acceptance_criterion_and_records_staleness(self):
        _, requirement_id = self._import_one_requirement()
        baseline_project(self.store, [requirement_id], confirmation="pi-fixture")
        phase = create_phase(self.store, "Phase", 1, "Build the feature")
        work = create_work_unit(self.store, phase.id, "Implement", "Implement the requirement", [requirement_id])
        started = start_session(self.store, work.id, agent="test", branch="feature/pi",
                                base_commit=self.commit, lease_seconds=60)
        implementation = finish_session(self.store, started["session"].id,
            changed_files=["README.md"], summary="Retain durable evidence", commit_sha=self.commit,
            build_result="PASS",
            tests=[{"name": "evidence test", "result": "PASS", "command": "unit test", "exit_code": 0}])
        criterion = next(r for r in self.store.iter_records()
                         if r.type == RecordType.acceptance_criterion)
        test_id = implementation.content["test_result_ids"][0]
        verification = verify_work(self.store, work.id, self.commit,
            [{"criterion_id": criterion.id, "result": "PASS", "evidence": [test_id]}])
        self.assertEqual(state_of(self.store, work.id), "VERIFIED")
        self.assertFalse(verification_staleness(self.store, verification.id)["stale"])
        (self.root / "README.md").write_text("changed after verification\n", encoding="utf-8")
        subprocess.run(["git", "-C", str(self.root), "add", "README.md"], check=True)
        subprocess.run(["git", "-C", str(self.root), "commit", "-q", "-m", "later change"], check=True)
        stale = verification_staleness(self.store, verification.id)
        self.assertTrue(stale["stale"])
        self.assertEqual(state_of(self.store, work.id), "NEEDS_REVERIFICATION")
        self.assertEqual(project_intelligence_doctor(self.store)["errors"], [])


if __name__ == "__main__":
    unittest.main()
