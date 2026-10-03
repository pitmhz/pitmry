"""Resolve record state from canonical explicit relations only."""

from __future__ import annotations

from collections import defaultdict

from .enums import RecordType, RelationProvenance, RelationType
from .models import RelationRecord

CURRENT = "CURRENT"
HISTORICAL = "HISTORICAL"
SUPERSEDED = "SUPERSEDED"
REVERTED = "REVERTED"
CONFLICTING = "CONFLICTING"
UNKNOWN = "UNKNOWN"

#: Types that assert something about the project. They are claims, so they are
#: CURRENT and they take part in conflict detection.
CLAIM_TYPES = (
    RecordType.decision,
    RecordType.constraint,
    RecordType.requirement,
    RecordType.acceptance_criterion,
)

#: Types that record something that happened. They happened, so they are
#: HISTORICAL. A git change or a work unit is not a claim about the present.
HISTORICAL_TYPES = (
    RecordType.git_change,
    RecordType.discussion,
    RecordType.checkpoint,
    RecordType.session_summary,
    RecordType.phase,
    RecordType.work_unit,
    RecordType.session,
    RecordType.implementation,
    RecordType.verification,
    RecordType.test_result,
    RecordType.bug,
    RecordType.fix,
    RecordType.regression,
    RecordType.source_artifact,
)


def _declared_subject_key(content) -> str | None:
    """The subject a record explicitly claims, or ``None``.

    Project Intelligence records always carry a ``subject_key``, but most of
    them are a *content hash* the importer derived so that re-importing one
    decomposition is idempotent. Those keys are unique by construction, so
    treating them as a shared subject would mark every unrelated record as
    conflicting and train the reader to ignore the signal entirely.

    Only a key that was actually declared in the source is a claim that two
    records are about the same subject. The distinction is recorded at import
    time as ``subject_key_declared``; after the fact the two are
    indistinguishable, which is why the derived fallback is never treated as a
    subject.

    Decisions written through the CLI always carry an explicit ``--subject-key``,
    so they keep the behaviour they had before.
    """
    if not isinstance(content, dict):
        return None
    if content.get("subject_key_declared") is not True:
        return None
    key = content.get("subject_key")
    if isinstance(key, str) and key.strip():
        return key.strip()
    return None


def resolve_states(records, relations):
    """Return ``record_id -> state``; time and similarity never change state."""
    records_by_id = {record.id: record for record in records
                     if not isinstance(record, RelationRecord)}
    explicit = [edge for edge in relations
                if isinstance(edge, RelationRecord)
                and edge.provenance is RelationProvenance.explicit]
    superseded = {edge.target_record_id for edge in explicit
                  if edge.relation is RelationType.supersedes}
    reverted = {edge.target_record_id for edge in explicit
                if edge.relation is RelationType.reverts}
    states = {
        record_id: (CURRENT if record.type in CLAIM_TYPES
                    else HISTORICAL if record.type in HISTORICAL_TYPES
                    else UNKNOWN)
        for record_id, record in records_by_id.items()
    }
    for record_id in superseded:
        if record_id in states:
            states[record_id] = SUPERSEDED
    for record_id in reverted:
        if record_id in states:
            states[record_id] = REVERTED

    groups = defaultdict(list)
    for record in records_by_id.values():
        if record.type not in CLAIM_TYPES:
            continue
        key = _declared_subject_key(record.content)
        if key is not None and states[record.id] == CURRENT:
            groups[(record.project_id, key)].append(record.id)

    supersession_pairs = {(edge.source_record_id, edge.target_record_id)
                          for edge in explicit
                          if edge.relation is RelationType.supersedes}
    for active_ids in groups.values():
        if len(active_ids) < 2:
            continue
        # Keep the test explicit: only a canonical supersedes edge can remove
        # an item from the active set. Matching timestamps or text do nothing.
        if not any((new_id, old_id) in supersession_pairs
                   for new_id in active_ids for old_id in active_ids
                   if new_id != old_id):
            for record_id in active_ids:
                states[record_id] = CONFLICTING

    return states


def state_for(record_id, records, relations):
    return resolve_states(records, relations).get(record_id, UNKNOWN)
