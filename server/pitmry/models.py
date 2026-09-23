"""Canonical record schema.

Records are immutable. A change to an earlier belief is a new record plus a
relation, not a silent rewrite of the old one. That is what lets `.pitmry/`
be the durable source of truth while every database stays disposable.

Standard-library dataclasses only. No Pydantic and no other dependency is
introduced by this migration phase.
"""

from __future__ import annotations

import datetime as _dt
from dataclasses import dataclass, field
from typing import Any, Dict, Optional, Tuple

from .enums import (
    Authority,
    RecordType,
    RelationProvenance,
    RelationType,
    TruthDomain,
    is_explicit_relation,
    is_inferred_relation,
)
from .ids import validate_project_id, validate_record_id

SCHEMA_VERSION = 1


def utc_now_iso() -> str:
    """Timezone-aware ISO-8601 timestamp with a UTC offset."""
    return _dt.datetime.now(_dt.timezone.utc).isoformat()


def normalize_timestamp(value: Any) -> str:
    """Return ``value`` as a timezone-aware ISO-8601 string.

    Naive timestamps are rejected. A record that claims when it was created
    must say where, or the temporal resolver cannot reason about it.
    """
    if not isinstance(value, str) or not value.strip():
        raise ValueError("timestamp must be a non-empty ISO-8601 string")
    try:
        parsed = _dt.datetime.fromisoformat(value.strip())
    except ValueError as exc:
        raise ValueError(f"invalid ISO-8601 timestamp: {value!r}") from exc
    if parsed.tzinfo is None:
        raise ValueError(
            f"timestamp must be timezone-aware: {value!r} "
            "(use an explicit UTC offset)"
        )
    return parsed.isoformat()


