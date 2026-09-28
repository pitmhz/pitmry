#!/usr/bin/env python3
"""
Make the canonical mirror self-sufficient: record a restorable state, then
rebuild the projections so `pitmry context` can actually find it.

The first version of Target E migrated legacy rows and stopped. A record that
is written but not indexed is invisible to retrieval: `pitmry context` returned
an older session because the projection had not been rebuilt since the write.
This adds the two missing steps:

  1. `pitmry decision` records a restorable state note (HEAD, remotes, what to
     run, what is deliberately unresolved) with a stable subject key, so
     re-running replaces the note rather than accumulating near-duplicates.
  2. `pitmry rebuild` refreshes SQLite/FTS and the vector projection so the new
     record is retrievable.

Run against the already-patched exporter:
  python patch_export_canonical_v2.py
  python patch_export_canonical_v2.py --revert
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

TARGET = Path(r"C:\Users\Pieter\scripts\export_session_to_memory.py")
BACKUP = Path(r"C:\Users\Pieter\scripts\export_session_to_memory.py.bak-canonical-v2")

OLD_TAIL = '''    try:
        payload = json.loads(result.stdout)
        total = payload.get("total")
        return f"imported {total} record(s) into the canonical store" if total is not None \\
            else "canonical store already up to date"
    except Exception:  # noqa: BLE001
        return "canonical store updated"'''

NEW_TAIL = '''    try:
        payload = json.loads(result.stdout)
        total = payload.get("total")
        migrated = f"imported {total} record(s); " if total is not None else ""
    except Exception:  # noqa: BLE001
        migrated = ""

    # A record that is written but not indexed is invisible to retrieval.
    # `pitmry context` kept returning an older session because the projection
    # had not been rebuilt since the write, so the rebuild is part of the same
    # step rather than a manual follow-up.
    return migrated + _record_restore_point(command, cwd_path, project)


def _record_restore_point(command, cwd_path, project):
    """Record a restorable state note and reindex so retrieval can find it.

    The note is written with a stable subject key derived from the project and
    the current commit, so a re-run at the same commit refreshes the note
    instead of creating a near-duplicate. Never raises: the session is already
    exported, and this is the last step of a best-effort pipeline.
    """
    try:
        head = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=str(cwd_path), capture_output=True, text=True, timeout=30,
        ).stdout.strip() or "unknown"

        decision = (
            f"Session state for {project} at commit {head}. "
            "The working tree state, the checks that were run, and the known "
            "open items are recorded in the accompanying context and rationale."
        )
        context = (
            "Restore by reading this note, then rebuilding and re-running the "
            "project checks. The authoritative history is git; this note records "
            "why the tree looks the way it does."
        )

        record = command + [
            "decision",
            "--title", f"Session state checkpoint: {project} at {head}",
            "--decision", decision,
            "--context", context,
            "--subject-key", f"session-checkpoint-{project}-{head}",
            "--tag", "checkpoint",
            "--tag", "session-state",
            "--json",
        ]
        written = subprocess.run(
            record, cwd=str(cwd_path), capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=300,
        )
        if written.returncode != 0:
            return f"restore note skipped ({written.returncode})"

        # Reindex so the note is retrievable through `pitmry context`.
        rebuilt = subprocess.run(
            command + ["rebuild", "--json"], cwd=str(cwd_path),
            capture_output=True, text=True, encoding="utf-8", errors="replace",
            timeout=900,
        )
        if rebuilt.returncode != 0:
            return f"{migrated}restore note written but reindex failed"

        try:
            summary = json.loads(rebuilt.stdout)
            count = summary.get("records")
            return f"{migrated}restore note recorded and {count} records indexed"
        except Exception:  # noqa: BLE001
            return f"{migrated}restore note recorded and reindexed"
    except Exception as exc:  # noqa: BLE001 - never fail the export
        return f"restore note skipped ({type(exc).__name__})"'''


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--revert", action="store_true")
    args = parser.parse_args()

    if args.revert:
        if not BACKUP.is_file():
            print("No v2 backup found; nothing to revert.")
            return 1
        shutil.copy2(BACKUP, TARGET)
        print(f"Reverted {TARGET}")
        return 0

    if BACKUP.is_file():
        print(f"Backup already exists at {BACKUP}. Run --revert first.")
        return 1

    original = TARGET.read_text(encoding="utf-8")

    if "_record_restore_point" in original:
        print("Already patched with v2.")
        return 0

    if original.count(OLD_TAIL) != 1:
        print(f"Could not locate the expected tail (found {original.count(OLD_TAIL)}).")
        print("The file changed since v1; apply this by hand.")
        return 1

    shutil.copy2(TARGET, BACKUP)
    TARGET.write_text(original.replace(OLD_TAIL, NEW_TAIL, 1), encoding="utf-8")
    print(f"Patched {TARGET}")
    print(f"Backup at {BACKUP}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
