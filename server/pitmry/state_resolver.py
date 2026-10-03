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


def _supersession_pairs(relations):
    return {(edge.source_record_id, edge.target_record_id)
            for edge in relations
            if isinstance(edge, RelationRecord)
            and edge.provenance is RelationProvenance.explicit
            and edge.relation is RelationType.supersedes}


def _subject_groups(records_by_id, states):
    """Active claims grouped by the subject they were *declared* to be about."""
    groups = defaultdict(list)
    for record in records_by_id.values():
        if record.type not in CLAIM_TYPES:
            continue
        key = _declared_subject_key(record.content)
        if key is not None and states[record.id] == CURRENT:
            groups[(record.project_id, key)].append(record.id)
    return groups


def _conflicting_groups(records_by_id, states, supersession_pairs):
    """Subject groups whose active claims contradict each other.

    A group is only a conflict when nothing has been retired inside it. Only a
    canonical supersedes edge can retire an item; matching timestamps or text
    do nothing.
    """
    conflicting = {}
    for (project_id, key), active_ids in _subject_groups(records_by_id, states).items():
        if len(active_ids) < 2:
            continue
        if not any((new_id, old_id) in supersession_pairs
                   for new_id in active_ids for old_id in active_ids
                   if new_id != old_id):
            conflicting[(project_id, key)] = sorted(active_ids)
    return conflicting


def _base_states(records_by_id, relations):
    """Type, supersession and reversion state, with no conflict marking yet.

    Conflict detection needs the states *before* the CONFLICTING stamp is
    applied: a group is formed from claims that are still CURRENT. Computing the
    two steps in one function made the result depend on the order the caller
    asked for them, so a second caller asking only for the peers would silently
    get none.
    """
    explicit = [edge for edge in relations
                if isinstance(edge, RelationRecord)
                and edge.provenance is RelationProvenance.explicit]
    states = {
        record_id: (CURRENT if record.type in CLAIM_TYPES
                    else HISTORICAL if record.type in HISTORICAL_TYPES
                    else UNKNOWN)
        for record_id, record in records_by_id.items()
    }
    for edge in explicit:
        if edge.relation is RelationType.supersedes:
            if edge.target_record_id in states:
                states[edge.target_record_id] = SUPERSEDED
        elif edge.relation is RelationType.reverts:
            if edge.target_record_id in states:
                states[edge.target_record_id] = REVERTED
    return states


def _memory_records(records):
    return {record.id: record for record in records
            if not isinstance(record, RelationRecord)}


def resolve_states(records, relations):
    """Return ``record_id -> state``; time and similarity never change state."""
    records_by_id = _memory_records(records)
    states = _base_states(records_by_id, relations)
    for active_ids in _conflicting_groups(records_by_id, states,
                                          _supersession_pairs(relations)).values():
        for record_id in active_ids:
            states[record_id] = CONFLICTING
    return states


def subject_key_for(record):
    """The subject a record explicitly claims, or ``None`` when it has none.

    Exposed so a reader can show *why* a record is or is not part of a conflict
    group. A derived key is reported as ``None``, never as a hash, because a
    content hash would look like a subject and invite the reader to group on it.
    """
    return _declared_subject_key(getattr(record, "content", None))


def conflict_groups(records, relations):
    """Return ``record_id -> conflicting peer ids`` for every real conflict.

    The dashboard renders this instead of re-deriving conflicts from subject
    keys, so the panel can never disagree with the state it is displaying. Both
    sides call the same resolver, which is the whole point: a panel that
    re-implemented the rule would eventually show a conflict the agent does not
    report, and a reader who trusts one and not the other is right to doubt
    both.
    """
    records_by_id = _memory_records(records)
    states = _base_states(records_by_id, relations)
    supersession_pairs = _supersession_pairs(relations)
    peers = defaultdict(list)
    for active_ids in _conflicting_groups(records_by_id, states,
                                          supersession_pairs).values():
        for record_id in active_ids:
            peers[record_id].extend(peer for peer in active_ids if peer != record_id)
    return {record_id: sorted(ids) for record_id, ids in peers.items()}


def state_for(record_id, records, relations):
    return resolve_states(records, relations).get(record_id, UNKNOWN)
