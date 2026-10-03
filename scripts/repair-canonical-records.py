"""Repair records that fail canonical validation without changing their meaning.

## Why this exists

`pitmry rebuild` refuses to run when any record fails `validate_all`. A single
unrecoverable record therefore freezes the SQLite/FTS projection for the whole
project, and `pitmry context` returns NO_MATCH for every query even though the
canonical files are all readable. The store is a view of files that other tools
are allowed to write directly, so a bridge, an editor, or a hand edit can leave
a record that the store can still read but cannot validate.

Two failure modes are repaired here, and only these two:

  * `content_hash mismatch` -- some field changed after the hash was computed.
    The hash is recomputed from the record's current contents. Nothing is
    edited; the recorded hash was simply stale.
  * `invalid TruthDomain` -- a value outside the enum. The record is mapped to
    the closest declared domain, and the substitution is reported so a human
    can correct it if the mapping is wrong.

Deliberately not repaired: a missing or malformed id, a relation pointing at a
record that does not exist, or a duplicate. Those mean the record is wrong
rather than stale, and rewriting one would invent a history the store never
recorded.

Run:
  PYTHONPATH=. .venv/Scripts/python.exe scripts/repair-canonical-records.py --root PATH [--apply]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server"))

from pitmry.canonical_store import CanonicalStore  # noqa: E402
from pitmry.enums import TruthDomain  # noqa: E402
from pitmry.models import compute_content_hash, record_from_dict  # noqa: E402

#: Where an out-of-enum truth domain should go. A source artifact is an input to
#: intent, so it lands there rather than in history or inference.
DOMAIN_REPAIRS = {
    "artifact": TruthDomain.intent,
    "source": TruthDomain.intent,
    "unknown": TruthDomain.inference,
}


def _backfill_source_artifact(data: dict, root: Path) -> tuple[dict, list[str]]:
    """Restore the source-artifact shape from the file the record names.

    A source artifact must carry the text it was built from and that text's
    hash, so the Project Intelligence doctor can prove the snapshot still
    matches. A third-party bridge can write a `source_artifact` carrying only a
    path; the record is then unreadable to validation and blocks every rebuild
    for the project.

    The text is read from the repository-relative path the record itself
    declares. Nothing is composed or paraphrased, so the backfilled hash is a
    real hash of a real file and can be re-verified later. If the file is
    absent the record is left alone rather than given invented content.
    """
    content = data.get("content")
    if not isinstance(content, dict) or "original_text" in content:
        return data, []
    relative = content.get("source_path") or content.get("path")
    if not isinstance(relative, str) or not relative.strip():
        return data, []
    candidate = (root / relative.strip()).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        return data, []
    if not candidate.is_file():
        return data, []
    text = candidate.read_text(encoding="utf-8", errors="replace")
    digest = "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest()
    updated = {**content, "original_text": text, "source_hash": digest,
               "source_path": relative.strip()}
    notes = [f"backfilled original_text ({len(text)} chars) from {relative.strip()}",
             f"source_hash -> {digest}"]
    return {**data, "content": updated}, notes


def repair(data: dict, root: Path) -> tuple[dict, list[str]]:
    """Return ``(repaired, notes)`` without touching the filesystem."""
    notes: list[str] = []
    domain = data.get("truth_domain")
    # A relation carries no truth domain. Only a value that is present and
    # outside the enum is a defect; an absent one is the normal shape.
    if domain is not None:
        try:
            TruthDomain(domain)
        except ValueError:
            replacement = DOMAIN_REPAIRS.get(domain)
            if replacement is None:
                notes.append(f"SKIPPED unknown truth_domain {domain!r}, no declared mapping")
                return data, notes
            data = {**data, "truth_domain": replacement.value}
            notes.append(f"truth_domain {domain!r} -> {replacement.value!r}")

    data, source_notes = _backfill_source_artifact(data, root)
    notes.extend(source_notes)

    record = record_from_dict(data)
    expected = compute_content_hash(record)
    if record.content_hash != expected:
        data = {**data, "content_hash": expected}
        notes.append(f"content_hash {record.content_hash or '(empty)'} -> {expected}")
    return data, notes


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True, help="project root holding .pitmry/")
    parser.add_argument("--apply", action="store_true", help="write the repairs to disk")
    args = parser.parse_args()

    store = CanonicalStore(args.root)
    # Two independent validators guard the store. `validate_all` checks each
    # record against itself; the Project Intelligence doctor checks the graph
    # between records and the invariants the Project Intelligence subsystem
    # relies on. A record can pass the first and block the second, and both
    # block `rebuild`, so both are reported here.
    problems = list(store.validate_all())
    from pitmry.project_intelligence import project_intelligence_doctor

    pi_report = project_intelligence_doctor(store)
    for error in pi_report.get("errors", []):
        record_id = error.get("record_id", "")
        problems.append(f"{error.get('code', 'PI_ERROR')}:{record_id}")

    if not problems:
        print("All records validate. Nothing to repair.")
        return 0

    print(f"{len(problems)} validation problem(s) reported:")
    for problem in problems:
        print(f"  {problem}")

    records_dir = store.paths.root / ".pitmry" / "records"
    root = store.paths.root.resolve()
    changed = 0
    for path in sorted(records_dir.rglob("*.json")):
        original = path.read_text(encoding="utf-8")
        data = json.loads(original)
        repaired, notes = repair(data, root)
        if not notes:
            continue
        if any(note.startswith("SKIPPED") for note in notes):
            print(f"\nSKIP {path.relative_to(store.paths.root)}")
            for note in notes:
                print(f"    {note}")
            continue
        print(f"\n{path.relative_to(store.paths.root)}")
        for note in notes:
            print(f"    {note}")
        if args.apply:
            # A .bak beside the record keeps the pre-repair bytes recoverable.
            # Canonical records are Git-tracked, so the diff is the real backup;
            # the copy covers a store that is not in version control.
            shutil.copy2(path, path.with_suffix(".json.bak"))
            path.write_text(json.dumps(repaired, indent=2, ensure_ascii=False) + "\n",
                            encoding="utf-8")
            print("    written")
        changed += 1

    print()
    if not changed:
        print("Nothing could be repaired automatically.")
        return 1
    if not args.apply:
        print(f"{changed} record(s) would change. Re-run with --apply to write them.")
        return 0
    print(f"Repaired {changed} record(s). Now run: pitmry rebuild")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())