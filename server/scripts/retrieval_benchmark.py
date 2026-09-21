#!/usr/bin/env python3
"""
retrieval_benchmark.py - Retrieval quality gate for pitmry.

Two modes, and the difference matters:

  fixture (default, `run_benchmark`)
      A deterministic synthetic corpus with orthogonal vectors. It proves the
      retrieval plumbing works (indexing, ranking order, coverage). It does
      NOT measure real memory quality: recall is 1.0 by construction. Use it
      in CI.

  live (`--live`)
      Runs the golden query set in server/fixtures/retrieval_golden.json
      against the real Cavemem database and LanceDB through the same hybrid
      path that agents call (memory_navigator.cmd_search). This is the quality
      gate. It reports recall, no-result precision, whether results came from
      semantic or lexical matching, index freshness, and latency.

Usage:
  python retrieval_benchmark.py                          # fixture plumbing check
  python retrieval_benchmark.py --json
  python retrieval_benchmark.py --live                   # live golden set
  python retrieval_benchmark.py --live --json
  python retrieval_benchmark.py --live --baseline server/fixtures/retrieval_baseline.json
  python retrieval_benchmark.py --live --update-baseline

Exit codes:
  0  all thresholds met and no baseline regression
  1  threshold or baseline violation
  2  setup error (fixture or golden file missing)

Thresholds live in the fixture JSON under "thresholds". Live thresholds are
regression floors, not targets: set them just below the recorded baseline so a
regression fails the gate. Targets are tracked in
docs/lancedb-retrieval-assessment-2026-09-20.md.
"""

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

SERVER_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = SERVER_DIR / "scripts"
for _path in (str(SERVER_DIR), str(SCRIPTS_DIR)):
    if _path not in sys.path:
        sys.path.insert(0, _path)

try:
    from lancedb_strategic import EMBED_DIM
except ImportError:  # pragma: no cover - keeps fixture helpers importable
    EMBED_DIM = 384

DEFAULT_FIXTURE = SERVER_DIR / "fixtures" / "retrieval_benchmark.json"
DEFAULT_GOLDEN = SERVER_DIR / "fixtures" / "retrieval_golden.json"
DEFAULT_BASELINE = SERVER_DIR / "fixtures" / "retrieval_baseline.json"

# Metrics where a smaller number is better.
LOWER_IS_BETTER = {"p95_latency_ms", "unembedded_observations"}

# Fixture mode only verifies plumbing, so it has one honest success condition.
FIXTURE_THRESHOLDS = {"case_hit_rate": 1.0, "deterministic": 1.0}


def load_json(path: Path) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def percentile(values: List[float], fraction: float = 0.95) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, int(len(ordered) * fraction) - 1))
    return round(ordered[index], 3)


def evaluate_metrics(metrics: Dict[str, Any],
                     thresholds: Dict[str, float]) -> List[str]:
    """Return one human-readable violation string per failed threshold."""
    violations = []
    for key, limit in (thresholds or {}).items():
        if not isinstance(limit, (int, float)):
            continue
        if key not in metrics or metrics[key] is None:
            violations.append(f"{key}: not measured (threshold {limit})")
            continue
        value = metrics[key]
        if key in LOWER_IS_BETTER:
            if value > limit:
                violations.append(f"{key}: {value} is above the limit of {limit}")
        elif value < limit:
            violations.append(f"{key}: {value} is below the minimum of {limit}")
    return violations


def compare_baseline(metrics: Dict[str, Any],
                     baseline: Optional[Dict[str, Any]],
                     tolerance: float = 0.05) -> List[str]:
    """Return one violation string per metric that regressed past tolerance."""
    if not baseline:
        return []
    violations = []
    for key, base_value in (baseline.get("metrics") or {}).items():
        if key not in metrics or not isinstance(base_value, (int, float)):
            continue
        value = metrics[key]
        if not isinstance(value, (int, float)):
            continue
        if key in LOWER_IS_BETTER:
            ceiling = base_value * (1 + max(tolerance, 0.5))
            if value > ceiling:
                violations.append(f"{key}: {value} regressed from baseline {base_value}")
        elif value < base_value - tolerance:
            violations.append(f"{key}: {value} regressed from baseline {base_value}")
    return violations


# ==============================================================================
# Fixture mode: deterministic plumbing check (not a quality measurement)
# ==============================================================================

