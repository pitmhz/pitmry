#!/usr/bin/env python3
"""
Add a canonical-memory target to export_session_to_memory.py.

The exporter writes to Cavemem SQLite and LanceDB, but the PITMRY dashboard
reads the canonical store under `.pitmry/records/`. Those are separate systems,
so a session could be fully exported and still be invisible in the dashboard.

PITMRY ships `pitmry migrate-legacy` for exactly this bridge. This adds it as
Target E: conditional on the project actually being PITMRY-initialised, scoped
to that one project, and non-fatal so it can never fail an export that already
succeeded.

Usage:
  python patch_export_canonical.py
  python patch_export_canonical.py --revert
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

TARGET = Path(r"C:\Users\Pieter\scripts\export_session_to_memory.py")

# The canonical bridge, inserted after Target D succeeds and before the closing
# banner. Injected as a call so the failure handling lives in one place.
ANCHOR = '    print(f"✓ Target D: Synced and embedded in LanceDB (~/.strategic_memory/lancedb)")'

BLOCK = '''    print(f"\\u2713 Target D: Synced and embedded in LanceDB (~/.strategic_memory/lancedb)")

    # 5. Target E: Mirror into the PITMRY canonical store
    # The dashboard reads .pitmry/records/, which is a different system from
    # Cavemem and LanceDB. Without this step a session can be fully exported
    # and still be invisible in the dashboard. Every failure here is swallowed:
    # the export has already succeeded, and a project that is not PITMRY-
    # initialised is the normal case, not an error.
    _migrate_to_canonical(cwd_path, project)'''


HELPER = '''

def _migrate_to_canonical(cwd_path, project):
    """Mirror the just-exported session into the PITMRY canonical store.

    The dashboard reads canonical records from ``.pitmry/records/``, which is a
    separate system from Cavemem SQLite and LanceDB. ``pitmry migrate-legacy``
    is the supported bridge, but it is only meaningful for a PITMRY-initialised
    project, so this is a no-op everywhere else.

    Returns a short status string for the caller to print. Never raises: the
    session is already recorded in the other targets, so a failure here must not
    turn a successful export into an error.
    """
    if not project:
        return "skipped (no project label)"

    manifest = Path(cwd_path) / ".pitmry" / "manifest.json"
    if not manifest.is_file():
        return "skipped (not a PITMRY project)"

    repo_root = Path(cwd_path).resolve().parents[1]
    api_script = repo_root / "server" / "memory_dashboard_api.py"
    pitmry_cli = repo_root / "server" / "pitmry"
    if not pitmry_cli.is_dir():
        return "skipped (no PITMRY backend in this repository)"

    venv_python = repo_root / ".venv" / "Scripts" / "python.exe"
    if venv_python.is_file():
        command = [str(venv_python), "-m", "server.pitmry"]
    else:
        command = [sys.executable, "-m", "server.pitmry"]

    # --json keeps the summary machine-readable rather than scraping stdout.
    command += [
        "migrate-legacy",
        "--db", str(Path.home() / ".cavemem" / "data.db"),
        "--project", project,
        "--json",
    ]

    try:
        result = subprocess.run(
            command,
            cwd=str(repo_root),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=300,
        )
    except Exception as exc:  # noqa: BLE001 - never fail the export
        return f"skipped ({type(exc).__name__})"

    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip().splitlines()
        tail = detail[-1][:70] if detail else "no output"
        return f"skipped ({tail})"

    try:
        payload = json.loads(result.stdout)
        total = payload.get("total")
        return f"imported {total} record(s) into the canonical store" if total is not None \\
            else "canonical store already up to date"
    except Exception:  # noqa: BLE001
        return "canonical store updated"
'''


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--revert", action="store_true", help="Restore the backup instead of patching")
    args = parser.parse_args()

    backup = TARGET.with_suffix(".py.bak-canonical")

    if args.revert:
        if not backup.is_file():
            print("No backup found; nothing to revert.")
            return 1
        shutil.copy2(backup, TARGET)
        print(f"Reverted {TARGET} from {backup}")
        return 0

    if backup.is_file():
        print(f"Backup already exists at {backup}. Refusing to overwrite it.")
        print("Run with --revert first if you want to start clean.")
        return 1

    original = TARGET.read_text(encoding="utf-8")

    if ANCHOR not in original:
        print(f"Could not find the Target D anchor in {TARGET}.")
        print("The file may have changed. Re-apply the patch by hand.")
        return 1

    if "_migrate_to_canonical" in original:
        print("Already patched.")
        return 0

    # Helper goes after the imports, before the first function definition.
    first_def = original.index("def get_git_info")
    patched = original[:first_def] + HELPER.lstrip("\n") + "\n\n" + original[first_def:]
    patched = patched.replace(ANCHOR, BLOCK, 1)

    shutil.copy2(TARGET, backup)
    TARGET.write_text(patched, encoding="utf-8")
    print(f"Patched {TARGET}")
    print(f"Backup at {backup}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
