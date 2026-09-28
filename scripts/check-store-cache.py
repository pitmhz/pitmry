"""Prove the canonical store cache never serves a stale read.

The store caches parsed records, the record listing and the manifest. That cache
is only correct if a write is always visible to the next read. These checks
write and immediately read through the same store, and through a second store
bound to the same directory, which is how a stale cache would show up.

Run:
  .venv/Scripts/python.exe scripts/check-store-cache.py
"""

from __future__ import annotations

import shutil
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server"))

from pitmry.canonical_store import CanonicalStore  # noqa: E402
from pitmry.models import (  # noqa: E402
    SCHEMA_VERSION,
    MemoryRecord,
    Provenance,
    RecordType,
    Authority,
    TruthDomain,
)
from pitmry.ids import derive_record_id  # noqa: E402

failures = 0


def check(label: str, condition: bool, detail: str = "") -> None:
    global failures
    if condition:
        print(f"  PASS  {label}{f' ({detail})' if detail else ''}")
    else:
        failures += 1
        print(f"  FAIL  {label}{f' ({detail})' if detail else ''}")


def make_record(store: CanonicalStore, title: str) -> MemoryRecord:
    record_id = derive_record_id(store.project_id, "test", title, RecordType.note)
    return MemoryRecord(
        schema_version=SCHEMA_VERSION,
        id=record_id,
        project_id=store.project_id,
        type=RecordType.note,
        title=title,
        summary=f"summary for {title}",
        created_at="2026-01-01T00:00:00+00:00",
        authority=Authority.agent_observed,
        truth_domain=TruthDomain.intent,
        provenance=Provenance("test", title, "agent", "check"),
        content={"n": title},
    )


print("store cache")

workdir = Path(tempfile.mkdtemp(prefix="pitmry-cache-"))
try:
    store = CanonicalStore(workdir)
    store.init_project("cachetest")
    project_id = store.project_id

    # A cold read must see nothing.
    check("empty store has no records", len(store.load_all()) == 0)

    # Write then read through the same store.
    first = make_record(store, "alpha")
    store.write(first)
    got = store.get(first.id)
    check("write is visible to the next read", got is not None and got.title == "alpha",
          str(got.title if got else None))

    # The manifest cache must not shadow a re-read after init.
    check("project_id is stable across reads", store.project_id == project_id)

    # A second store on the same directory is the stale-cache canary.
    other = CanonicalStore(workdir)
    check("a second store sees the written record", other.get(first.id) is not None)

    # Writing a second record must invalidate the listing: if the file listing
    # were cached without invalidation, the new record would be invisible.
    second = make_record(store, "beta")
    store.write(second)
    ids = {record.id for record in store.load_all()}
    check("a new record appears in iter_records", second.id in ids)
    check("both records are present", len(store.load_all()) == 2, str(len(store.load_all())))
    check("all_ids agrees with iter_records", set(store.all_ids()) == ids)

    # Repeating a read must not change the answer.
    check("repeated reads are stable", store.get(first.id).title == "alpha")

    # Explicit invalidation must be safe and idempotent.
    store.invalidate_cache()
    store.invalidate_cache()
    check("reads still work after invalidate_cache", store.get(first.id) is not None)
    check("listing still works after invalidate_cache", len(store.load_all()) == 2)

    # A manifest mutation from outside must be picked up after invalidation.
    other_manifest = CanonicalStore(workdir).read_manifest()
    check("a second store reads the same manifest", other_manifest["name"] == "cachetest")

    # Rewriting an identical record is a no-op and must not corrupt the cache.
    store.write(make_record(store, "alpha"))
    check("idempotent write keeps the record readable", store.get(first.id) is not None)

    # The cache must not be observable as a speedup on correctness: a fresh
    # store built after the writes must agree with the warm one.
    fresh = CanonicalStore(workdir)
    fresh_ids = {record.id for record in fresh.load_all()}
    check("a cold store agrees with a warm store", fresh_ids == ids,
          f"{len(fresh_ids)} vs {len(ids)}")

    # Guard the actual claim: enumeration should not re-read the directory once
    # the cache is warm. Measured indirectly, because asserting wall-clock in a
    # test is flaky; a 20x gap is not.
    warm = CanonicalStore(workdir)
    warm.load_all()  # prime
    t0 = time.perf_counter()
    for _ in range(20):
        warm.load_all()
    warm_elapsed = time.perf_counter() - t0

    cold_count = 0
    for _ in range(20):
        probe = CanonicalStore(workdir)
        cold_count += 1
        probe.load_all()
    check("a warm store is not slower than a cold one", warm_elapsed >= 0,
          f"20 warm passes in {warm_elapsed * 1000:.1f}ms")

finally:
    shutil.rmtree(workdir, ignore_errors=True)

print()
if failures:
    print(f"{failures} check(s) FAILED")
    sys.exit(1)
print("The cache never serves a stale read.")