class FixtureEmbedder:
    """Maps fixture keys to deterministic orthogonal vectors."""

    def __init__(self, keys):
        self.keys = list(keys)

    def embed(self, text):
        vector = [0.0] * EMBED_DIM
        for index, key in enumerate(self.keys):
            if key in text:
                vector[index] = 1.0
                return vector
        vector[-1] = 1.0
        return vector


def create_fixture_db(db_path: Path, records):
    import sqlite3

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.executescript("""
        CREATE TABLE adrs (id INTEGER PRIMARY KEY, project TEXT, title TEXT, context TEXT, decision TEXT, rationale TEXT, trade_offs TEXT, status TEXT, tags TEXT, timestamp TEXT);
        CREATE TABLE git_semantic_digests (id INTEGER PRIMARY KEY, project TEXT, commit_hash TEXT, branch TEXT, summary TEXT, files_changed TEXT, rationale TEXT, timestamp TEXT);
        CREATE TABLE grill_me_logs (id INTEGER PRIMARY KEY, project TEXT, topic TEXT, questions TEXT, answers TEXT, key_takeaways TEXT, resolved_direction TEXT, timestamp TEXT);
        CREATE TABLE sessions (id TEXT PRIMARY KEY, project_key TEXT, cwd TEXT);
        CREATE TABLE summaries (id INTEGER PRIMARY KEY, session_id TEXT, scope TEXT, content TEXT, ts TEXT);
        CREATE TABLE checkpoints (id INTEGER PRIMARY KEY, session_id TEXT, project_key TEXT, trigger TEXT, content TEXT, ts TEXT);
        CREATE TABLE memory_items (id INTEGER PRIMARY KEY, stable_key TEXT, project_key TEXT, kind TEXT, title TEXT, content TEXT, updated_at TEXT);
    """)
    type_indexes = {}
    for record in records:
        kind, key = record["type"], record["key"]
        type_indexes[kind] = type_indexes.get(kind, 0) + 1
        index = type_indexes[kind]
        project = "fixture-project"
        if kind == "adr":
            cur.execute("INSERT INTO adrs VALUES (?,?,?,?,?,?,?,?,?,?)", (index, project, key, key, key, key, "", "accepted", key, "1"))
        elif kind == "commit":
            cur.execute("INSERT INTO git_semantic_digests VALUES (?,?,?,?,?,?,?,?)", (index, project, key, "main", key, key, key, "1"))
        elif kind == "grill":
            cur.execute("INSERT INTO grill_me_logs VALUES (?,?,?,?,?,?,?,?)", (index, project, key, key, key, key, key, "1"))
        elif kind == "summary":
            cur.execute("INSERT INTO sessions VALUES (?,?,?)", (f"session-{index}", project, project))
            cur.execute("INSERT INTO summaries VALUES (?,?,?,?,?)", (index, f"session-{index}", "fixture", key, "1"))
        elif kind == "checkpoint":
            cur.execute("INSERT INTO checkpoints VALUES (?,?,?,?,?,?)", (index, f"session-{index}", project, "fixture", key, "1"))
        elif kind == "memory":
            cur.execute("INSERT INTO memory_items VALUES (?,?,?,?,?,?,?)", (index, f"memory:{key}", project, "fixture", key, key, "1"))
    conn.commit()
    conn.close()


def _fixture_ids(results, prefixes):
    ordered = sorted(results, key=lambda item: item["similarity"], reverse=True)
    return [
        str(item["id"]) if "-" in str(item["id"]) else f"{prefixes[item['table']]}-{item['id']}"
        for item in ordered
    ]


