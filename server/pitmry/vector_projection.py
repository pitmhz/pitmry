"""Optional LanceDB projection. SQLite remains usable without this module."""

from __future__ import annotations

from .embeddings import EmbeddingUnavailable, LocalEmbedder
from .models import RelationRecord


def build_embedding_text(record):
    if isinstance(record, RelationRecord):
        return ""
    content = record.content
    parts = [f"Type: {record.type.value}", f"Title: {record.title}",
             f"Summary: {record.summary}"]
    for label, key in (("Context", "context"), ("Decision", "decision"),
                       ("Rationale", "rationale"), ("Trade-offs", "trade_offs"),
                       ("Topic", "topic"), ("Takeaways", "takeaways"),
                       ("Symptom", "symptom"), ("Cause", "cause"),
                       ("Resolution", "resolution"), ("Open work", "open_work"),
                       ("Semantic summary", "semantic_summary")):
        value = content.get(key)
        if value:
            parts.append(f"{label}: {value}")
    if record.related_files:
        parts.append("Files: " + ", ".join(record.related_files))
    if record.tags:
        parts.append("Tags: " + ", ".join(record.tags))
    return "\n".join(parts)


def project_records(path, records, embedder=None):
    embedder = embedder or LocalEmbedder()
    vectors = []
    for record in records:
        if isinstance(record, RelationRecord):
            continue
        vectors.append({"id": record.id, "project_id": record.project_id,
                        "record_type": record.type.value, "title": record.title,
                        "summary": record.summary, "authority": record.authority.value,
                        "truth_domain": record.truth_domain.value,
                        "created_at": record.created_at, "content_hash": record.content_hash,
                        "embedding_model": embedder.model_name,
                        "vector": embedder.embed(build_embedding_text(record))})
    if not vectors:
        return 0
    try:
        import lancedb
        db = lancedb.connect(str(path))
        names = db.table_names()
        if "records" in names:
            db.drop_table("records")
        db.create_table("records", data=vectors)
        return len(vectors)
    except EmbeddingUnavailable:
        raise
    except Exception as exc:
        raise EmbeddingUnavailable(f"LanceDB projection failed: {exc}") from exc
