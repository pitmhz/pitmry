"""Benchmark PITMRY as an agent memory: write, recall, and rebuild cost.

An agent uses memory in two loops: store a fact, and recall it later. This
measures both against the real canonical store, because "it works" and "it is
fast enough to use in a loop" are different claims.

What it measures:
  * write throughput, including the fsync-per-record cost
  * point read latency (the cache in effect today)
  * full scan cost (what a cold reader pays)
  * retrieval latency via the real `pitmry context` path
  * rebuild cost, which an agent pays whenever it writes
  * scale behaviour: does anything degrade super-linearly?

Run:
  .venv/Scripts/python.exe scripts/bench-memory.py
"""

from __future__ import annotations

import json
import statistics
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server"))

from pitmry.canonical_store import CanonicalStore  # noqa: E402
from pitmry.models import (  # noqa: E402
    SCHEMA_VERSION,
    Authority,
    MemoryRecord,
    Provenance,
    RecordType,
    TruthDomain,
)
from pitmry.ids import derive_record_id  # noqa: E402

failures = 0
notes: list[str] = []


def check(label: str, condition: bool, detail: str = "") -> None:
    global failures
    if condition:
        print(f"  PASS  {label}{f' ({detail})' if detail else ''}")
    else:
        failures += 1
        print(f"  FAIL  {label}{f' ({detail})' if detail else ''}")


def make_record(store: CanonicalStore, index: int, bulk: int = 12) -> MemoryRecord:
    """A record with a realistic payload: a few hundred bytes of content."""
    body = {
        "index": index,
        "statement": f"Requirement {index} describes a behaviour the system must hold.",
        "rationale": "Derived from the accepted baseline decomposition of the product intent.",
        "detail": ("The agent must be able to recall this without re-deriving it from source. " * 3),
        "tags": [f"bulk-{index % 7}", "benchmark"],
    }
    rid = derive_record_id(store.project_id, "bench", f"{bulk}:{index}", RecordType.requirement)
    return MemoryRecord(
        schema_version=SCHEMA_VERSION,
        id=rid,
        project_id=store.project_id,
        type=RecordType.requirement,
        title=f"Benchmark requirement {index}",
        summary=f"Synthetic requirement {index} used to measure store throughput.",
        created_at="2026-01-01T00:00:00+00:00",
        authority=Authority.agent_observed,
        truth_domain=TruthDomain.intent,
        provenance=Provenance("benchmark", str(index), "agent", "bench-memory"),
        content=body,
    )


def timed(fn):
    start = time.perf_counter()
    result = fn()
    return result, time.perf_counter() - start


def main() -> int:
    workdir = Path(tempfile.mkdtemp(prefix="pitmry-bench-"))
    print("PITMRY memory benchmark")
    print(f"  workdir: {workdir}")
    print()

    store = CanonicalStore(workdir)
    store.init_project("bench")

    # ---------------------------------------------------------------- write
    print("write throughput (the cost of remembering something)")
    counts = [200, 400, 800]
    per_record: list[float] = []
    written = 0
    for target in counts:
        start = time.perf_counter()
        while written < target:
            store.write(make_record(store, written))
            written += 1
        elapsed = time.perf_counter() - start
        added = written - (counts[counts.index(target) - 1] if counts.index(target) else 0)
        rate = added / elapsed
        per_record.append(elapsed / max(added, 1))
        print(f"  {written:>4} records  {elapsed:6.2f}s total  {rate:7.0f} rec/s  "
              f"{elapsed / max(added, 1) * 1000:5.2f} ms/record")

    check("write rate is usable inside an agent loop", per_record[-1] < 0.050,
          f"{per_record[-1] * 1000:.2f} ms/record")
    # A super-linear cost would mean the store degrades as it grows, which is
    # the failure that only shows up once the memory is actually useful.
    first, last = per_record[0], per_record[-1]
    check("per-record cost does not grow super-linearly", last < first * 3.0,
          f"{first * 1000:.2f} ms -> {last * 1000:.2f} ms")

    # ----------------------------------------------------------------- read
    print()
    print("read latency (the cost of recalling something)")
    ids = [r.id for r in store.load_all()]

    warm = CanonicalStore(workdir)
    warm.load_all()
    _, warm_point = timed(lambda: [warm.get(i) for i in ids[:200]])
    print(f"  point read, warm cache   {warm_point * 1000:7.2f} ms for 200  "
          f"({warm_point / 200 * 1e6:.0f} us/record)")

    cold = CanonicalStore(workdir)
    _, cold_point = timed(lambda: [cold.get(i) for i in ids[:200]])
    print(f"  point read, cold cache   {cold_point * 1000:7.2f} ms for 200  "
          f"({cold_point / 200 * 1e6:.0f} us/record)")

    check("warm point read is fast", warm_point / 200 < 0.001,
          f"{warm_point / 200 * 1e6:.0f} us/record")
    check("cold point read is acceptable", cold_point / 200 < 0.010,
          f"{cold_point / 200 * 1e6:.0f} us/record")

    warm2 = CanonicalStore(workdir)
    warm2.load_all()
    _, scan = timed(lambda: warm2.load_all())
    print(f"  full scan, warm cache    {scan * 1000:7.2f} ms for {len(ids)}")
    check("full scan stays well under a second", scan < 1.0, f"{scan * 1000:.0f} ms")

    # -------------------------------------------------------------- rebuild
    print()
    print("rebuild (paid by the agent after it writes)")
    _, rebuild = timed(
        lambda: subprocess.run(
            [sys.executable, "-m", "server.pitmry", "rebuild", "--no-vectors", "--json"],
            cwd=str(ROOT), capture_output=True, text=True, encoding="utf-8",
            errors="replace", timeout=600,
        )
    )
    print(f"  rebuild --no-vectors     {rebuild:6.2f}s")
    check("rebuild is fast enough to run after a write burst", rebuild < 15.0,
          f"{rebuild:.1f}s")

    # ------------------------------------------------------------ retrieval
    print()
    print("retrieval through the real context path")
    venv_python = ROOT / ".venv" / "Scripts" / "python.exe"
    base = [str(venv_python), "-m", "server.pitmry"] if venv_python.is_file() else [sys.executable, "-m", "server.pitmry"]
    for query in ("session state checkpoint", "requirement acceptance criteria"):
        start = time.perf_counter()
        out = subprocess.run(
            base + ["context", query, "--limit", "5", "--json"],
            cwd=str(ROOT), capture_output=True, text=True, encoding="utf-8",
            errors="replace", timeout=300,
        )
        elapsed = time.perf_counter() - start
        status = "?"
        if out.returncode == 0:
            try:
                status = json.loads(out.stdout).get("status", "?")
            except Exception:
                status = "unparseable"
        print(f"  context {query[:34]:36s} {elapsed:5.2f}s  status={status}")
        check(f"retrieval answers for {query[:24]!r}", status != "?" and out.returncode == 0, status)

    print()
    print(f"records written: {written}")
    print(f"median per-record write: {statistics.median(per_record) * 1000:.2f} ms")
    for note in notes:
        print(f"  note: {note}")
    print()
    if failures:
        print(f"{failures} benchmark expectation(s) FAILED")
        return 1
    print("Store and recall costs are usable inside an agent loop.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
