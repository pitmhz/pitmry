"""Independent health checks for canonical data and disposable projections."""

from __future__ import annotations

import json
import sqlite3
import subprocess

from .canonical_store import CanonicalStore


def doctor(root=None):
    store = CanonicalStore(root)
    checks = {"canonical": "unavailable", "sqlite": "unavailable",
              "fts": "unavailable", "vectors": "unavailable", "git": "unavailable"}
    warnings = []
    try:
        manifest = store.require_manifest()
        problems = store.validate_all()
        checks["canonical"] = "healthy" if not problems else "unhealthy"
        if problems:
            warnings.extend(f"CANONICAL_INVALID: {item}" for item in problems)
    except (OSError, ValueError) as exc:
        warnings.append(f"CANONICAL_UNAVAILABLE: {exc}")
        manifest = None

    if manifest:
        database = store.paths.sqlite_cache
        if database.is_file():
            try:
                with sqlite3.connect(f"file:{database.as_posix()}?mode=ro", uri=True) as conn:
                    integrity = conn.execute("PRAGMA integrity_check").fetchone()[0]
                    checks["sqlite"] = "healthy" if integrity == "ok" else "unhealthy"
                    if integrity != "ok":
                        warnings.append(f"SQLITE_INTEGRITY: {integrity}")
                    tables = {row[0] for row in conn.execute(
                        "SELECT name FROM sqlite_master WHERE type='table'")}
                    if "records_fts" in tables:
                        conn.execute("SELECT count(*) FROM records_fts").fetchone()
                        checks["fts"] = "healthy"
                    else:
                        checks["fts"] = "unavailable"
                        warnings.append("FTS_UNAVAILABLE")
            except (sqlite3.Error, OSError) as exc:
                checks["sqlite"] = "unhealthy"
                checks["fts"] = "unhealthy"
                warnings.append(f"SQLITE_CHECK_FAILED: {exc}")
        else:
            warnings.append("SQLITE_PROJECTION_MISSING")

        vector_path = store.paths.lancedb_cache
        if vector_path.is_dir():
            try:
                import lancedb
                database = lancedb.connect(str(vector_path))
                checks["vectors"] = "healthy" if "records" in database.table_names() else "unavailable"
                if checks["vectors"] == "unavailable":
                    warnings.append("VECTOR_RETRIEVAL_UNAVAILABLE")
            except Exception as exc:
                warnings.append(f"VECTOR_CHECK_FAILED: {exc}")
        else:
            warnings.append("VECTOR_RETRIEVAL_UNAVAILABLE")

    result = subprocess.run(["git", "-C", str(store.paths.root), "rev-parse", "--show-toplevel"],
                            capture_output=True, text=True)
    checks["git"] = "healthy" if result.returncode == 0 else "unavailable"
    if result.returncode:
        warnings.append("GIT_UNAVAILABLE")

    canonical_bad = checks["canonical"] in ("unavailable", "unhealthy")
    projection_bad = checks["sqlite"] == "unhealthy" or checks["fts"] == "unhealthy"
    status = "unhealthy" if canonical_bad or projection_bad else (
        "degraded" if warnings else "healthy")
    return {"status": status, **checks, "warnings": warnings}
