"""Deterministic FTS5 + optional vector retrieval for canonical records."""

from __future__ import annotations

import re
import sqlite3
import os
import math

from .canonical_store import CanonicalStore
from .embeddings import EmbeddingUnavailable, LocalEmbedder
from .models import MemoryRecord, RelationRecord

_TOKEN = re.compile(r"[A-Za-z0-9_./:-]+")
_RECORD_ID = re.compile(r"^(?:dec|con|git|dis|obs|fail|chk|sum|test|dep|note|rel)_[0-9a-f]{24}$")
_RECORD_ID_IN_TEXT = re.compile(r"(?:dec|con|git|dis|obs|fail|chk|sum|test|dep|note|rel)_[0-9a-f]{24}", re.I)
_SHA = re.compile(r"^(?:[0-9a-f]{7,40})$", re.IGNORECASE)
_SHA_IN_TEXT = re.compile(r"(?<![0-9a-f])[0-9a-f]{7,40}(?![0-9a-f])", re.I)
_CURRENT = re.compile(r"\b(current|currently|now|active|what are we using)\b", re.I)
_HISTORICAL = re.compile(r"\b(original|previous|before|history|historical|why did we)\b", re.I)
_EXACT_PATH = re.compile(r"(?:^|\s)(?:[A-Za-z]:)?(?:[\w.-]+[/\\])+[\w.-]+(?:\s|$)")


def sanitize_query(query):
    tokens = _TOKEN.findall(str(query or ""))
    stop = {"a", "an", "and", "are", "before", "current", "currently", "did",
            "do", "for", "history", "historical", "how", "i", "is", "it",
            "now", "of", "on", "or", "original", "previous", "the", "to",
            "use", "using", "we", "what", "why", "with", "active"}
    tokens = [token for token in tokens
              if token.lower() not in stop and any(char.isalnum() for char in token)]
    return " ".join(f'"{token.replace(chr(34), chr(34) * 2)}"' for token in tokens)


def classify_query(query):
    value = str(query or "").strip()
    if _exact_lookup_value(value) is not None or _EXACT_PATH.search(value):
        return "EXACT"
    if _HISTORICAL.search(value):
        return "HISTORICAL"
    if _CURRENT.search(value):
        return "CURRENT"
    return "GENERAL"


def _exact_lookup_value(query):
    value = str(query or "").strip()
    if _RECORD_ID.fullmatch(value) or _SHA.fullmatch(value):
        return value
    record_id = _RECORD_ID_IN_TEXT.search(value)
    if record_id:
        return record_id.group(0)
    sha = _SHA_IN_TEXT.search(value)
    if sha:
        return sha.group(0)
    path = _EXACT_PATH.search(value)
    return path.group(0).strip().rstrip("?.!,") if path else None


def _fts_candidates(db_path, query, project_id, limit):
    match = sanitize_query(query)
    if not match:
        return []
    conn = sqlite3.connect(str(db_path))
    try:
        rows = conn.execute(
            "SELECT r.id, bm25(records_fts) AS rank "
            "FROM records_fts JOIN records r ON r.id=records_fts.id "
            "WHERE records_fts MATCH ? AND r.project_id=? "
            "ORDER BY rank ASC, r.id ASC LIMIT ?",
            (match, project_id, int(limit)),
        ).fetchall()
        return [row[0] for row in rows]
    finally:
        conn.close()


def _exact_candidates(records, query, project_id):
    query = str(query or "").strip()
    if not query:
        return []
    lookup = _exact_lookup_value(query)
    if lookup is not None:
        query = lookup
    by_id = [record.id for record in records
             if record.project_id == project_id and record.id == query]
    if by_id:
        return by_id
    if _SHA.fullmatch(query):
        return [record.id for record in records
                if record.project_id == project_id
                and getattr(record, "content", {}).get("commit_sha", "").lower().startswith(query.lower())]
    normalized = query.replace("\\", "/").strip(" /")
    return [record.id for record in records if record.project_id == project_id and
            (normalized in [path.replace("\\", "/").strip(" /") for path in record.related_files]
             or normalized in [str(path).replace("\\", "/").strip(" /")
                               for path in record.content.get("changed_files", [])])]