def _require_text(value: Any, name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{name} must be a non-empty string")
    return value


def _as_tuple(value: Any, name: str) -> Tuple:
    """Normalize a list-like field, rejecting a lone string.

    A single string is almost always a mistake: `related_files: "a.py"` would
    serialize as `["a", ".", "p", "y"]` downstream.
    """
    if value is None:
        return ()
    if isinstance(value, str):
        raise ValueError(f"{name} must be a list, not a single string")
    return tuple(value)


@dataclass(frozen=True)
class Provenance:
    """Where a record came from, and who captured and originated it."""

    source_type: str
    source_id: str
    originator: str
    captured_by: str
    source_commit: Optional[str] = None
    evidence_refs: Tuple = ()

    def __post_init__(self) -> None:
        for name in ("source_type", "source_id", "originator", "captured_by"):
            _require_text(getattr(self, name), f"provenance.{name}")
        object.__setattr__(self, "evidence_refs", _as_tuple(self.evidence_refs, "provenance.evidence_refs"))


@dataclass(frozen=True)
class MemoryRecord:
    """One durable statement about a project.

    ``content`` carries the type-specific payload. For a decision that is
    context/decision/rationale/trade-off text; for a git_change it is the
    objective commit fields. Keeping it a plain mapping lets new record types
    arrive through schema evolution without a migration here.
    """

    schema_version: int
    id: str
    project_id: str
    type: RecordType
    title: str
    summary: str
    created_at: str
    authority: Authority
    truth_domain: TruthDomain
    provenance: Provenance
    content: Dict[str, Any] = field(default_factory=dict)
    related_files: Tuple = ()
    related_symbols: Tuple = ()
    tags: Tuple = ()
    content_hash: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if (isinstance(self.schema_version, bool)
                or not isinstance(self.schema_version, int)
                or self.schema_version != SCHEMA_VERSION):
            raise ValueError(
                f"schema_version must be {SCHEMA_VERSION}, got {self.schema_version!r}"
            )
        for name in ("title", "summary"):
            _require_text(getattr(self, name), name)
        validate_project_id(self.project_id)
        if not isinstance(self.content, dict):
            raise ValueError("content must be a mapping")
        if not isinstance(self.metadata, dict):
            raise ValueError("metadata must be a mapping")
        if not isinstance(self.provenance, Provenance):
            raise ValueError("provenance must be a Provenance instance")
        for name in ("related_files", "related_symbols", "tags"):
            object.__setattr__(self, name, _as_tuple(getattr(self, name), name))
        object.__setattr__(self, "type", RecordType.coerce(self.type))
        object.__setattr__(self, "authority", Authority.coerce(self.authority))
        object.__setattr__(self, "truth_domain", TruthDomain.coerce(self.truth_domain))
        object.__setattr__(self, "created_at", normalize_timestamp(self.created_at))
        validate_record_id(self.id, self.type)


@dataclass(frozen=True)
class RelationRecord:
    """An edge between two records.

    ``provenance`` says whether the edge is evidence or a search hint. The
    two are never interchangeable: an inferred relation cannot change
    resolved state or explain a decision.
    """

    schema_version: int
    id: str
    project_id: str
    relation: RelationType
    source_record_id: str
    target_record_id: str
    provenance: RelationProvenance
    created_at: str
    evidence_refs: Tuple = ()
    metadata: Dict[str, Any] = field(default_factory=dict)
    content_hash: str = ""
    type: RecordType = RecordType.relation

    def __post_init__(self) -> None:
        if (isinstance(self.schema_version, bool)
                or not isinstance(self.schema_version, int)
                or self.schema_version != SCHEMA_VERSION):
            raise ValueError(
                f"schema_version must be {SCHEMA_VERSION}, got {self.schema_version!r}"
            )
        validate_project_id(self.project_id)
        for name in ("source_record_id", "target_record_id"):
            _require_text(getattr(self, name), name)
        if not isinstance(self.metadata, dict):
            raise ValueError("metadata must be a mapping")
        object.__setattr__(self, "type", RecordType.coerce(self.type))
        object.__setattr__(self, "relation", RelationType.coerce(self.relation))
        object.__setattr__(self, "provenance", RelationProvenance.coerce(self.provenance))
        object.__setattr__(self, "created_at", normalize_timestamp(self.created_at))
        object.__setattr__(self, "evidence_refs", _as_tuple(self.evidence_refs, "evidence_refs"))

        if self.type is not RecordType.relation:
            raise ValueError("a RelationRecord must have type 'relation'")
        validate_record_id(self.id, RecordType.relation)
        validate_record_id(self.source_record_id)
        validate_record_id(self.target_record_id)
        if self.source_record_id == self.target_record_id:
            raise ValueError(
                "a record cannot supersede, revert, or implement itself "
                f"({self.source_record_id})"
            )
        # An inferred edge must never be dressed up as an explicit one.
        if self.provenance is RelationProvenance.explicit:
            if not is_explicit_relation(self.relation):
                raise ValueError(
                    f"relation {self.relation.value!r} is inferred and cannot be "
                    "marked explicit"
                )
        elif not is_inferred_relation(self.relation):
            raise ValueError(
                f"relation {self.relation.value!r} is explicit evidence and cannot "
                "be marked inferred"
            )
        if self.provenance is RelationProvenance.inferred and not self.metadata.get("algorithm"):
            raise ValueError(
                "an inferred relation must record the algorithm that produced it"
            )


# --- serialization ----------------------------------------------------------


def _is_relation(record: Any) -> bool:
    return isinstance(record, RelationRecord)


def record_to_dict(record) -> Dict[str, Any]:
    """Return the canonical JSON shape of a record or relation."""
    if _is_relation(record):
        return {
            "schema_version": record.schema_version,
            "id": record.id,
            "project_id": record.project_id,
            "type": RecordType.relation.value,
            "relation": record.relation.value,
            "source_record_id": record.source_record_id,
            "target_record_id": record.target_record_id,
            "provenance": record.provenance.value,
            "created_at": record.created_at,
            "evidence_refs": list(record.evidence_refs),
            "metadata": dict(record.metadata),
            "content_hash": record.content_hash,
        }

    if isinstance(record, MemoryRecord):
        return {
            "schema_version": record.schema_version,
            "id": record.id,
            "project_id": record.project_id,
            "type": record.type.value,
            "title": record.title,
            "summary": record.summary,
            "created_at": record.created_at,
            "authority": record.authority.value,
            "truth_domain": record.truth_domain.value,
            "provenance": {
                "source_type": record.provenance.source_type,
                "source_id": record.provenance.source_id,
                "source_commit": record.provenance.source_commit,
                "originator": record.provenance.originator,
                "captured_by": record.provenance.captured_by,
                "evidence_refs": list(record.provenance.evidence_refs),
            },
            "content": dict(record.content),
            "related_files": list(record.related_files),
            "related_symbols": list(record.related_symbols),
            "tags": list(record.tags),
            "metadata": dict(record.metadata),
            "content_hash": record.content_hash,
        }

    raise TypeError(f"cannot serialize {type(record).__name__}")


def record_from_dict(data: Dict[str, Any]):
    """Rebuild a record or relation from its canonical JSON shape."""
    if not isinstance(data, dict):
        raise ValueError("record payload must be a mapping")

    forbidden_state_fields = {"status", "superseded", "reverted", "conflicting"} & data.keys()
    if forbidden_state_fields:
        names = ", ".join(sorted(forbidden_state_fields))
        raise ValueError(f"canonical records cannot declare derived state fields: {names}")

    if "relation" in data and "source_record_id" in data:
        return RelationRecord(
            schema_version=data["schema_version"],
            id=data["id"],
            project_id=data["project_id"],
            relation=data["relation"],
            source_record_id=data["source_record_id"],
            target_record_id=data["target_record_id"],
            provenance=data["provenance"],
            created_at=data["created_at"],
            evidence_refs=tuple(data.get("evidence_refs") or ()),
            metadata=dict(data.get("metadata") or {}),
            content_hash=data.get("content_hash", ""),
            type=data.get("type", RecordType.relation),
        )

    missing = [
        key for key in (
            "schema_version", "id", "project_id", "type", "title", "summary",
            "created_at", "authority", "truth_domain", "provenance",
        )
        if key not in data
    ]
    if missing:
        raise ValueError(f"record is missing required fields: {', '.join(missing)}")
    provenance = data["provenance"]
    if not isinstance(provenance, dict):
        raise ValueError("provenance must be a mapping")

    return MemoryRecord(
        schema_version=data["schema_version"],
        id=data["id"],
        project_id=data["project_id"],
        type=data["type"],
        title=data["title"],
        summary=data["summary"],
        created_at=data["created_at"],
        authority=data["authority"],
        truth_domain=data["truth_domain"],
        provenance=Provenance(
            source_type=provenance.get("source_type", ""),
            source_id=provenance.get("source_id", ""),
            originator=provenance.get("originator", ""),
            captured_by=provenance.get("captured_by", ""),
            source_commit=provenance.get("source_commit"),
            evidence_refs=tuple(provenance.get("evidence_refs") or ()),
        ),
        content=dict(data.get("content") or {}),
        related_files=tuple(data.get("related_files") or ()),
        related_symbols=tuple(data.get("related_symbols") or ()),
        tags=tuple(data.get("tags") or ()),
        content_hash=data.get("content_hash", ""),
        metadata=dict(data.get("metadata") or {}),
    )


def _canonical_json(payload) -> bytes:
    import json

    return json.dumps(
        payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")


def canonical_json_bytes(record) -> bytes:
    """Deterministic UTF-8 JSON bytes for a record.

    Keys are sorted and separators are fixed, so the same record always
    produces the same bytes on every platform.
    """
    return _canonical_json(record_to_dict(record))


def compute_content_hash(record) -> str:
    """SHA-256 of the record's canonical bytes, excluding ``content_hash``.

    Excluding the field itself is what makes the hash stable: including it
    would make the value depend on its own previous contents.
    """
    import hashlib

    payload = record_to_dict(record)
    payload.pop("content_hash", None)
    return "sha256:" + hashlib.sha256(_canonical_json(payload)).hexdigest()


def validate_record(record) -> None:
    """Validate a record, raising ``ValueError`` with the reason.

    The dataclass constructors already enforce enums, timestamps, relation
    membership, and self-reference. This adds the checks that span fields or
    span records, such as a hash that no longer matches its contents.
    """
    if not isinstance(record, (MemoryRecord, RelationRecord)):
        raise ValueError(f"not a PITMRY record: {type(record).__name__}")
    if record.content_hash:
        expected = compute_content_hash(record)
        if expected != record.content_hash:
            raise ValueError(
                f"content_hash mismatch: stored {record.content_hash}, "
                f"computed {expected}"
            )
