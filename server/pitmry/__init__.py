"""PITMRY backend engine.

PITMRY is a local-first, Git-portable memory and historical context engine for
AI software agents. Canonical records under `.pitmry/` are the durable source
of truth. Every database the engine builds is disposable and rebuildable.

Phase 2 adds rebuildable SQLite/FTS and optional LanceDB projections, local
capture helpers, and scoped import tools. Canonical JSON remains the only
durable source of truth. Retrieval policy and agent APIs are later phases.
"""

from .enums import (  # noqa: F401
    Authority,
    QueryStatus,
    RecordType,
    RelationProvenance,
    RelationType,
    TruthDomain,
)
from .ids import derive_record_id, new_source_id, new_project_id  # noqa: F401
from .models import (  # noqa: F401
    SCHEMA_VERSION,
    MemoryRecord,
    Provenance,
    RelationRecord,
    canonical_json_bytes,
    compute_content_hash,
    record_from_dict,
    record_to_dict,
    validate_record,
)
from .canonical_store import (  # noqa: F401
    CanonicalConflictError,
    CanonicalStore,
)

__all__ = [
    "Authority",
    "QueryStatus",
    "RecordType",
    "RelationProvenance",
    "RelationType",
    "TruthDomain",
    "SCHEMA_VERSION",
    "MemoryRecord",
    "Provenance",
    "RelationRecord",
    "canonical_json_bytes",
    "compute_content_hash",
    "record_from_dict",
    "record_to_dict",
    "validate_record",
    "derive_record_id",
    "new_source_id",
    "new_project_id",
    "CanonicalConflictError",
    "CanonicalStore",
]
