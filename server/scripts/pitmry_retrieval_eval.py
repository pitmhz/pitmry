"""Evaluate Phase 3 retrieval against the project-local JSONL gold set."""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from types import SimpleNamespace
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from server.pitmry.canonical_store import CanonicalStore  # noqa: E402
from server.pitmry.enums import RecordType, RelationProvenance, RelationType  # noqa: E402
from server.pitmry.ids import derive_record_id, derive_relation_id  # noqa: E402
from server.pitmry.models import MemoryRecord, RelationRecord, SCHEMA_VERSION  # noqa: E402
from server.pitmry.relations import explicit_relations  # noqa: E402
from server.pitmry.retrieval import retrieve  # noqa: E402
from server.pitmry.state_resolver import (CONFLICTING, CURRENT, SUPERSEDED,
                                          resolve_states)  # noqa: E402

DEFAULT_GOLD = REPO_ROOT / ".pitmry" / "eval" / "gold.jsonl"


def load_gold(path=DEFAULT_GOLD):
    cases = []
    for line_number, line in enumerate(Path(path).read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            item = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"{path}:{line_number}: invalid JSON: {exc}") from exc
        required = ("id", "query", "mode", "expected_any", "forbidden_current", "should_abstain")
        missing = [key for key in required if key not in item]
        if missing:
            raise ValueError(f"{path}:{line_number}: missing fields {', '.join(missing)}")
        if not isinstance(item["expected_any"], list) or not isinstance(item["forbidden_current"], list):
            raise ValueError(f"{path}:{line_number}: expected_any and forbidden_current must be lists")
        cases.append(item)
    if not cases:
        raise ValueError(f"{path}: no evaluation cases")
    return cases


def _percentile(values, percentile):
    if not values:
        return None
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1,
                       int(round((len(ordered) - 1) * percentile))))
    return round(ordered[index], 3)


def _state_accuracy_fixtures():
    """Return deterministic synthetic records for state-resolution gates."""
    project_id = "prj_000000000000000000000001"
    other_project_id = "prj_000000000000000000000002"

    def decision(project, source_id, subject_key):
        return SimpleNamespace(
            id=derive_record_id(project, "state_eval", source_id, RecordType.decision),
            project_id=project,
            type=RecordType.decision,
            content={"subject_key": subject_key},
        )

    def supersedes(source, target):
        return RelationRecord(
            schema_version=SCHEMA_VERSION,
            id=derive_relation_id(project_id, source.id, target.id, RelationType.supersedes),
            project_id=project_id,
            relation=RelationType.supersedes,
            source_record_id=source.id,
            target_record_id=target.id,
            provenance=RelationProvenance.explicit,
            created_at="2026-09-23T00:00:00+00:00",
            evidence_refs=({"type": "evaluation", "source_id": "state-gold"},),
        )

    conflict_a = decision(project_id, "conflict-a", "storage.engine")
    conflict_b = decision(project_id, "conflict-b", "storage.engine")
    superseded = decision(project_id, "superseded", "cache.provider")
    current = decision(project_id, "current", "cache.provider")
    foreign = decision(other_project_id, "foreign", "storage.engine")
    records = [conflict_a, conflict_b, superseded, current, foreign]
    relations = [supersedes(current, superseded)]
    expected_conflict = {
        conflict_a.id: CONFLICTING,
        conflict_b.id: CONFLICTING,
        foreign.id: CURRENT,
    }
    expected_supersession = {
        superseded.id: SUPERSEDED,
        current.id: CURRENT,
    }
    return records, relations, expected_conflict, expected_supersession


def _evaluate_state_accuracy():
    records, relations, conflict_expected, supersession_expected = _state_accuracy_fixtures()
    states = resolve_states(records, relations)

    def accuracy(expected):
        if not expected:
            return None
        return round(sum(states.get(record_id) == state
                         for record_id, state in expected.items()) / len(expected), 4)

    return {
        "conflict_accuracy": accuracy(conflict_expected),
        "supersession_accuracy": accuracy(supersession_expected),
    }


