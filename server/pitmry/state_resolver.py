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
        record_id: (CURRENT if record.type in (RecordType.decision, RecordType.constraint)
                    else HISTORICAL if record.type in (
                        RecordType.git_change, RecordType.discussion,
                        RecordType.checkpoint, RecordType.session_summary,
                    ) else UNKNOWN)
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
        if record.type not in (RecordType.decision, RecordType.constraint):
            continue
        key = record.content.get("subject_key")
        if isinstance(key, str) and key.strip() and states[record.id] == CURRENT:
            groups[(record.project_id, key.strip())].append(record.id)

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
