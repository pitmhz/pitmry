"""Validate and atomically publish a disposable projection generation."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import tempfile
import uuid
from pathlib import Path

from .canonical_store import CanonicalStore
from .embeddings import EmbeddingUnavailable
from .sqlite_projection import initialize, integrity_check, project_record
from .vector_projection import project_records


def canonical_snapshot(records):
    digest = hashlib.sha256()
    for record in sorted(records, key=lambda item: item.id):
        digest.update(record.id.encode("utf-8"))
        digest.update(b"\0")
        digest.update(record.content_hash.encode("utf-8"))
        digest.update(b"\n")
    return digest.hexdigest()


def _publish_pointer(path, generation, metadata):
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps({"generation": generation, "published_at": metadata["projected_at"]},
                         sort_keys=True, indent=2).encode("utf-8") + b"\n"
    handle = tempfile.NamedTemporaryFile(mode="wb", dir=str(path.parent), prefix=".active-",
                                         suffix=".tmp", delete=False)
    temp = Path(handle.name)
    try:
        with handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp, path)
    except BaseException:
        temp.unlink(missing_ok=True)
        raise


def _reuse_matching_vectors(store, snapshot, target):
    """Reuse a verified old vector projection if local embedding is unavailable."""
    database = store.paths.sqlite_cache
    vector_dir = store.paths.lancedb_cache
    if not database.is_file() or not vector_dir.is_dir():
        return None
    import sqlite3
    try:
        with sqlite3.connect(f"file:{database.as_posix()}?mode=ro", uri=True) as conn:
            meta = dict(conn.execute("SELECT key,value FROM projection_meta"))
        if meta.get("canonical_snapshot") != snapshot:
            return None
        import lancedb
        db = lancedb.connect(str(vector_dir))
        if "records" not in db.table_names():
            return None
        count = db.open_table("records").count_rows()
        shutil.copytree(vector_dir, target)
        return {"count": count, "model": meta.get("embedding_model", "unknown"),
                "dimensions": meta.get("embedding_dimensions", "0")}
    except Exception:
        return None


def rebuild(root=None, no_vectors=False, embedder=None):
    store = CanonicalStore(root)
    problems = store.validate_all()
    if problems:
        raise ValueError("canonical validation failed: " + "; ".join(problems))
    records = store.load_all()
    from .project_intelligence import project_intelligence_doctor, project_sqlite_state
    pi_report = project_intelligence_doctor(store)
    if pi_report["errors"]:
        raise ValueError("Project Intelligence validation failed: " + "; ".join(
            f"{item['code']}:{item.get('record_id', '')}" for item in pi_report["errors"]))
    snapshot = canonical_snapshot(records)
    projected_at = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
    generation = uuid.uuid4().hex
    cache_root = store.paths.cache_dir
    staging_root = cache_root / ".staging" / generation
    final_root = cache_root / "generations" / generation
    staging_root.mkdir(parents=True, exist_ok=False)
    warnings = []
    vector_count = 0
    try:
        conn = initialize(staging_root / "pitmry.db")
        try:
            for record in records:
                project_record(conn, record)
            pi_projection = project_sqlite_state(conn, store)
            meta = {
                "schema_version": "1", "canonical_snapshot": snapshot,
                "canonical_record_count": str(len(records)), "embedding_model": "unavailable",
                "embedding_dimensions": "0", "projected_at": projected_at,
            }
            if not no_vectors:
                try:
                    vector_count = project_records(staging_root / "lancedb", records, embedder=embedder)
                    if vector_count:
                        from .embeddings import LocalEmbedder
                        active_embedder = embedder or LocalEmbedder()
                        meta["embedding_model"] = active_embedder.model_name
                        meta["embedding_dimensions"] = str(active_embedder.dimensions)
                    else:
                        reused = _reuse_matching_vectors(store, snapshot, staging_root / "lancedb")
                        if reused:
                            vector_count = reused["count"]
                            meta["embedding_model"] = reused["model"]
                            meta["embedding_dimensions"] = reused["dimensions"]
                            warnings.append("VECTOR_RETRIEVAL_REUSED_FROM_MATCHING_SNAPSHOT")
                        else:
                            warnings.append("VECTOR_RETRIEVAL_UNAVAILABLE")
                except EmbeddingUnavailable as exc:
                    reused = _reuse_matching_vectors(store, snapshot, staging_root / "lancedb")
                    if reused:
                        vector_count = reused["count"]
                        meta["embedding_model"] = reused["model"]
                        meta["embedding_dimensions"] = reused["dimensions"]
                        warnings.append("VECTOR_RETRIEVAL_REUSED_FROM_MATCHING_SNAPSHOT")
                    else:
                        warnings.append("VECTOR_RETRIEVAL_UNAVAILABLE: " + str(exc))
            else:
                warnings.append("VECTOR_RETRIEVAL_SKIPPED")
            conn.executemany("INSERT INTO projection_meta(key,value) VALUES (?,?)", meta.items())
            integrity_check(conn)
            conn.commit()
        finally:
            conn.close()
        final_root.parent.mkdir(parents=True, exist_ok=True)
        os.replace(staging_root, final_root)
        _publish_pointer(store.paths.active_pointer, generation, {"projected_at": projected_at})
    except BaseException:
        if staging_root.exists():
            shutil.rmtree(staging_root)
        raise
    return {"generation": generation, "records": len(records), "vectors": vector_count,
            "canonical_snapshot": snapshot, "warnings": warnings,
            "project_intelligence": pi_projection,
            "sqlite": final_root / "pitmry.db", "lancedb": final_root / "lancedb"}