def run_benchmark(fixture_path: Path = DEFAULT_FIXTURE,
                  as_json: bool = False) -> Dict[str, Any]:
    """Deterministic plumbing check over a synthetic corpus.

    Everything here is synthetic: the embedder uses one-hot vectors keyed on
    the query string, so a perfect score only means the index, the ranking and
    the ID mapping are wired correctly. Real quality is measured by `run_live`.
    """
    import tempfile

    from lancedb_strategic import search, sync_from_cavemem

    fixture = load_json(Path(fixture_path))
    keys = [record["key"] for record in fixture["records"]]
    embedder = FixtureEmbedder(keys)
    prefixes = {"adrs": "adr", "git_digests": "commit", "grill_me_logs": "grill"}

    # Use the project directory instead of the process Temp directory. This
    # keeps the benchmark usable in locked-down Windows environments.
    with tempfile.TemporaryDirectory(prefix=".retrieval-benchmark-", dir=SERVER_DIR) as temp_dir:
        root = Path(temp_dir)
        sqlite_path = root / "fixture.db"
        lance_path = root / "lancedb"
        create_fixture_db(sqlite_path, fixture["records"])
        sync_from_cavemem(str(lance_path), str(sqlite_path), embedder)

        cases = []
        latencies = []
        first_pass = []
        for case in fixture["queries"]:
            started = time.perf_counter()
            results = search(case["query"], limit=3, db_dir=str(lance_path),
                             embedder=embedder, as_json=True)
            latency_ms = (time.perf_counter() - started) * 1000
            ids = _fixture_ids(results, prefixes)
            first_pass.append(ids)
            rank = next((i + 1 for i, item_id in enumerate(ids)
                         if item_id == case["expected_id"]), None)
            cases.append({"query": case["query"], "expected_id": case["expected_id"],
                          "rank": rank, "ids": ids, "latency_ms": round(latency_ms, 3)})
            latencies.append(latency_ms)

        # A second identical pass proves the pipeline is deterministic.
        second_pass = [
            _fixture_ids(
                search(case["query"], limit=3, db_dir=str(lance_path),
                       embedder=embedder, as_json=True),
                prefixes
            )
            for case in fixture["queries"]
        ]

    total = len(cases) or 1
    hits = sum(case["rank"] is not None for case in cases)
    metrics = {
        "case_hit_rate": round(hits / total, 4),
        "deterministic": 1.0 if first_pass == second_pass else 0.0,
        "p95_latency_ms": percentile(latencies),
        "vector_coverage": len(fixture["records"])
    }
    thresholds = dict(FIXTURE_THRESHOLDS)
    thresholds.update(fixture.get("thresholds") or {})
    report = {
        "mode": "fixture",
        "note": ("Synthetic plumbing check. It does not measure real retrieval "
                 "quality. Run with --live for the quality gate."),
        "fixture_version": fixture.get("version"),
        "cases": cases,
        "metrics": metrics,
        "thresholds": thresholds,
        "violations": evaluate_metrics(metrics, thresholds)
    }
    if not as_json:
        print(json.dumps(report, indent=2))
    return report


# ==============================================================================
# Live mode: the real quality gate
# ==============================================================================

def measure_index_freshness() -> Dict[str, Any]:
    """Compare indexed LanceDB vectors against their SQLite source rows."""
    import os
    import sqlite3

    from memory_navigator import (DEFAULT_CAVEMEM_DB, DEFAULT_LANCE_DIR,
                                  get_lancedb, get_lance_table_names)

    lancedb_counts = {}
    try:
        ldb = get_lancedb(DEFAULT_LANCE_DIR)
        for name in get_lance_table_names(ldb):
            lancedb_counts[name] = len(ldb.open_table(name))
    except Exception as exc:  # noqa: BLE001 - reported as freshness 0
        return {"status": "unavailable", "error": str(exc), "indexed": {}, "source": {}}

    source_counts: Dict[str, int] = {}
    merged_memories = 0
    if os.path.exists(DEFAULT_CAVEMEM_DB):
        conn = sqlite3.connect(DEFAULT_CAVEMEM_DB)
        try:
            for table in ("adrs", "git_semantic_digests", "grill_me_logs",
                          "summaries", "checkpoints", "memory_items"):
                try:
                    source_counts[table] = conn.execute(
                        f"SELECT COUNT(*) FROM {table}"
                    ).fetchone()[0]
                except sqlite3.Error:
                    source_counts[table] = 0
            # A durable memory promoted from a checkpoint shares the checkpoint
            # vector and is linked through related_ids instead of getting its
            # own row. Counting it as missing would report false index lag.
            try:
                merged_memories = conn.execute(
                    "SELECT COUNT(*) FROM memory_items m WHERE EXISTS ("
                    "SELECT 1 FROM checkpoints c WHERE c.content = m.content)"
                ).fetchone()[0]
            except sqlite3.Error:
                merged_memories = 0
        finally:
            conn.close()

    recovery_source = (source_counts.get("summaries", 0)
                       + source_counts.get("checkpoints", 0)
                       + source_counts.get("memory_items", 0)
                       - merged_memories)
    pairs = {
        "adrs": source_counts.get("adrs", 0),
        "git_digests": source_counts.get("git_semantic_digests", 0),
        "grill_me_logs": source_counts.get("grill_me_logs", 0),
        "recovery_records": recovery_source
    }
    ratios = {}
    for table, expected in pairs.items():
        indexed = lancedb_counts.get(table, 0)
        ratios[table] = round(min(1.0, indexed / expected), 4) if expected else 1.0

    return {
        "status": "measured",
        "indexed": {k: lancedb_counts.get(k, 0) for k in pairs},
        "source": pairs,
        "merged_durable_memories": merged_memories,
        "ratios": ratios,
        "worst_ratio": round(min(ratios.values()), 4) if ratios else 0.0
    }