def evaluate(root=None, gold_path=DEFAULT_GOLD, *, no_vectors=False):
    cases = load_gold(gold_path)
    store = CanonicalStore(root)
    manifest = store.require_manifest()
    all_records = store.load_all()
    memories = [record for record in all_records if isinstance(record, MemoryRecord)]
    states = resolve_states(memories, explicit_relations(all_records))
    positive = [case for case in cases if not case["should_abstain"]]
    ranked_reciprocals = []
    hit_at_1 = hit_at_5 = 0
    mode_correct = 0
    abstention_correct = false_memory_queries = false_memory_outputs = 0
    surfaced_current = cross_project_leaks = 0
    latencies = []
    reports = []

    for case in cases:
        started = time.perf_counter()
        result = retrieve(case["query"], root=root, limit=10,
                          include_vectors=not no_vectors)
        mode_correct += int(result["mode"] == case["mode"])
        latency_ms = (time.perf_counter() - started) * 1000
        latencies.append(latency_ms)
        ids = [record.id for record in result["records"]]
        expected = set(case["expected_any"])
        ranks = [index for index, record_id in enumerate(ids, 1) if record_id in expected]
        rank = min(ranks) if ranks else None
        if not case["should_abstain"]:
            ranked_reciprocals.append(1 / rank if rank else 0)
            hit_at_1 += int(rank == 1)
            hit_at_5 += int(rank is not None and rank <= 5)
        abstained = not ids
        abstention_correct += int(abstained == bool(case["should_abstain"]))
        current_ids = [record_id for record_id in ids if states.get(record_id) == CURRENT]
        surfaced_current += len(current_ids)
        forbidden = set(case["forbidden_current"])
        false_ids = ([record_id for record_id in current_ids if record_id in forbidden]
                     if not case["should_abstain"] else current_ids)
        false_memory_outputs += len(false_ids)
        false_memory_queries += int(bool(false_ids))
        cross_project_leaks += sum(
            1 for record in result["records"] if record.project_id != manifest["project_id"])
        reports.append({
            "id": case["id"], "mode": result["mode"],
            "expected_mode": case["mode"], "status": (
                "NO_MATCH" if not ids else "DEGRADED" if result["warnings"] else "OK"),
            "rank": rank, "result_ids": ids,
            "false_current_ids": false_ids,
            "latency_ms": round(latency_ms, 3), "warnings": result["warnings"],
        })

    total = len(cases)
    positive_count = len(positive)
    metrics = {
        "case_count": total,
        "positive_count": positive_count,
        "negative_count": total - positive_count,
        "recall_at_1": round(hit_at_1 / positive_count, 4) if positive_count else None,
        "recall_at_5": round(hit_at_5 / positive_count, 4) if positive_count else None,
        "mean_reciprocal_rank": round(statistics.mean(ranked_reciprocals), 4)
        if ranked_reciprocals else None,
        "query_mode_accuracy": round(mode_correct / total, 4) if total else None,
        "abstention_accuracy": round(abstention_correct / total, 4) if total else None,
        "false_memory_query_count": false_memory_queries,
        "false_memory_output_count": false_memory_outputs,
        "false_memory_rate": round(false_memory_queries / total, 4) if total else None,
        "surfaced_current_count": surfaced_current,
        "cross_project_leak_count": cross_project_leaks,
        "p50_latency_ms": _percentile(latencies, 0.50),
        "p95_latency_ms": _percentile(latencies, 0.95),
        **_evaluate_state_accuracy(),
    }
    return {"project_id": manifest["project_id"], "mode": "no_vectors" if no_vectors else "hybrid",
            "gold_path": str(Path(gold_path)), "metrics": metrics, "cases": reports}


def main(argv=None):
    parser = argparse.ArgumentParser(description="Evaluate PITMRY retrieval quality")
    parser.add_argument("--root", default=None)
    parser.add_argument("--gold", default=str(DEFAULT_GOLD))
    parser.add_argument("--no-vectors", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)
    try:
        report = evaluate(args.root, args.gold, no_vectors=args.no_vectors)
    except (OSError, ValueError, RuntimeError) as exc:
        print(f"evaluation failed: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