def _vector_candidates(store, query, project_id, limit, embedder):
    if not query or not store.paths.lancedb_cache.is_dir():
        raise EmbeddingUnavailable("vector projection is unavailable")
    embedder = embedder or LocalEmbedder()
    vector = embedder.embed(query)
    import lancedb
    table = lancedb.connect(str(store.paths.lancedb_cache)).open_table("records")
    # Project ids are validated canonical identifiers, so this expression has
    # no user-controlled SQL/Lance syntax.
    escaped_project = project_id.replace("'", "''")
    rows = (table.search(vector).where(f"project_id = '{escaped_project}'", prefilter=True)
            .limit(int(limit)).to_list())
    ranked = []
    similarities = {}
    floor = float(os.environ.get("PITMRY_VECTOR_SIMILARITY_FLOOR", "0.35"))
    if not math.isfinite(floor) or not 0 <= floor <= 1:
        raise ValueError("PITMRY_VECTOR_SIMILARITY_FLOOR must be between 0 and 1")
    for row in rows:
        distance = row.get("_distance")
        # Vectors are unit-normalized; Lance's L2 distance maps to cosine
        # similarity as 1 - d^2/2. Clamp for metric/backend differences.
        if distance is None:
            continue
        similarity = max(-1.0, min(1.0, 1.0 - float(distance) / 2.0))
        if similarity < floor:
            continue
        ranked.append(row["id"])
        similarities[row["id"]] = similarity
    return ranked, similarities


def retrieve(query, *, root=None, project_id=None, limit=10, include_vectors=True,
             embedder=None, rrf_k=60):
    """Return ranked records with independent ranks and retrieval reasons."""
    if isinstance(limit, bool) or int(limit) < 1:
        raise ValueError("limit must be a positive integer")
    if isinstance(rrf_k, bool) or int(rrf_k) < 1:
        raise ValueError("rrf_k must be a positive integer")
    store = CanonicalStore(root)
    manifest = store.require_manifest()
    project_id = project_id or manifest["project_id"]
    records = [record for record in store.load_all()
               if isinstance(record, MemoryRecord) and record.project_id == project_id]
    exact_lookup = _exact_lookup_value(query)
    exact_ids = _exact_candidates(records, query, project_id)
    exact_ambiguous = len(exact_ids) > 1 and exact_lookup is not None and \
        _SHA.fullmatch(exact_lookup) is not None
    try:
        lexical_ids = _fts_candidates(store.paths.sqlite_cache, query, project_id, max(limit * 4, 40))
    except (sqlite3.Error, OSError) as exc:
        lexical_ids = []
        warnings = ["LEXICAL_RETRIEVAL_UNAVAILABLE: " + str(exc)]
    else:
        warnings = []
    vector_ids = []
    vector_similarities = {}
    if include_vectors:
        try:
            vector_ids, vector_similarities = _vector_candidates(
                store, query, project_id, max(limit * 4, 40), embedder)
        except (EmbeddingUnavailable, OSError, RuntimeError, ImportError, ValueError) as exc:
            warnings.append("VECTOR_RETRIEVAL_UNAVAILABLE: " + str(exc))
    else:
        warnings.append("VECTOR_RETRIEVAL_SKIPPED")

    ranks = {}
    for signal, ids in (("lexical", lexical_ids), ("vector", vector_ids)):
        for rank, record_id in enumerate(ids, 1):
            entry = ranks.setdefault(record_id, {"lexical_rank": None, "vector_rank": None,
                                                  "rrf_score": 0.0, "reasons": []})
            entry[f"{signal}_rank"] = rank
            entry["rrf_score"] += 1.0 / (rrf_k + rank)
            entry["reasons"].append(f"{signal}_rank:{rank}")
            if signal == "vector":
                entry["vector_similarity"] = vector_similarities.get(record_id)
    for record_id in exact_ids:
        entry = ranks.setdefault(record_id, {"lexical_rank": None, "vector_rank": None,
                                              "rrf_score": 0.0, "reasons": []})
        entry["exact_match"] = True
        entry["reasons"].insert(0, "exact_id_sha_or_path_match")

    by_id = {record.id: record for record in records}
    ordered = sorted(ranks, key=lambda record_id: (
        not ranks[record_id].get("exact_match", False),
        -ranks[record_id]["rrf_score"], record_id,
    ))
    return {
        "query": query,
        "mode": classify_query(query),
        "project_id": project_id,
        "records": [by_id[record_id] for record_id in ordered[:limit] if record_id in by_id],
        "signals": {record_id: ranks[record_id] for record_id in ordered[:limit]},
        "lexical_ids": lexical_ids,
        "vector_ids": vector_ids,
        "exact_ids": exact_ids,
        "vector_similarities": vector_similarities,
        "ambiguous": exact_ambiguous,
        "warnings": warnings,
    }