def run_live(golden_path: Path = DEFAULT_GOLDEN,
             ensure_worker: bool = False,
             depth: int = 5,
             as_json: bool = False) -> Dict[str, Any]:
    """Run the golden query set against real memory through the hybrid path."""
    import memory_navigator
    import ensure_worker as watchdog

    golden = load_json(Path(golden_path))
    cases = []
    ranks = []
    latencies = []
    semantic_hits = 0
    matched_count = 0

    for case in golden["cases"]:
        started = time.perf_counter()
        try:
            results = memory_navigator.cmd_search(
                case["query"],
                project=case.get("project"),
                record_type=case.get("record_type"),
                limit=max(depth, case.get("target_rank", 3) + 2),
                as_json=True
            )
        except Exception as exc:  # noqa: BLE001 - one broken query must not abort the run
            results = []
            case = dict(case, error=str(exc))
        latency_ms = (time.perf_counter() - started) * 1000
        latencies.append(latency_ms)

        expected = set(case.get("expected_any") or [])
        rank = None
        matched = None
        for index, item in enumerate(results):
            if item.get("id") in expected:
                rank = index + 1
                matched = item
                break

        source_ok = True
        if matched:
            matched_count += 1
            if matched.get("source") in ("vector", "hybrid"):
                semantic_hits += 1
            if case.get("require_source"):
                source_ok = matched.get("source") in case["require_source"]

        cases.append({
            "id": case.get("id"),
            "query": case["query"],
            "expected_any": sorted(expected),
            "rank": rank,
            "target_rank": case.get("target_rank", 3),
            "matched_id": matched.get("id") if matched else None,
            "source": matched.get("source") if matched else None,
            "source_ok": source_ok,
            "returned": [item.get("id") for item in results],
            "note": case.get("note", "")
        })
        ranks.append(rank if (rank and source_ok) else None)

    # No-result cases: an honest retriever must return nothing on nonsense.
    empty_hits = 0
    no_result_cases = []
    for query in golden.get("no_result_cases", []):
        try:
            results = memory_navigator.cmd_search(query, limit=3, as_json=True)
        except Exception:  # noqa: BLE001
            results = []
        if not results:
            empty_hits += 1
        no_result_cases.append({
            "query": query,
            "returned": [item.get("id") for item in results],
            "empty": not results
        })

    total = len(cases) or 1
    no_result_total = len(no_result_cases) or 1
    metrics = {
        "recall_at_1": round(sum(rank == 1 for rank in ranks) / total, 4),
        "recall_at_3": round(sum(rank is not None and rank <= case["target_rank"]
                                for rank, case in zip(ranks, cases)) / total, 4),
        "mean_reciprocal_rank": round(
            sum(1 / rank if rank else 0 for rank in ranks) / total, 4),
        "no_result_precision": round(empty_hits / no_result_total, 4),
        "semantic_source_share": round(semantic_hits / (matched_count or 1), 4),
        "p95_latency_ms": percentile(latencies)
    }

    worker = watchdog.check()
    freshness = measure_index_freshness()
    metrics["index_freshness"] = freshness.get("worst_ratio", 0.0)
    if worker.get("unembedded_observations") is not None:
        metrics["unembedded_observations"] = worker["unembedded_observations"]
    metrics["worker_healthy"] = 1.0 if worker.get("healthy") else 0.0

    thresholds = golden.get("thresholds") or {}
    report = {
        "mode": "live",
        "note": "Measured against the real Cavemem database and LanceDB.",
        "golden_version": golden.get("version"),
        "worker": worker,
        "index_freshness": freshness,
        "cases": cases,
        "no_result_cases": no_result_cases,
        "metrics": metrics,
        "thresholds": thresholds,
        "violations": evaluate_metrics(metrics, thresholds)
    }
    if ensure_worker:
        report["worker"] = watchdog.ensure(wait_s=20)
    if not as_json:
        print(json.dumps(report, indent=2))
    return report


