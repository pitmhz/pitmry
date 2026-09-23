"""Deterministic record and project identifiers.

A SQLite autoincrement row is not identity. If the projection is deleted and
rebuilt, row 1 becomes a different memory. Canonical records therefore need
identities that survive a rebuild and that agree between two machines.

The scheme is UUIDv5 over a stable "project + source type + source id" triple.
Same inputs always produce the same id, so a re-ingested session lands on the
same record instead of creating a duplicate.
"""

from __future__ import annotations

import uuid
from typing import Optional
import re

#: Record type to id prefix, per 01-CANONICAL-FOUNDATION.md.
TYPE_PREFIXES = {
    "decision": "dec",
    "constraint": "con",
    "git_change": "git",
    "discussion": "dis",
    "observation": "obs",
    "failure": "fail",
    "checkpoint": "chk",
    "session_summary": "sum",
    "test_result": "test",
    "deployment": "dep",
    "note": "note",
    "relation": "rel",
}

PITMRY_NAMESPACE = uuid.NAMESPACE_URL

#: Length of the hex suffix in a record id.
_ID_HEX_LENGTH = 24
_PROJECT_ID_RE = re.compile(r"^prj_[0-9a-f]{24}$")
_RECORD_ID_RE = re.compile(r"^(dec|con|git|dis|obs|fail|chk|sum|test|dep|note|rel)_([0-9a-f]{24})$")


def validate_project_id(project_id: str) -> str:
    """Validate and return a canonical project id."""
    if not isinstance(project_id, str) or not _PROJECT_ID_RE.fullmatch(project_id):
        raise ValueError("project_id must match prj_<24 lowercase hex characters>")
    return project_id


def validate_record_id(record_id: str, record_type=None) -> str:
    """Validate a canonical record id and, when given, its type prefix."""
    if not isinstance(record_id, str):
        raise ValueError("record id must be a string")
    match = _RECORD_ID_RE.fullmatch(record_id)
    if not match:
        raise ValueError("record id must use a known prefix and 24 lowercase hex characters")
    if record_type is not None:
        expected = prefix_for_type(record_type)
        if match.group(1) != expected:
            raise ValueError(
                f"record id prefix {match.group(1)!r} does not match type prefix {expected!r}"
            )
    return record_id


def prefix_for_type(record_type: str) -> str:
    """Return the id prefix for a record type."""
    key = str(getattr(record_type, "value", record_type))
    try:
        return TYPE_PREFIXES[key]
    except KeyError:
        raise ValueError(
            f"unknown record type: {record_type!r} "
            f"(expected one of: {', '.join(sorted(TYPE_PREFIXES))})"
        ) from None


def source_uuid(project_id: str, source_type: str, source_id: str) -> uuid.UUID:
    """UUID that identifies a source event inside a project.

    ``project_id`` is part of the input on purpose. The same session exported
    into a forked project is a different event, and must not collide.
    """
    if not project_id or not project_id.strip():
        raise ValueError("project_id must be a non-empty string")
    if not source_type or not source_type.strip():
        raise ValueError("source_type must be a non-empty string")
    if not source_id or not source_id.strip():
        raise ValueError("source_id must be a non-empty string")
    name = f"pitmry:{project_id.strip()}:{source_type.strip()}:{source_id.strip()}"
    return uuid.uuid5(PITMRY_NAMESPACE, name)


def derive_record_id(project_id: str, source_type: str, source_id: str,
                     record_type: str) -> str:
    """Return the canonical record id for a source event.

    Example: ``dec_9f2c1ab34d5e6f70a1b2c3d4``.
    """
    digest = source_uuid(project_id, source_type, source_id).hex
    return f"{prefix_for_type(record_type)}_{digest[:_ID_HEX_LENGTH]}"


def new_source_id() -> str:
    """A fresh source id for a manual record that has no external source.

    The caller stores this value in provenance so a retry reuses it. Generating
    it again would produce a different record id and a duplicate memory.
    """
    return f"manual_{uuid.uuid4().hex}"


def derive_relation_id(project_id: str, source_record_id: str,
                       target_record_id: str, relation: str) -> str:
    """Canonical id for a relation record."""
    digest = source_uuid(
        project_id, "relation", f"{relation}:{source_record_id}>{target_record_id}"
    ).hex
    return f"rel_{digest[:_ID_HEX_LENGTH]}"


def new_project_id() -> str:
    """A fresh project identity.

    Deliberately not derived from the filesystem path or the remote URL. A
    clone must keep the same history, and a rename must not fork the project.
    """
    return f"prj_{uuid.uuid4().hex[:24]}"
