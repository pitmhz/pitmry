"""Opt-in, fail-open Git hook adapters for Project Intelligence."""

from __future__ import annotations

import os
import shlex
import subprocess
import sys
from pathlib import Path

from .canonical_store import CanonicalStore
from .capture import capture_git_change
from .enums import RecordType
from .project_intelligence import verification_staleness


MARKER = "# PITMRY-MANAGED-POST-COMMIT"


def _hooks_directory(root: Path) -> Path:
    result = subprocess.run(["git", "-C", str(root), "rev-parse", "--git-path", "hooks"],
                            capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or "cannot locate the Git hooks directory")
    path = Path(result.stdout.strip())
    return path if path.is_absolute() else (root / path).resolve()


def install_post_commit(root=None) -> dict:
    store = CanonicalStore(root)
    hook = _hooks_directory(store.paths.root) / "post-commit"
    hook.parent.mkdir(parents=True, exist_ok=True)
    existing = hook.read_text(encoding="utf-8") if hook.exists() else ""
    if existing and MARKER not in existing:
        raise RuntimeError(f"existing post-commit hook was left untouched: {hook}")
    python = shlex.quote(sys.executable.replace("\\", "/"))
    project_root = shlex.quote(str(store.paths.root).replace("\\", "/"))
    content = ("#!/bin/sh\n" + MARKER + "\n" +
               f"{python} -m server.pitmry hook post-commit --root {project_root}\n" +
               "exit 0\n")
    hook.write_text(content, encoding="utf-8", newline="\n")
    if os.name != "nt":
        hook.chmod(0o755)
    return {"installed": True, "hook": str(hook), "fail_open": True}


def uninstall_post_commit(root=None) -> dict:
    store = CanonicalStore(root)
    hook = _hooks_directory(store.paths.root) / "post-commit"
    if not hook.exists():
        return {"removed": False, "hook": str(hook)}
    existing = hook.read_text(encoding="utf-8")
    if MARKER not in existing:
        raise RuntimeError(f"post-commit hook is not managed by PITMRY: {hook}")
    hook.unlink()
    return {"removed": True, "hook": str(hook)}


def post_commit(root=None) -> dict:
    """Capture observable Git state while ensuring a PITMRY failure never blocks Git."""
    try:
        store = CanonicalStore(root)
        git_record, _ = capture_git_change(store, "HEAD")
        stale = []
        for record in store.load_all():
            if record.type == RecordType.verification:
                outcome = verification_staleness(store, record.id, head="HEAD")
                if outcome["stale"]:
                    stale.append(record.id)
        return {"status": "OK", "git_record_id": git_record.id,
                "stale_verification_ids": stale}
    except Exception as exc:
        print(f"PITMRY post-commit capture skipped: {exc}", file=sys.stderr)
        return {"status": "DEGRADED", "warning": str(exc)}