# ==============================================================================
# CLI
# ==============================================================================

def print_summary(report: Dict[str, Any]) -> None:
    metrics = report.get("metrics") or {}
    print("=" * 80)
    print(f" RETRIEVAL BENCHMARK — {report.get('mode', '?').upper()} MODE")
    print("=" * 80)
    print(f" {report.get('note', '')}")
    for key, value in metrics.items():
        print(f"  • {key:<24} : {value}")
    if report.get("mode") == "live":
        freshness = (report.get("index_freshness") or {}).get("ratios") or {}
        if freshness:
            print("  index freshness ratios   : "
                  + ", ".join(f"{k}={v}" for k, v in freshness.items()))
        failures = [case for case in report.get("cases", [])
                    if case.get("rank") is None or not case.get("source_ok")]
        if failures:
            print(f"\n  {len(failures)} case(s) not satisfied:")
            for case in failures:
                reason = ("wrong source" if case.get("rank") and not case.get("source_ok")
                          else "not found")
                print(f"    - [{case.get('id')}] {reason}: {case.get('query')}")
                print(f"      expected any of {case.get('expected_any')}, "
                      f"got {case.get('returned')}")
    if report.get("violations"):
        print("\n VIOLATIONS")
        for violation in report["violations"]:
            print(f"  ! {violation}")
    elif report.get("thresholds"):
        print("\n All thresholds met.")
    print("=" * 80)


def main(argv: Optional[list] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Retrieval plumbing check (default) or live retrieval quality gate"
    )
    parser.add_argument("--live", action="store_true",
                        help="Run the golden set against the real databases")
    parser.add_argument("--fixture", type=Path, default=DEFAULT_FIXTURE,
                        help="Synthetic fixture used by the plumbing check")
    parser.add_argument("--golden", type=Path, default=DEFAULT_GOLDEN,
                        help="Golden query set used by --live")
    parser.add_argument("--baseline", type=Path, default=DEFAULT_BASELINE,
                        help="Recorded metrics to compare against in --live mode")
    parser.add_argument("--update-baseline", action="store_true",
                        help="Write the current live metrics to the baseline file")
    parser.add_argument("--tolerance", type=float, default=0.05,
                        help="Allowed metric drop before a baseline regression fails")
    parser.add_argument("--ensure-worker", action="store_true",
                        help="Start the Cavemem worker when its heartbeat is stale")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON")
    args = parser.parse_args(argv)

    try:
        if args.live:
            if not Path(args.golden).exists():
                print(f"Golden set not found: {args.golden}", file=sys.stderr)
                return 2
            report = run_live(args.golden, ensure_worker=args.ensure_worker,
                              as_json=True)
        else:
            if not Path(args.fixture).exists():
                print(f"Fixture not found: {args.fixture}", file=sys.stderr)
                return 2
            report = run_benchmark(args.fixture, as_json=True)
    except Exception as exc:  # noqa: BLE001 - surfaced as a setup error
        print(f"Benchmark setup failed: {exc}", file=sys.stderr)
        return 2

    baseline = None
    baseline_path = Path(args.baseline)
    if args.live and baseline_path.exists():
        try:
            baseline = load_json(baseline_path)
        except (OSError, ValueError):
            baseline = None

    regressions = compare_baseline(report["metrics"], baseline, args.tolerance)
    report["baseline"] = {
        "path": str(baseline_path),
        "recorded_at": (baseline or {}).get("recorded_at"),
        "tolerance": args.tolerance,
        "violations": regressions,
        "present": baseline is not None
    }
    report["violations"] = list(report.get("violations") or []) + regressions

    if args.live and args.update_baseline:
        payload = {
            "version": 1,
            "mode": "live",
            "recorded_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "golden_version": report.get("golden_version"),
            "metrics": report["metrics"]
        }
        baseline_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print(f"Baseline updated: {baseline_path}")

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print_summary(report)

    if args.live and not baseline and not args.update_baseline:
        print(f"No baseline at {baseline_path}. Record one with --update-baseline.",
              file=sys.stderr)

    return 1 if report["violations"] else 0


if __name__ == "__main__":
    sys.exit(main())
