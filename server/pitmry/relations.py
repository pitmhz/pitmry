"""Read evidence-backed relations and keep search hints visibly separate."""

from __future__ import annotations

from datetime import datetime

from .enums import RelationProvenance, RelationType
from .models import RelationRecord


def explicit_relations(records, record_id=None):
    """Return canonical explicit relations, optionally touching ``record_id``."""
    result = []
    for record in records:
        if not isinstance(record, RelationRecord):
            continue
        if record.provenance is not RelationProvenance.explicit:
            continue
        if record_id is not None and record_id not in (
                record.source_record_id, record.target_record_id):
            continue
        result.append(record)
    return sorted(result, key=lambda edge: (edge.created_at, edge.id))


def inferred_relations(record_id, records, *, vector_neighbors=(), max_neighbors=8):
    """Build non-causal search hints from records already retrieved.

    This function never writes relations to the canonical store. Callers must
    serialize the returned edges under ``inferred``/``possibly_related``.
    """
    focal = records.get(record_id)
    if focal is None:
        return []
    neighbors = []
    vector_rank = {item_id: rank for rank, item_id in enumerate(vector_neighbors, 1)}
    for other_id, other in records.items():
        if other_id == record_id or other.project_id != focal.project_id:
            continue
        shared = sorted(set(focal.related_files) & set(other.related_files))
        relation = None
        metadata = {}
        if other_id in vector_rank:
            relation = RelationType.semantically_related
            metadata = {"algorithm": "vector-neighbor", "rank": vector_rank[other_id]}
        elif shared:
            relation = RelationType.shared_files
            metadata = {"algorithm": "shared-file-intersection", "files": shared[:8]}
        else:
            try:
                left = datetime.fromisoformat(focal.created_at)
                right = datetime.fromisoformat(other.created_at)
                seconds = abs((left - right).total_seconds())
            except (TypeError, ValueError):
                continue
            if seconds <= 24 * 60 * 60:
                relation = RelationType.temporal_neighbor
                metadata = {"algorithm": "same-day-window", "seconds": int(seconds)}
        if relation is not None:
            neighbors.append({
                "record_id": other_id,
                "relation": relation.value,
                "provenance": "inferred",
                "metadata": metadata,
            })
    neighbors.sort(key=lambda item: (
        0 if item["relation"] == RelationType.semantically_related.value else
        1 if item["relation"] == RelationType.shared_files.value else 2,
        item["metadata"].get("rank", 999), item["record_id"],
    ))
    return neighbors[:max_neighbors]


def relation_view(records, record_id, *, memory_records=None, vector_neighbors=()):
    """Return a stable explicit/inferred split for one record."""
    records = list(records)
    explicit = explicit_relations(records, record_id)
    all_memories = memory_records or {
        record.id: record for record in records
        if not isinstance(record, RelationRecord)
    }
    inferred = inferred_relations(record_id, all_memories,
                                  vector_neighbors=vector_neighbors)
    return {
        "explicit": [relation_payload(edge) for edge in explicit],
        "inferred": inferred,
    }


def relation_payload(edge):
    """Serialize a relation without erasing its evidence class."""
    return {
        "id": edge.id,
        "relation": edge.relation.value,
        "source_record_id": edge.source_record_id,
        "target_record_id": edge.target_record_id,
        "provenance": edge.provenance.value,
        "created_at": edge.created_at,
        "evidence_refs": list(edge.evidence_refs),
        "metadata": dict(edge.metadata),
    }
