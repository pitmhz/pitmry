"""Shared record factories for the Phase 1 tests.

Kept in a module so both the store tests and the CLI tests build the same
records, instead of duplicating a fixture that can drift.
"""

import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parents[1]
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

from server.pitmry.enums import (  # noqa: E402
    Authority,
    RecordType,
    RelationProvenance,
    RelationType,
    TruthDomain,
)
from server.pitmry.ids import derive_record_id, derive_relation_id  # noqa: E402
from server.pitmry.models import (  # noqa: E402
    SCHEMA_VERSION,
    MemoryRecord,
    Provenance,
    RelationRecord,
)

#: A fixed manual source id. Tests that assert idempotency or a conflict need
#: the same record id, and a fresh uuid4 per call would give them a new id
#: each time. Tests that want many distinct records pass their own source id.
DEFAULT_SOURCE_ID = "manual_test_dec_1"
DEFAULT_PROJECT_ID = "prj_000000000000000000000001"


def make_decision(project_id=DEFAULT_PROJECT_ID, title="Use Sanity as the CMS",
                  decision_text="Sanity is the content backend.",
                  source_id=DEFAULT_SOURCE_ID):
    return MemoryRecord(
        schema_version=SCHEMA_VERSION,
        id=derive_record_id(project_id, "manual", source_id, "decision"),
        project_id=project_id,
        type=RecordType.decision,
        title=title,
        summary=decision_text,
        created_at="2026-09-22T08:14:00+00:00",
        authority=Authority.human_evidenced,
        truth_domain=TruthDomain.intent,
        provenance=Provenance(
            source_type="manual",
            source_id=source_id,
            originator="human",
            captured_by="agent",
            evidence_refs=(),
        ),
        content={
            "context": "We needed editable structured content.",
            "decision": decision_text,
            "rationale": "Sanity has a better authoring model.",
            "trade_offs": "Paywalled API bandwidth.",
        },
        related_files=("app/cms.ts",),
        tags=("cms",),
    )


def make_relation(project_id, source_record_id, target_record_id,
                  relation=RelationType.supersedes):
    return RelationRecord(
        schema_version=SCHEMA_VERSION,
        id=derive_relation_id(project_id, source_record_id, target_record_id, relation),
        project_id=project_id,
        relation=relation,
        source_record_id=source_record_id,
        target_record_id=target_record_id,
        provenance=RelationProvenance.explicit
        if relation in {RelationType.supersedes, RelationType.reverts}
        else RelationProvenance.inferred,
        created_at="2026-09-22T09:00:00+00:00",
        evidence_refs=({"type": "session_span", "source_id": "grill_28", "start": 4, "end": 9},),
        metadata=({"algorithm": "test-linker"} if relation not in {RelationType.supersedes, RelationType.reverts} else {}),
    )
