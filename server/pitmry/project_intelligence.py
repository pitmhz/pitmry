"""Deterministic Project Intelligence services backed by PITMRY records.

All durable state is represented by immutable canonical records. The helpers
in this module deliberately do not call an LLM: reasoning tools submit
validated decomposition and reconciliation proposals to these services.
"""

from __future__ import annotations

import contextlib
import datetime as dt
import hashlib
import json
import os
import re
import subprocess
import threading
import time
import unicodedata
import uuid
from pathlib import Path

from .capture import capture_relation
from .enums import Authority, RecordType, RelationType, TruthDomain
from .ids import derive_record_id, new_source_id
from .models import MemoryRecord, Provenance, SCHEMA_VERSION, utc_now_iso
from .state_resolver import CONFLICTING as DECISION_CONFLICTING
from .state_resolver import CURRENT as DECISION_CURRENT
from .state_resolver import state_for as decision_state_for


class ProjectIntelligenceError(ValueError):
    """A domain rule prevents the requested Project Intelligence operation."""


_KINDS = frozenset({"product", "backend", "frontend", "data", "security",
                    "performance", "accessibility", "operational", "integration", "migration"})
_RECONCILIATIONS = frozenset({"DUPLICATE", "OVERLAP", "DEPENDENCY", "CONFLICT",
                              "MISSING_PREREQUISITE", "TERMINOLOGY_MISMATCH"})
_STATES = {"PROPOSED", "ACCEPTED", "PLANNED", "IN_PROGRESS", "IMPLEMENTED",
           "VERIFIED", "NEEDS_REVERIFICATION", "BLOCKED", "REGRESSED",
           "SUPERSEDED", "REJECTED", "CREATED", "ACTIVE", "FINISHING",
           "COMPLETED", "ABANDONED", "FAILED", "CLOSED"}
_TRANSITIONS = {
    "PROPOSED": {"ACCEPTED", "REJECTED"},
    "ACCEPTED": {"PLANNED", "SUPERSEDED", "BLOCKED", "REGRESSED"},
    "PLANNED": {"IN_PROGRESS", "BLOCKED", "REGRESSED"},
    "IN_PROGRESS": {"IMPLEMENTED", "BLOCKED", "REGRESSED", "CLOSED"},
    "IMPLEMENTED": {"VERIFIED", "NEEDS_REVERIFICATION", "REGRESSED"},
    "VERIFIED": {"NEEDS_REVERIFICATION", "REGRESSED", "SUPERSEDED"},
    "NEEDS_REVERIFICATION": {"VERIFIED", "REGRESSED"},
    "CREATED": {"ACTIVE"},
    "ACTIVE": {"BLOCKED", "FINISHING", "FAILED", "ABANDONED"},
    "BLOCKED": {"ACTIVE", "IN_PROGRESS", "ABANDONED"},
    "FINISHING": {"COMPLETED"},
    "REGRESSED": {"IN_PROGRESS", "IMPLEMENTED", "VERIFIED", "NEEDS_REVERIFICATION", "SUPERSEDED"},
}
_LOCKS_GUARD = threading.Lock()
_CHECKOUT_LOCKS = {}


def _text(value, name):
    if not isinstance(value, str) or not value.strip():
        raise ProjectIntelligenceError(f"{name} must be a non-empty string")
    return value.strip()


def _record(store, record_type, source_type, source_id, title, summary, content,
            authority=Authority.agent_observed, truth_domain=TruthDomain.intent,
            related_files=(), related_symbols=(), tags=()):
    record_id = derive_record_id(store.project_id, source_type, source_id, record_type)
    prior = store.get(record_id)
    created_at = prior.created_at if prior is not None else utc_now_iso()
    record = MemoryRecord(
        schema_version=SCHEMA_VERSION, id=record_id, project_id=store.project_id,
        type=record_type, title=_text(title, "title"), summary=_text(summary, "summary"),
        created_at=created_at, authority=authority, truth_domain=truth_domain,
        provenance=Provenance(source_type, source_id, "human" if authority == Authority.human_direct else "agent",
                              "pitmry-project-intelligence"),
        content=content, related_files=tuple(related_files),
        related_symbols=tuple(related_symbols), tags=tuple(tags),
    )
    store.write(record)
    return record


def _records(store, record_type=None):
    return [item for item in store.iter_records() if record_type is None or item.type == record_type]


def _relations(store, relation=None):
    return [item for item in _records(store, RecordType.relation)
            if relation is None or item.relation == relation]


def _link(store, source, target, relation, evidence=None):
    return capture_relation(store, source.id, target.id, relation,
                            evidence or [source.id])


def _event(store, subject_id, from_state, to_state, *, actor="agent",
           reason="", event_key=None, evidence=()):
    if to_state not in _STATES:
        raise ProjectIntelligenceError(f"unknown lifecycle state: {to_state}")
    key = event_key or uuid.uuid4().hex
    event_id = derive_record_id(store.project_id, "pi_state_event", f"{subject_id}:{key}", RecordType.observation)
    existing = store.get(event_id)
    if existing is not None:
        body = existing.content
        if (body.get("subject_id") == subject_id and body.get("from_state") == from_state
                and body.get("to_state") == to_state and body.get("event_key") == key
                and body.get("actor") == actor and body.get("reason", "") == reason
                and body.get("evidence", []) == list(evidence)):
            return existing
        raise ProjectIntelligenceError(f"state event key already used with different content: {key}")
    current = state_of(store, subject_id)
    if current != from_state:
        raise ProjectIntelligenceError(f"state changed: expected {from_state}, found {current}")
    if to_state not in _TRANSITIONS.get(current, set()):
        raise ProjectIntelligenceError(f"invalid lifecycle transition {current} -> {to_state}")
    prior_event = state_event_for(store, subject_id)
    return _record(
        store, RecordType.observation, "pi_state_event", f"{subject_id}:{key}",
        f"{current} to {to_state}", reason or f"Lifecycle state changed from {current} to {to_state}.",
        {"event_kind": "project_intelligence_state", "subject_id": subject_id,
         "from_state": current, "to_state": to_state, "actor": actor,
         "reason": reason, "evidence": list(evidence), "event_key": key,
         "previous_event_id": prior_event.id if prior_event else None},
        authority=Authority.human_direct if actor == "human" else Authority.agent_observed,
        truth_domain=TruthDomain.history,
    )


def state_event_for(store, subject_id):
    events = [r for r in _records(store, RecordType.observation)
              if r.content.get("event_kind") == "project_intelligence_state"
              and r.content.get("subject_id") == subject_id]
    if events:
        events.sort(key=lambda r: (r.created_at, r.id))
        return events[-1]
    return None


def state_of(store, subject_id):
    event = state_event_for(store, subject_id)
    if event is not None:
        return event.content["to_state"]
    subject = store.get(subject_id)
    if subject is None:
        raise ProjectIntelligenceError(f"record not found: {subject_id}")
    return subject.content.get("initial_state", "PROPOSED")


def _set_state(store, record, to_state, *, actor="agent", reason="", event_key=None, evidence=()):
    return _event(store, record.id, state_of(store, record.id), to_state,
                  actor=actor, reason=reason, event_key=event_key, evidence=evidence)


def ingest_markdown(store, source_path):
    """Capture an explicit repository-relative Markdown source snapshot."""
    raw_path = Path(_text(str(source_path), "source_path"))
    if raw_path.is_absolute() or raw_path.suffix.lower() not in {".md", ".markdown"}:
        raise ProjectIntelligenceError("source must be a repository-relative Markdown file")
    root = store.paths.root.resolve()
    candidate = (root / raw_path).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise ProjectIntelligenceError("source path escapes the project root") from exc
    if not candidate.is_file():
        raise ProjectIntelligenceError(f"source file does not exist: {raw_path.as_posix()}")
    original = candidate.read_text(encoding="utf-8")
    digest = hashlib.sha256(original.encode("utf-8")).hexdigest()
    relative = candidate.relative_to(root).as_posix()
    source_id = f"{relative}@sha256:{digest}"
    title = next((line.lstrip("# ").strip() for line in original.splitlines()
                  if line.strip().startswith("#")), raw_path.stem)
    return _record(
        store, RecordType.source_artifact, "project_file", source_id, title,
        f"Markdown source snapshot {relative}",
        {"artifact_kind": "prd", "source_path": relative, "source_hash": f"sha256:{digest}",
         "title": title, "version_label": None, "ingestion_status": "INGESTED",
         "original_text_ref": relative, "original_text": original},
        authority=Authority.human_direct, truth_domain=TruthDomain.intent,
        related_files=(relative,), tags=("project-intelligence", "source-artifact"),
    )


def import_decomposition(store, artifact_id, payload):
    artifact = store.get(_text(artifact_id, "artifact_id"))
    if artifact is None or artifact.type != RecordType.source_artifact:
        raise ProjectIntelligenceError("artifact_id must reference an ingested source artifact")
    if not isinstance(payload, dict) or payload.get("artifact_id") != artifact_id:
        raise ProjectIntelligenceError("decomposition artifact_id must match the source")
    items = payload.get("requirements")
    if not isinstance(items, list) or not items:
        raise ProjectIntelligenceError("decomposition requirements must be a non-empty list")
    temporary_keys = set()
    identities = set()
    validated = []
    for item in items:
        if not isinstance(item, dict):
            raise ProjectIntelligenceError("each requirement must be an object")
        key = _text(item.get("temporary_key"), "temporary_key")
        if key in temporary_keys:
            raise ProjectIntelligenceError(f"duplicate temporary_key: {key}")
        temporary_keys.add(key)
        kind = _text(item.get("kind"), "kind").lower()
        if kind not in _KINDS:
            raise ProjectIntelligenceError(f"invalid requirement kind: {kind}")
        statement = _text(item.get("statement"), "statement")
        locator = item.get("source_locator")
        if not isinstance(locator, dict) or not locator:
            raise ProjectIntelligenceError("source_locator must identify a source section")
        section = _text(str(locator.get("section") or locator.get("heading") or locator.get("anchor") or ""),
                        "source_locator.section")
        normalized = " ".join(unicodedata.normalize("NFKC", statement).lower().split())
        locator_json = json.dumps(locator, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
        identity = hashlib.sha256(f"{locator_json}\0{normalized}".encode("utf-8")).hexdigest()
        if identity in identities:
            raise ProjectIntelligenceError(f"duplicate source requirement identity: {key}")
        identities.add(identity)
        criteria = item.get("acceptance_criteria", [])
        if not isinstance(criteria, list):
            raise ProjectIntelligenceError(f"acceptance_criteria for {key} must be a list")
        validated_criteria = []
        for index, criterion in enumerate(criteria):
            if isinstance(criterion, str):
                criterion = {"statement": criterion}
            if not isinstance(criterion, dict):
                raise ProjectIntelligenceError(f"acceptance criterion for {key} must be text or object")
            cstatement = _text(criterion.get("statement"), "acceptance criterion statement")
            validated_criteria.append((index, criterion, cstatement))
        validated.append((key, kind, statement, locator, identity, item, validated_criteria))

    imported = []
    for key, kind, statement, locator, identity, item, validated_criteria in validated:
        rid = _record(store, RecordType.requirement, "project_requirement", f"{artifact_id}:{identity}",
                      statement[:100], statement,
                       {"requirement_kind": kind, "statement": statement,
                       "initial_state": "PROPOSED",
                       "priority": item.get("priority", "required"),
                       "subject_key": item.get("subject_key") or identity[:20],
                       "source_locator": {**locator, "artifact_id": artifact_id},
                       "temporary_key": key}, tags=("project-intelligence", "requirement"))
        _link(store, rid, artifact, RelationType.derived_from)
        for index, criterion, cstatement in validated_criteria:
            cid = _record(store, RecordType.acceptance_criterion, "project_acceptance_criterion",
                          f"{rid.id}:{hashlib.sha256(cstatement.casefold().encode()).hexdigest()}",
                          cstatement[:100], cstatement,
                          {"statement": cstatement, "verification_method": criterion.get("verification_method", "automated"),
                           "mandatory": bool(criterion.get("mandatory", True)),
                           "initial_state": "PROPOSED",
                           "ordinal": index}, tags=("project-intelligence", "acceptance-criterion"))
            _link(store, rid, cid, RelationType.contains)
        imported.append(rid.id)
    return {"artifact_id": artifact_id, "requirements": imported}


def record_reconciliation(store, classification, record_ids, summary, *, critical=True):
    classification = _text(classification, "classification").upper()
    if classification not in _RECONCILIATIONS:
        raise ProjectIntelligenceError(f"invalid reconciliation classification: {classification}")
    ids = sorted({item.id if hasattr(item, "id") else str(item) for item in (record_ids or ())})
    if len(ids) < 2 or any(store.get(item) is None for item in ids):
        raise ProjectIntelligenceError("reconciliation must reference at least two existing records")
    key = f"{classification}:{':'.join(ids)}:{hashlib.sha256(_text(summary, 'summary').encode()).hexdigest()}"
    return _record(store, RecordType.observation, "pi_reconciliation", key,
                   f"{classification} reconciliation", summary,
                   {"observation_kind": "reconciliation", "classification": classification,
                    "records": ids, "summary": summary, "critical": bool(critical)},
                   authority=Authority.agent_observed, truth_domain=TruthDomain.intent)


def resolve_reconciliation(store, observation_id, resolution, *, decision_id=None, actor="human"):
    observation = store.get(observation_id)
    if observation is None or observation.content.get("observation_kind") != "reconciliation":
        raise ProjectIntelligenceError("observation_id must reference a reconciliation proposal")
    decision = None
    if decision_id:
        decision = store.get(decision_id)
        if decision is None or decision.type != RecordType.decision:
            raise ProjectIntelligenceError("decision_id must reference a PITMRY decision")
    record = _record(store, RecordType.observation, "pi_reconciliation_resolution",
                     f"{observation_id}:{hashlib.sha256(_text(resolution, 'resolution').encode()).hexdigest()}",
                     "Reconciliation resolution", resolution,
                     {"observation_kind": "reconciliation_resolution", "target_id": observation_id,
                      "resolution": resolution, "decision_id": decision_id, "actor": actor},
                     authority=Authority.human_evidenced if actor == "human" else Authority.agent_reported,
                     truth_domain=TruthDomain.intent)
    _link(store, record, observation, RelationType.clarifies)
    if decision_id:
        _link(store, record, decision, RelationType.derived_from)
    return record


def baseline_project(store, accepted_ids, *, confirmation, waived_conflicts=()):
    """Create a baseline marker after an explicit interactive confirmation."""
    manifest = store.require_manifest()
    if confirmation != manifest["name"]:
        raise ProjectIntelligenceError("baseline confirmation must exactly match the project name")
    if isinstance(waived_conflicts, dict):
        waivers = {str(key): _text(value, "conflict waiver reason")
                   for key, value in waived_conflicts.items()}
    else:
        waivers = {}
        if waived_conflicts:
            raise ProjectIntelligenceError("conflict waivers must map each conflict ID to a human reason")
    waived = set(waivers)
    reconciliation_ids = {r.id for r in _records(store, RecordType.observation)
                          if r.content.get("observation_kind") == "reconciliation"}
    if waived - reconciliation_ids:
        raise ProjectIntelligenceError("cannot waive unknown reconciliation records")
    accepted_ids = sorted(set(accepted_ids or ()))
    if not accepted_ids:
        raise ProjectIntelligenceError("baseline must accept at least one requirement or criterion")
    accepted_records = []
    for record_id in accepted_ids:
        record = store.get(record_id)
        if record is None or record.type not in {RecordType.requirement, RecordType.acceptance_criterion}:
            raise ProjectIntelligenceError(f"baseline item is not a requirement or criterion: {record_id}")
        state = state_of(store, record_id)
        if state not in {"PROPOSED", "ACCEPTED"}:
            raise ProjectIntelligenceError(f"baseline item {record_id} is in state {state}")
        accepted_records.append(record)
    open_critical = [r for r in _records(store, RecordType.observation)
                     if r.content.get("observation_kind") == "reconciliation"
                     and r.content.get("critical")
                     and r.id not in waived
                     and not any(e.content.get("target_id") == r.id
                                 and e.content.get("observation_kind") == "reconciliation_resolution"
                                 for e in _records(store, RecordType.observation))]
    if open_critical:
        raise ProjectIntelligenceError("critical reconciliation conflicts remain unresolved: " +
                                       ", ".join(r.id for r in open_critical))
    for conflict_id, reason in waivers.items():
        _record(store, RecordType.observation, "pi_reconciliation_resolution",
                f"{conflict_id}:waiver:{hashlib.sha256(reason.encode()).hexdigest()}",
                "Reconciliation waived", reason,
                {"observation_kind": "reconciliation_resolution", "target_id": conflict_id,
                 "resolution": reason, "waiver": True, "actor": "human"},
                authority=Authority.human_direct, truth_domain=TruthDomain.intent)
    accepted = []
    for record in accepted_records:
        if state_of(store, record.id) == "PROPOSED":
            _set_state(store, record, "ACCEPTED", actor="human", reason="Included in approved baseline")
        accepted.append(record.id)
        if record.type == RecordType.requirement:
            for edge in _relations(store, RelationType.contains):
                if edge.source_record_id != record.id:
                    continue
                criterion = store.get(edge.target_record_id)
                if state_of(store, criterion.id) == "PROPOSED":
                    _set_state(store, criterion, "ACCEPTED", actor="human",
                               reason=f"Included with accepted requirement {record.id}")
                if criterion.id not in accepted:
                    accepted.append(criterion.id)
    source_set = sorted({edge.target_record_id for edge in _relations(store, RelationType.derived_from)
                         if edge.source_record_id in accepted})
    key = hashlib.sha256(("\n".join(sorted(accepted)) + "\n" + "\n".join(source_set)).encode()).hexdigest()
    marker = _record(store, RecordType.checkpoint, "pi_baseline", key, "Project Intelligence baseline",
                     f"Approved baseline with {len(accepted)} accepted items.",
                     {"checkpoint_kind": "project_intelligence_baseline", "accepted_ids": sorted(accepted),
                      "source_artifact_ids": source_set, "waived_conflicts": waivers},
                     authority=Authority.human_direct, truth_domain=TruthDomain.intent,
                     tags=("project-intelligence", "baseline"))
    return marker


def create_phase(store, name, ordinal, objective, *, source_id=None):
    if isinstance(ordinal, bool) or not isinstance(ordinal, int) or ordinal < 1:
        raise ProjectIntelligenceError("phase ordinal must be a positive integer")
    return _record(store, RecordType.phase, "pi_phase", source_id or f"{ordinal}:{_text(name, 'name').casefold()}",
                   name, objective, {"name": name, "ordinal": ordinal, "objective": objective,
                                    "initial_state": "PLANNED"}, tags=("project-intelligence", "phase"))


def create_work_unit(store, phase_id, title, objective, requirement_ids, *, scope=None,
                     completion_policy=None, risk="medium", release_gate=False, source_id=None):
    phase = store.get(phase_id)
    if phase is None or phase.type != RecordType.phase:
        raise ProjectIntelligenceError("phase_id must reference a phase")
    requirements = [store.get(item) for item in requirement_ids]
    if not requirements or any(r is None or r.type != RecordType.requirement for r in requirements):
        raise ProjectIntelligenceError("work unit must link at least one existing requirement")
    key = source_id or hashlib.sha256((phase_id + "\0" + title + "\0" + objective).encode()).hexdigest()
    work = _record(store, RecordType.work_unit, "pi_work_unit", key, title, objective,
                   {"title": title, "objective": objective,
                    "initial_state": "PLANNED", "scope": scope or {"paths": [], "symbols": []},
                    "completion_policy": completion_policy or {"require_tests": True,
                        "require_build": True, "require_verification": True}, "risk": risk,
                    "release_gate": bool(release_gate)},
                   tags=("project-intelligence", "work-unit"))
    _link(store, phase, work, RelationType.contains)
    for requirement in requirements:
        _link(store, work, requirement, RelationType.implements)
    return work


def add_dependency(store, work_id, depends_on_id):
    work = store.get(work_id)
    target = store.get(depends_on_id)
    if work is None or target is None or work.type != RecordType.work_unit or target.type != RecordType.work_unit:
        raise ProjectIntelligenceError("dependencies must connect existing work units")
    cycle = _dependency_cycle_with_edge(store, work_id, depends_on_id)
    if cycle:
        raise ProjectIntelligenceError("DEPENDENCY_CYCLE: " + " -> ".join(cycle))
    return _link(store, work, target, RelationType.depends_on)


def add_blocking_decision(store, work_id, decision_id):
    work = store.get(work_id)
    decision = store.get(decision_id)
    if (work is None or work.type != RecordType.work_unit
            or decision is None or decision.type not in {RecordType.decision, RecordType.constraint}):
        raise ProjectIntelligenceError("blocking links must connect work to a decision or constraint")
    return _link(store, work, decision, RelationType.depends_on)


def dependency_cycle(store):
    adjacency = {}
    for edge in _relations(store, RelationType.depends_on):
        target = store.get(edge.target_record_id)
        if target is not None and target.type == RecordType.work_unit:
            adjacency.setdefault(edge.source_record_id, []).append(edge.target_record_id)
    active, done, path = set(), set(), []
    def visit(node):
        if node in active:
            start = path.index(node)
            return path[start:] + [node]
        if node in done:
            return None
        active.add(node); path.append(node)
        for target in adjacency.get(node, []):
            result = visit(target)
            if result:
                return result
        path.pop(); active.remove(node); done.add(node)
        return None
    for node in adjacency:
        result = visit(node)
        if result:
            return result
    return []


def _dependency_cycle_with_edge(store, source_id, target_id):
    adjacency = {}
    for edge in _relations(store, RelationType.depends_on):
        target = store.get(edge.target_record_id)
        if target is not None and target.type == RecordType.work_unit:
            adjacency.setdefault(edge.source_record_id, []).append(edge.target_record_id)
    adjacency.setdefault(source_id, []).append(target_id)
    active, done, path = set(), set(), []
    def visit(node):
        if node in active:
            return path[path.index(node):] + [node]
        if node in done:
            return None
        active.add(node); path.append(node)
        for next_node in adjacency.get(node, []):
            result = visit(next_node)
            if result:
                return result
        path.pop(); active.remove(node); done.add(node)
        return None
    for node in adjacency:
        result = visit(node)
        if result:
            return result
    return []


def _valid_lease(store, work_id, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    latest = _latest_lease(store, work_id)
    if latest is None:
        return None
    if latest.content["lease_state"] != "ACTIVE":
        return None
    expires = dt.datetime.fromisoformat(latest.content["expires_at"])
    return latest if expires > now else None


def _latest_lease(store, work_id):
    leases = [r for r in _records(store, RecordType.observation)
              if r.content.get("event_kind") == "work_lease" and r.content.get("work_unit_id") == work_id]
    leases.sort(key=lambda r: (r.created_at, r.id))
    return leases[-1] if leases else None


def _expire_lease_if_needed(store, work_id):
    latest = _latest_lease(store, work_id)
    if latest is None or latest.content.get("lease_state") != "ACTIVE":
        return None
    if dt.datetime.fromisoformat(latest.content["expires_at"]) > dt.datetime.now(dt.timezone.utc):
        return None
    content = dict(latest.content)
    content.update({"lease_state": "EXPIRED", "expired_at": utc_now_iso()})
    event = _record(store, RecordType.observation, "pi_work_lease", f"expired:{latest.id}",
                    "Work lease expired", f"Lease for session {content['session_id']} expired.",
                    content, truth_domain=TruthDomain.history,
                    tags=("project-intelligence", "lease"))
    session = store.get(content["session_id"])
    if session is not None and state_of(store, session.id) in {"ACTIVE", "BLOCKED"}:
        _set_state(store, session, "ABANDONED", reason="Lease expired; session ownership ended",
                   evidence=(event.id,))
    return event


def evaluate_readiness(store, work_id):
    work = store.get(work_id)
    if work is None or work.type != RecordType.work_unit:
        raise ProjectIntelligenceError("work_id must reference a work unit")
    blockers = []
    for edge in _relations(store, RelationType.depends_on):
        if edge.source_record_id != work_id:
            continue
        target = store.get(edge.target_record_id)
        if target is not None and target.type == RecordType.work_unit:
            if state_of(store, target.id) != "VERIFIED":
                blockers.append({"code": "DEPENDENCY_NOT_VERIFIED", "record_id": target.id})
        elif target is not None and target.type in {RecordType.decision, RecordType.constraint}:
            decision_state = decision_state_for(target.id, _records(store), _relations(store))
            if decision_state != DECISION_CURRENT:
                blockers.append({"code": "BLOCKING_DECISION_INACTIVE", "record_id": target.id,
                                 "state": DECISION_CONFLICTING if decision_state == DECISION_CONFLICTING else decision_state})
    linked = [edge.target_record_id for edge in _relations(store, RelationType.implements)
              if edge.source_record_id == work_id]
    if not linked:
        blockers.append({"code": "NO_LINKED_REQUIREMENTS", "record_id": work_id})
    for requirement_id in linked:
        if state_of(store, requirement_id) not in {"ACCEPTED", "PLANNED", "IN_PROGRESS", "IMPLEMENTED", "VERIFIED"}:
            blockers.append({"code": "REQUIREMENT_NOT_ACCEPTED", "record_id": requirement_id})
        criteria = [e.target_record_id for e in _relations(store, RelationType.contains)
                    if e.source_record_id == requirement_id]
        mandatory = [criterion_id for criterion_id in criteria
                     if store.get(criterion_id).content.get("mandatory", True)]
        if not mandatory:
            blockers.append({"code": "MISSING_ACCEPTANCE_CRITERIA", "record_id": requirement_id})
        for criterion_id in mandatory:
            if state_of(store, criterion_id) not in {"ACCEPTED", "PLANNED"}:
                blockers.append({"code": "CRITERION_NOT_ACCEPTED", "record_id": criterion_id})
    if dependency_cycle(store):
        blockers.append({"code": "DEPENDENCY_CYCLE", "record_id": work_id})
    critical_ids = {req_id for edge in _relations(store, RelationType.implements)
                    if edge.source_record_id == work_id for req_id in (edge.target_record_id,)}
    for conflict in _records(store, RecordType.observation):
        if (conflict.content.get("observation_kind") == "reconciliation"
                and conflict.content.get("critical")
                and critical_ids.intersection(conflict.content.get("records", []))
                and not any(r.content.get("target_id") == conflict.id
                            and r.content.get("observation_kind") == "reconciliation_resolution"
                            for r in _records(store, RecordType.observation))):
            blockers.append({"code": "CRITICAL_RECONCILIATION_OPEN", "record_id": conflict.id})
    if state_of(store, work_id) == "SUPERSEDED":
        blockers.append({"code": "WORK_SUPERSEDED", "record_id": work_id})
    if state_of(store, work_id) in {"IMPLEMENTED", "VERIFIED", "REJECTED", "COMPLETED", "CLOSED"}:
        blockers.append({"code": "WORK_ALREADY_COMPLETE", "record_id": work_id})
    if _valid_lease(store, work_id):
        blockers.append({"code": "ACTIVE_LEASE", "record_id": work_id})
    return {"ready": not blockers, "blocking_reasons": blockers}


def list_ready_work(store, *, phase_id=None, tags=()):
    work_units = [r for r in _records(store, RecordType.work_unit)
                  if phase_id is None or any(e.source_record_id == phase_id and e.target_record_id == r.id
                                             for e in _relations(store, RelationType.contains))]
    result = [{"work_unit": r, "readiness": evaluate_readiness(store, r.id)} for r in work_units]
    wanted = set(tags or ())
    ready = [item for item in result if item["readiness"]["ready"]
             and (not wanted or wanted.issubset(set(item["work_unit"].tags)))]
    phase_order = {record.id: record.content.get("ordinal", 0)
                   for record in _records(store, RecordType.phase)}
    work_phase = {edge.target_record_id: edge.source_record_id
                  for edge in _relations(store, RelationType.contains)
                  if edge.source_record_id in phase_order}
    ready.sort(key=lambda item: (phase_order.get(work_phase.get(item["work_unit"].id), 0),
                                 item["work_unit"].content["title"].casefold(),
                                 item["work_unit"].id))
    return ready


@contextlib.contextmanager
def _checkout_lock(store):
    """Cross-process exclusive lock shared by processes in this checkout."""
    lock_path = (store.paths.cache_dir / "coordination.lock").resolve()
    with _LOCKS_GUARD:
        local_lock = _CHECKOUT_LOCKS.setdefault(str(lock_path), threading.RLock())
    local_lock.acquire()
    handle = None
    try:
        lock_path.parent.mkdir(parents=True, exist_ok=True)
        handle = lock_path.open("a+b")
        if os.name == "nt":
            import msvcrt
            handle.seek(0)
            if lock_path.stat().st_size == 0:
                handle.write(b"0"); handle.flush()
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_LOCK, 1)
        else:
            import fcntl
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        yield
    finally:
        try:
            if handle is not None:
                try:
                    if os.name == "nt":
                        import msvcrt
                        handle.seek(0); msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
                    else:
                        import fcntl
                        fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
                finally:
                    handle.close()
        finally:
            local_lock.release()


def start_session(store, work_id, *, agent="unknown", branch="", worktree="", base_commit="",
                  lease_seconds=3600, read_only=False, session_id=None):
    work = store.get(work_id)
    if work is None or work.type != RecordType.work_unit:
        raise ProjectIntelligenceError("work_id must reference a work unit")
    if not read_only:
        ready = evaluate_readiness(store, work_id)
        if not ready["ready"]:
            raise ProjectIntelligenceError("work is not ready: " + json.dumps(ready["blocking_reasons"]))
    if read_only:
        session_record_id = session_id or new_source_id()
        contract = session_contract(store, work_id)
        contract.update({"session_id": session_record_id, "branch": branch,
                         "worktree": worktree, "base_commit": base_commit or None})
        session = _record(store, RecordType.session, "pi_session", session_record_id,
                          f"Review session for {work.content['title']}", work.content["objective"],
                          {"session_kind": "review", "agent": {"tool": agent, "model": None},
                           "work_unit_id": work_id, "branch": branch, "worktree": worktree,
                           "base_commit": base_commit or None,
                           "initial_state": "ACTIVE", "started_at": utc_now_iso(), "read_only": True,
                           "contract": contract},
                          truth_domain=TruthDomain.history, tags=("project-intelligence", "session"))
        return {"session": session, "contract": contract}
    with _checkout_lock(store):
        _expire_lease_if_needed(store, work_id)
        ready = evaluate_readiness(store, work_id)
        if not ready["ready"]:
            raise ProjectIntelligenceError("work cannot be claimed: " + json.dumps(ready["blocking_reasons"]))
        seconds = int(lease_seconds)
        if seconds < 30 or seconds > 86400:
            raise ProjectIntelligenceError("lease_seconds must be between 30 and 86400")
        session_record_id = session_id or new_source_id()
        contract = session_contract(store, work_id)
        contract.update({"session_id": session_record_id, "branch": branch,
                         "worktree": worktree, "base_commit": base_commit or None})
        session = _record(store, RecordType.session, "pi_session", session_record_id,
                          f"Session for {work.content['title']}", work.content["objective"],
                          {"session_kind": "implementation", "agent": {"tool": agent, "model": None},
                           "work_unit_id": work_id, "branch": branch, "worktree": worktree,
                           "base_commit": base_commit or None,
                           "initial_state": "ACTIVE", "started_at": utc_now_iso(), "read_only": False,
                           "contract": contract},
                          truth_domain=TruthDomain.history, tags=("project-intelligence", "session"))
        now = dt.datetime.now(dt.timezone.utc)
        lease = _record(store, RecordType.observation, "pi_work_lease", uuid.uuid4().hex,
                        "Work lease", f"Work claimed by session {session.id}.",
                        {"event_kind": "work_lease", "lease_state": "ACTIVE", "work_unit_id": work_id,
                         "session_id": session.id, "claimed_at": now.isoformat(),
                         "expires_at": (now + dt.timedelta(seconds=seconds)).isoformat(),
                         "base_commit": base_commit or None, "branch": branch, "worktree": worktree},
                        truth_domain=TruthDomain.history, tags=("project-intelligence", "lease"))
    if state_of(store, work.id) in {"PLANNED", "BLOCKED"}:
        _set_state(store, work, "IN_PROGRESS", reason=f"Claimed by session {session.id}")
    return {"session": session, "lease": lease, "contract": contract}


def session_contract(store, work_id):
    work = store.get(work_id)
    if work is None or work.type != RecordType.work_unit:
        raise ProjectIntelligenceError("work_id must reference a work unit")
    requirement_edges = [e for e in _relations(store, RelationType.implements) if e.source_record_id == work_id]
    requirements = [store.get(e.target_record_id) for e in requirement_edges]
    criteria = [store.get(e.target_record_id) for req in requirements for e in _relations(store, RelationType.contains)
                if e.source_record_id == req.id]
    dependency_edges = [e for e in _relations(store, RelationType.depends_on) if e.source_record_id == work_id]
    dependencies = [store.get(e.target_record_id) for e in dependency_edges
                    if store.get(e.target_record_id).type == RecordType.work_unit]
    decisions = [store.get(e.target_record_id) for e in dependency_edges
                 if store.get(e.target_record_id).type in {RecordType.decision, RecordType.constraint}]
    linked_ids = {work_id, *(record.id for record in requirements)}
    incidents = [record for record in _records(store)
                 if record.type in {RecordType.bug, RecordType.fix, RecordType.regression}
                 and any(edge.source_record_id == record.id and edge.target_record_id in linked_ids
                         for edge in _relations(store))]
    scope_paths = set(work.content.get("scope", {}).get("paths", []))
    failures = [record for record in _records(store, RecordType.failure)
                if any(edge.target_record_id in linked_ids and edge.source_record_id == record.id
                       for edge in _relations(store))
                or scope_paths.intersection(record.related_files)]
    return {"work_unit_id": work_id, "objective": work.content["objective"],
            "scope": work.content.get("scope", {}),
            "requirements": [{"id": r.id, "statement": r.content["statement"], "state": state_of(store, r.id)} for r in requirements],
            "acceptance_criteria": [{"id": c.id, "statement": c.content["statement"], "mandatory": c.content["mandatory"]} for c in criteria],
            "dependencies": [{"id": r.id, "title": r.title, "state": state_of(store, r.id)} for r in dependencies],
            "active_decisions": [{"id": r.id, "title": r.title,
                                  "state": decision_state_for(r.id, _records(store), _relations(store))}
                                 for r in decisions],
            "known_incidents": [{"id": r.id, "type": r.type.value, "title": r.title,
                                 "summary": r.summary, "state": state_of(store, r.id)}
                                for r in incidents],
            "previous_failed_attempts": [{"id": r.id, "title": r.title,
                                           "summary": r.summary} for r in failures],
            "readiness": evaluate_readiness(store, work_id)}


def renew_lease(store, work_id, session_id, *, lease_seconds=3600):
    with _checkout_lock(store):
        current = _valid_lease(store, work_id)
        if current is None or current.content["session_id"] != session_id:
            raise ProjectIntelligenceError("session does not own an active lease")
        seconds = int(lease_seconds)
        if seconds < 30 or seconds > 86400:
            raise ProjectIntelligenceError("lease_seconds must be between 30 and 86400")
        now = dt.datetime.now(dt.timezone.utc)
        content = dict(current.content)
        content.update({"claimed_at": content["claimed_at"],
                        "expires_at": (now + dt.timedelta(seconds=seconds)).isoformat(),
                        "renewed_at": now.isoformat()})
        return _record(store, RecordType.observation, "pi_work_lease", uuid.uuid4().hex,
                       "Work lease renewal", f"Lease renewed by session {session_id}.", content,
                       truth_domain=TruthDomain.history, tags=("project-intelligence", "lease"))


def _close_lease(store, work_id, session_id, status="RELEASED"):
    current = _valid_lease(store, work_id)
    if current is None:
        return None
    if current.content["session_id"] != session_id:
        raise ProjectIntelligenceError("session does not own this work lease")
    content = dict(current.content)
    content.update({"lease_state": status, "released_at": utc_now_iso()})
    return _record(store, RecordType.observation, "pi_work_lease", uuid.uuid4().hex,
                   "Work lease released", f"Lease released by session {session_id}.", content,
                   truth_domain=TruthDomain.history, tags=("project-intelligence", "lease"))


def finish_session(store, session_id, *, changed_files=(), summary="", commit_sha=None,
                   tests=(), build_result=None, changed_symbols=(), reuse_analysis=None,
                   limitations=(), decision_ids=(), bug_ids=(), unresolved_work=()):
    with _checkout_lock(store):
        return _finish_session_locked(store, session_id, changed_files=changed_files,
                                      summary=summary, commit_sha=commit_sha,
                                      tests=tests, build_result=build_result,
                                      changed_symbols=changed_symbols, reuse_analysis=reuse_analysis,
                                      limitations=limitations, decision_ids=decision_ids,
                                      bug_ids=bug_ids, unresolved_work=unresolved_work)


def _finish_session_locked(store, session_id, *, changed_files=(), summary="", commit_sha=None,
                           tests=(), build_result=None, changed_symbols=(), reuse_analysis=None,
                           limitations=(), decision_ids=(), bug_ids=(), unresolved_work=()):
    session = store.get(session_id)
    if session is None or session.type != RecordType.session:
        raise ProjectIntelligenceError("session_id must reference a session")
    work_id = session.content["work_unit_id"]
    if session.content.get("read_only"):
        raise ProjectIntelligenceError("read-only sessions cannot record implementation")
    if state_of(store, session_id) != "ACTIVE":
        raise ProjectIntelligenceError(f"session must be ACTIVE to finish, found {state_of(store, session_id)}")
    lease = _valid_lease(store, session.content["work_unit_id"])
    if lease is None or lease.content["session_id"] != session_id:
        raise ProjectIntelligenceError("session must own the active work lease to finish")
    files = sorted(set(str(path).replace("\\", "/") for path in changed_files))
    if any(Path(path).is_absolute() or ".." in Path(path).parts for path in files):
        raise ProjectIntelligenceError("implementation paths must be repository-relative")
    symbols = sorted(set(_text(item, "changed symbol") for item in changed_symbols))
    limitations = [_text(item, "limitation") for item in limitations]
    unresolved_work = [_text(item, "unresolved work") for item in unresolved_work]
    decisions = [store.get(item) for item in decision_ids]
    bugs = [store.get(item) for item in bug_ids]
    if any(item is None or item.type not in {RecordType.decision, RecordType.constraint} for item in decisions):
        raise ProjectIntelligenceError("decision_ids must reference existing decisions or constraints")
    if any(item is None or item.type != RecordType.bug for item in bugs):
        raise ProjectIntelligenceError("bug_ids must reference existing bug records")
    if reuse_analysis is not None:
        if not isinstance(reuse_analysis, dict):
            raise ProjectIntelligenceError("reuse_analysis must be an object")
        if reuse_analysis.get("mode") not in {"REUSE", "EXTEND", "REPLACE", "CREATE"}:
            raise ProjectIntelligenceError("reuse_analysis.mode must be REUSE, EXTEND, REPLACE, or CREATE")
        reuse_analysis = {**reuse_analysis,
                          "searched": list(reuse_analysis.get("searched", [])),
                          "considered": list(reuse_analysis.get("considered", [])),
                          "reason": _text(reuse_analysis.get("reason"), "reuse_analysis.reason")}
    normalized_tests = []
    for index, item in enumerate(tests or ()):
        if isinstance(item, str):
            item = {"name": item, "result": "UNKNOWN"}
        if not isinstance(item, dict):
            raise ProjectIntelligenceError("test evidence must be text or an object")
        result = str(item.get("result", "UNKNOWN")).upper()
        if result not in {"PASS", "FAIL", "BLOCKED", "UNKNOWN"}:
            raise ProjectIntelligenceError("test result must be PASS, FAIL, BLOCKED, or UNKNOWN")
        normalized_tests.append((index, item, result, _text(item.get("name", f"Session test {index + 1}"), "test name")))
    build_result = str(build_result).upper() if build_result is not None else None
    if build_result not in {None, "PASS", "FAIL", "BLOCKED", "UNKNOWN"}:
        raise ProjectIntelligenceError("build_result must be PASS, FAIL, BLOCKED, or UNKNOWN")
    git_record = None
    if commit_sha:
        if not re.fullmatch(r"[0-9a-f]{40}", commit_sha):
            raise ProjectIntelligenceError("commit_sha must be a full 40-character SHA")
        result = subprocess.run(["git", "-C", str(store.paths.root), "cat-file", "-e", f"{commit_sha}^{{commit}}"],
                                capture_output=True, text=True)
        if result.returncode:
            raise ProjectIntelligenceError("commit_sha cannot be resolved in this repository")
        from .capture import capture_git_change
        git_record, _ = capture_git_change(store, commit_sha)
    test_evidence = []
    for index, item, result, name in normalized_tests:
        test = _record(store, RecordType.test_result, "pi_session_test",
                       f"{session_id}:{index}:{hashlib.sha256(json.dumps(item, sort_keys=True).encode()).hexdigest()}",
                       name,
                       str(item.get("summary") or item.get("command") or "Session test evidence"),
                       {"result": result, "command": item.get("command"), "exit_code": item.get("exit_code"),
                        "session_id": session_id, "recorded_at": utc_now_iso()},
                       authority=Authority.agent_observed, truth_domain=TruthDomain.implementation,
                       tags=("project-intelligence", "test-result"))
        test_evidence.append(test)
    build_evidence = None
    if build_result is not None:
        build_evidence = _record(store, RecordType.test_result, "pi_session_build",
                                 f"{session_id}:{build_result}", "Build result",
                                 f"Build result: {build_result}.",
                                 {"result": build_result, "session_id": session_id,
                                  "recorded_at": utc_now_iso(), "kind": "build"},
                                 authority=Authority.agent_observed,
                                 truth_domain=TruthDomain.implementation,
                                 tags=("project-intelligence", "build-result"))
    implementation = _record(store, RecordType.implementation, "pi_implementation", session_id,
                             f"Implementation for {work_id}", summary or "Implementation session completed.",
                             {"work_unit_id": work_id, "session_id": session_id,
                              "changed_files": files, "commit_sha": commit_sha,
                              "test_result_ids": [record.id for record in test_evidence],
                              "build_result_id": build_evidence.id if build_evidence else None,
                              "build_result": build_result,
                              "changed_symbols": symbols,
                              "reuse_analysis": reuse_analysis,
                              "limitations": limitations,
                              "decision_ids": sorted(item.id for item in decisions),
                              "bug_ids": sorted(item.id for item in bugs),
                              "unresolved_work": unresolved_work}, authority=Authority.agent_observed,
                             truth_domain=TruthDomain.implementation, related_files=files,
                             related_symbols=symbols,
                             tags=("project-intelligence", "implementation"))
    _link(store, implementation, session, RelationType.created_during)
    if git_record:
        _link(store, implementation, git_record, RelationType.produced_commit)
    for test in test_evidence:
        _link(store, implementation, test, RelationType.validated_by)
    if build_evidence:
        _link(store, implementation, build_evidence, RelationType.validated_by)
    _close_lease(store, work_id, session_id)
    work = store.get(work_id)
    _set_state(store, work, "IMPLEMENTED", reason=f"Implementation recorded by session {session_id}",
               evidence=(implementation.id,))
    for edge in _relations(store, RelationType.implements):
        if edge.source_record_id != work_id:
            continue
        requirement = store.get(edge.target_record_id)
        state = state_of(store, requirement.id)
        if state == "ACCEPTED":
            _set_state(store, requirement, "PLANNED", reason=f"Work started for {requirement.id}")
            state = "PLANNED"
        if state in {"PLANNED", "REGRESSED"}:
            _set_state(store, requirement, "IN_PROGRESS", reason=f"Session {session_id} implemented requirement")
            state = "IN_PROGRESS"
        if state == "IN_PROGRESS":
            _set_state(store, requirement, "IMPLEMENTED", reason=f"Implementation {implementation.id} recorded",
                       evidence=(implementation.id,))
    _set_state(store, session, "FINISHING", reason="Session implementation captured",
               evidence=(implementation.id,))
    _set_state(store, session, "COMPLETED", reason="Session closed successfully",
               evidence=(implementation.id,))
    return implementation


def checkpoint_session(store, session_id, summary, *, open_work="", source_id=None):
    session = store.get(session_id)
    if session is None or session.type != RecordType.session:
        raise ProjectIntelligenceError("session_id must reference a session")
    state = state_of(store, session_id)
    if state not in {"ACTIVE", "BLOCKED"}:
        raise ProjectIntelligenceError(f"cannot checkpoint session in state {state}")
    checkpoint = _record(store, RecordType.checkpoint, "pi_session_checkpoint",
                         source_id or uuid.uuid4().hex, f"Checkpoint for session {session_id}", summary,
                         {"checkpoint_kind": "session", "session_id": session_id,
                          "work_unit_id": session.content["work_unit_id"],
                          "open_work": open_work},
                         truth_domain=TruthDomain.history,
                         tags=("project-intelligence", "session-checkpoint"))
    _link(store, checkpoint, session, RelationType.created_during)
    return checkpoint


def block_session(store, session_id, reason):
    session = store.get(session_id)
    if session is None or session.type != RecordType.session:
        raise ProjectIntelligenceError("session_id must reference a session")
    with _checkout_lock(store):
        if state_of(store, session_id) != "ACTIVE":
            raise ProjectIntelligenceError("only ACTIVE sessions can be blocked")
        event = _set_state(store, session, "BLOCKED", reason=_text(reason, "reason"))
        work = store.get(session.content["work_unit_id"])
        if state_of(store, work.id) == "IN_PROGRESS":
            _set_state(store, work, "BLOCKED", reason=f"Session {session_id} is blocked",
                       evidence=(event.id,))
        return event


def resume_session(store, session_id):
    session = store.get(session_id)
    if session is None or session.type != RecordType.session:
        raise ProjectIntelligenceError("session_id must reference a session")
    with _checkout_lock(store):
        if state_of(store, session_id) != "BLOCKED":
            raise ProjectIntelligenceError("only BLOCKED sessions can resume")
        work_id = session.content["work_unit_id"]
        lease = _valid_lease(store, work_id)
        if lease is None or lease.content["session_id"] != session_id:
            raise ProjectIntelligenceError("session lease expired or was released; reclaim the work before resuming")
        event = _set_state(store, session, "ACTIVE", reason="Session resumed")
        work = store.get(work_id)
        if state_of(store, work.id) == "BLOCKED":
            _set_state(store, work, "IN_PROGRESS", reason=f"Session {session_id} resumed",
                       evidence=(event.id,))
        return event


def verify_work(store, work_id, commit_sha, criterion_results, *, verification_type="automated",
                human_confirmation=None):
    with _checkout_lock(store):
        return _verify_work_locked(store, work_id, commit_sha, criterion_results,
                                  verification_type=verification_type,
                                  human_confirmation=human_confirmation)


def _verify_work_locked(store, work_id, commit_sha, criterion_results, *, verification_type="automated",
                        human_confirmation=None):
    work = store.get(work_id)
    if work is None or work.type != RecordType.work_unit:
        raise ProjectIntelligenceError("work_id must reference a work unit")
    verification_type = {"human": "human_confirmed"}.get(verification_type, verification_type)
    if verification_type not in {"automated", "agent_reviewed", "human_confirmed", "runtime_observed"}:
        raise ProjectIntelligenceError(
            "verification_type must be automated, agent_reviewed, human_confirmed, or runtime_observed")
    if verification_type == "human_confirmed" and human_confirmation != work_id:
        raise ProjectIntelligenceError("human verification requires interactive confirmation using the work ID")
    if not re.fullmatch(r"[0-9a-f]{40}", commit_sha or ""):
        raise ProjectIntelligenceError("verification requires a full commit SHA")
    result = subprocess.run(["git", "-C", str(store.paths.root), "cat-file", "-e", f"{commit_sha}^{{commit}}"],
                            capture_output=True, text=True)
    if result.returncode:
        raise ProjectIntelligenceError("verification commit cannot be resolved in this repository")
    implementations = [r for r in _records(store, RecordType.implementation)
                       if r.content.get("work_unit_id") == work_id and r.content.get("commit_sha")]
    if not implementations:
        raise ProjectIntelligenceError("verification requires recorded implementation linked to a commit")
    policy = work.content.get("completion_policy", {})
    if policy.get("require_tests", True) and not any(
            store.get(test_id) is not None and store.get(test_id).content.get("result") == "PASS"
            for implementation in implementations for test_id in implementation.content.get("test_result_ids", [])):
        raise ProjectIntelligenceError("completion policy requires a passing recorded test result")
    if policy.get("require_build", True) and not any(implementation.content.get("build_result") == "PASS"
                                                       for implementation in implementations):
        raise ProjectIntelligenceError("completion policy requires a passing recorded build result")
    applicable = False
    for implementation in implementations:
        base = implementation.content["commit_sha"]
        ancestry = subprocess.run(["git", "-C", str(store.paths.root), "merge-base", "--is-ancestor", base, commit_sha],
                                  capture_output=True, text=True)
        if ancestry.returncode == 0:
            applicable = True
            break
    if not applicable:
        raise ProjectIntelligenceError("verification commit must contain a recorded implementation commit")
    if state_of(store, work_id) not in {"IMPLEMENTED", "NEEDS_REVERIFICATION", "REGRESSED"}:
        raise ProjectIntelligenceError("work must be IMPLEMENTED or NEEDS_REVERIFICATION before verification")
    required = [e.target_record_id for req_edge in _relations(store, RelationType.implements)
                if req_edge.source_record_id == work_id
                for e in _relations(store, RelationType.contains) if e.source_record_id == req_edge.target_record_id
                and store.get(e.target_record_id).content.get("mandatory", True)]
    if not required:
        raise ProjectIntelligenceError("verification requires at least one mandatory acceptance criterion")
    if not isinstance(criterion_results, (list, tuple)):
        raise ProjectIntelligenceError("criterion_results must be a list")
    provided = {item.get("criterion_id"): item for item in criterion_results if isinstance(item, dict)}
    if len(provided) != len(criterion_results):
        raise ProjectIntelligenceError("criterion_results contains malformed or duplicate entries")
    missing = sorted(set(required) - set(provided))
    if missing:
        raise ProjectIntelligenceError("verification missing mandatory criteria: " + ", ".join(missing))
    extra = sorted(set(provided) - set(required))
    if extra:
        raise ProjectIntelligenceError("verification contains unrelated criteria: " + ", ".join(extra))
    criteria = []
    for criterion_id in required:
        criterion = store.get(criterion_id)
        if criterion is None or criterion.type != RecordType.acceptance_criterion:
            raise ProjectIntelligenceError(f"criterion is missing or has the wrong type: {criterion_id}")
        item = provided[criterion_id]
        if item.get("result") not in {"PASS", "FAIL", "BLOCKED"}:
            raise ProjectIntelligenceError(f"invalid criterion result for {criterion_id}")
        evidence = item.get("evidence") or []
        if not evidence:
            raise ProjectIntelligenceError(f"criterion {criterion_id} requires canonical evidence records")
        human_evidence_found = False
        for evidence_id in evidence:
            evidence_record = store.get(evidence_id)
            if evidence_record is None or evidence_record.type not in {
                    RecordType.test_result, RecordType.observation, RecordType.deployment}:
                raise ProjectIntelligenceError(f"unsupported verification evidence: {evidence_id}")
            if (evidence_record.type == RecordType.test_result
                    and evidence_record.content.get("result") != item["result"]):
                raise ProjectIntelligenceError(f"test evidence result does not match criterion: {evidence_id}")
            if (verification_type == "human_confirmed" and evidence_record.type == RecordType.observation
                    and evidence_record.authority not in {Authority.human_direct, Authority.human_evidenced}):
                raise ProjectIntelligenceError(f"human verification requires human evidence: {evidence_id}")
            if (evidence_record.type == RecordType.observation
                    and evidence_record.authority in {Authority.human_direct, Authority.human_evidenced}):
                human_evidence_found = True
            if (verification_type == "runtime_observed"
                    and evidence_record.authority != Authority.runtime_verified
                    and evidence_record.type != RecordType.deployment):
                raise ProjectIntelligenceError(f"runtime verification requires runtime or deployment evidence: {evidence_id}")
        if verification_type == "human_confirmed" and not human_evidence_found:
            raise ProjectIntelligenceError(f"criterion {criterion_id} requires an explicit human observation")
        criteria.append({"criterion_id": criterion_id, "result": item["result"], "evidence": evidence})
    overall = "PASS" if all(item["result"] == "PASS" for item in criteria) else "FAIL"
    verification = _record(store, RecordType.verification, "pi_verification",
                           f"{work_id}:{commit_sha}:{hashlib.sha256(json.dumps(criteria, sort_keys=True).encode()).hexdigest()}",
                           f"Verification for {work_id}", f"{overall} at {commit_sha}",
                           {"verification_type": verification_type,
                            "target_snapshot": {"commit": commit_sha}, "criteria": criteria,
                            "overall": overall, "initial_state": "VERIFIED" if overall == "PASS" else "IMPLEMENTED"},
                           authority={"automated": Authority.code_verified,
                                      "agent_reviewed": Authority.agent_observed,
                                      "human_confirmed": Authority.human_evidenced,
                                      "runtime_observed": Authority.runtime_verified}[verification_type],
                           truth_domain=TruthDomain.implementation,
                           tags=("project-intelligence", "verification"))
    _link(store, verification, work, RelationType.verifies)
    if overall == "PASS":
        _set_state(store, work, "VERIFIED", reason=f"All mandatory criteria passed at {commit_sha}", evidence=(verification.id,))
        for req_edge in _relations(store, RelationType.implements):
            if req_edge.source_record_id == work_id:
                req = store.get(req_edge.target_record_id)
                if state_of(store, req.id) in {"IMPLEMENTED", "NEEDS_REVERIFICATION"}:
                    _set_state(store, req, "VERIFIED", reason=f"Verified by {verification.id}", evidence=(verification.id,))
    return verification


def verification_staleness(store, verification_id, *, head="HEAD"):
    verification = store.get(verification_id)
    if verification is None or verification.type != RecordType.verification:
        raise ProjectIntelligenceError("verification_id must reference a verification")
    base = verification.content["target_snapshot"]["commit"]
    head_sha = subprocess.run(["git", "-C", str(store.paths.root), "rev-parse", "--verify", f"{head}^{{commit}}"],
                              capture_output=True, text=True)
    if head_sha.returncode:
        raise ProjectIntelligenceError("current Git revision cannot be resolved")
    work_edges = [e for e in _relations(store, RelationType.verifies) if e.source_record_id == verification_id]
    work_ids = {edge.target_record_id for edge in work_edges}
    implementations = [r for r in _records(store, RecordType.implementation)
                       if r.content.get("work_unit_id") in work_ids]
    scoped = sorted({path for impl in implementations for path in impl.content.get("changed_files", [])})
    reasons = []
    if scoped and base != head_sha.stdout.strip():
        changed = subprocess.run(["git", "-C", str(store.paths.root), "diff", "--name-only", f"{base}..{head_sha.stdout.strip()}"],
                                 capture_output=True, text=True)
        if changed.returncode:
            reasons.append("GIT_RANGE_UNAVAILABLE")
        elif set(scoped).intersection(changed.stdout.splitlines()):
            reasons.append("TRACKED_IMPLEMENTATION_FILES_CHANGED")
    stale_event = None
    if reasons:
        stale_key = f"{verification_id}:{head_sha.stdout.strip()}:{','.join(sorted(reasons))}"
        stale_event = _record(store, RecordType.observation, "pi_verification_stale", stale_key,
                              "Verification needs reverification", "; ".join(sorted(reasons)),
                              {"event_kind": "verification_stale", "verification_id": verification_id,
                               "current_commit": head_sha.stdout.strip(), "reasons": sorted(reasons)},
                              truth_domain=TruthDomain.history,
                              tags=("project-intelligence", "verification-stale"))
        _link(store, stale_event, verification, RelationType.invalidates_verification)
        for edge in work_edges:
            work = store.get(edge.target_record_id)
            if state_of(store, work.id) == "VERIFIED":
                _set_state(store, work, "NEEDS_REVERIFICATION",
                           reason="Relevant implementation files changed after verification",
                           evidence=(verification_id, stale_event.id))
            for implemented_edge in _relations(store, RelationType.implements):
                if implemented_edge.source_record_id != work.id:
                    continue
                requirement = store.get(implemented_edge.target_record_id)
                if state_of(store, requirement.id) == "VERIFIED":
                    _set_state(store, requirement, "NEEDS_REVERIFICATION",
                               reason="Relevant implementation files changed after verification",
                               evidence=(verification_id, stale_event.id))
    return {"stale": bool(reasons), "reasons": reasons, "verified_commit": base,
            "current_commit": head_sha.stdout.strip(),
            "stale_event_id": stale_event.id if stale_event else None}


def record_incident(store, record_type, title, summary, *, related_ids=(), source_id=None):
    if record_type not in {RecordType.bug, RecordType.fix, RecordType.regression}:
        raise ProjectIntelligenceError("incident type must be bug, fix, or regression")
    related = [store.get(item) for item in related_ids]
    if any(item is None for item in related):
        raise ProjectIntelligenceError("incident targets must already exist")
    incident = _record(store, record_type, f"pi_{record_type.value}", source_id or new_source_id(),
                       title, summary, {"title": title, "summary": summary,
                                        "initial_state": "PROPOSED" if record_type == RecordType.fix else "IN_PROGRESS"},
                       authority=Authority.agent_reported, truth_domain=TruthDomain.history,
                       tags=("project-intelligence", "incident"))
    for related in related:
        if record_type == RecordType.bug:
            relation = RelationType.affects
        elif record_type == RecordType.fix:
            relation = (RelationType.fixes if related.type in {RecordType.bug, RecordType.regression} else
                        RelationType.produced_commit if related.type == RecordType.git_change else
                        RelationType.created_during if related.type == RecordType.session else
                        RelationType.affects)
        else:
            relation = (RelationType.regressed_by if related.type in {RecordType.implementation, RecordType.git_change}
                        else RelationType.affects)
        _link(store, incident, related, relation)
        if record_type == RecordType.regression and related.type in {RecordType.requirement, RecordType.work_unit}:
            state = state_of(store, related.id)
            if "REGRESSED" in _TRANSITIONS.get(state, set()):
                _set_state(store, related, "REGRESSED", reason=f"Regression {incident.id} recorded",
                           evidence=(incident.id,))
    return incident


def close_bug(store, bug_id, *, fix_id=None, disposition=None, confirmation=None):
    bug = store.get(bug_id)
    if bug is None or bug.type != RecordType.bug:
        raise ProjectIntelligenceError("bug_id must reference a bug")
    linked_fixes = [edge for edge in _relations(store, RelationType.fixes)
                    if edge.target_record_id == bug_id and store.get(edge.source_record_id).type == RecordType.fix]
    if fix_id:
        fix = store.get(fix_id)
        if fix is None or fix.type != RecordType.fix:
            raise ProjectIntelligenceError("fix_id must reference a fix")
        linked_fixes.append((fix, bug))
    if not linked_fixes and not _text(disposition or "", "disposition"):
        raise ProjectIntelligenceError("closing a bug requires a linked fix or explicit disposition")
    if confirmation != bug_id:
        raise ProjectIntelligenceError("bug closure requires interactive confirmation using the bug ID")
    source_id = f"{bug_id}:{fix_id or 'disposition'}:{hashlib.sha256((disposition or '').encode()).hexdigest()}"
    existing = store.get(derive_record_id(store.project_id, "pi_bug_closure", source_id, RecordType.observation))
    if existing is not None:
        return existing
    if fix_id:
        _link(store, fix, bug, RelationType.fixes)
    closure = _record(store, RecordType.observation, "pi_bug_closure",
                   f"{bug_id}:{fix_id or 'disposition'}:{hashlib.sha256((disposition or '').encode()).hexdigest()}",
                   "Bug closure", disposition or f"Closed with fix {fix_id}.",
                   {"event_kind": "bug_closed", "bug_id": bug_id, "fix_id": fix_id,
                    "disposition": disposition}, authority=Authority.human_direct,
                   truth_domain=TruthDomain.history,
                   tags=("project-intelligence", "incident"))
    _set_state(store, bug, "CLOSED", actor="human", reason=disposition or f"Closed with fix {fix_id}.",
               evidence=(closure.id,))
    return closure


def abandon_session(store, session_id, *, reason):
    with _checkout_lock(store):
        return _abandon_session_locked(store, session_id, reason=reason)


def _abandon_session_locked(store, session_id, *, reason):
    session = store.get(session_id)
    if session is None or session.type != RecordType.session:
        raise ProjectIntelligenceError("session_id must reference a session")
    state = state_of(store, session_id)
    if state not in {"ACTIVE", "BLOCKED"}:
        raise ProjectIntelligenceError(f"cannot abandon session in state {state}")
    event = _set_state(store, session, "ABANDONED", reason=_text(reason, "reason"))
    _close_lease(store, session.content["work_unit_id"], session_id, status="ABANDONED")
    work = store.get(session.content["work_unit_id"])
    if state_of(store, work.id) == "IN_PROGRESS":
        _set_state(store, work, "BLOCKED", reason=f"Session {session_id} was abandoned",
                   evidence=(event.id,))
    return event


def validate_plan(store):
    records = _records(store)
    by_id = {record.id: record for record in records}
    edges = _relations(store)
    errors = []
    if cycle := dependency_cycle(store):
        errors.append({"code": "DEPENDENCY_CYCLE", "record_ids": cycle})
    planned_requirements = {edge.target_record_id for edge in edges
                           if edge.relation == RelationType.implements
                           and edge.source_record_id in by_id
                           and by_id[edge.source_record_id].type == RecordType.work_unit}
    for requirement in (record for record in records if record.type == RecordType.requirement
                        and state_of(store, record.id) in {"ACCEPTED", "PLANNED", "IN_PROGRESS"}):
        criteria = [edge.target_record_id for edge in edges
                    if edge.relation == RelationType.contains and edge.source_record_id == requirement.id]
        if requirement.id not in planned_requirements:
            errors.append({"code": "ORPHAN_REQUIRED_REQUIREMENT", "record_id": requirement.id})
        if not any(by_id[item].content.get("mandatory", True) for item in criteria if item in by_id):
            errors.append({"code": "MISSING_MANDATORY_ACCEPTANCE_CRITERIA", "record_id": requirement.id})
    for work in (record for record in records if record.type == RecordType.work_unit):
        if not str(work.content.get("objective", "")).strip():
            errors.append({"code": "WORK_WITHOUT_GOAL", "record_id": work.id})
        for edge in edges:
            if edge.relation == RelationType.depends_on and edge.source_record_id == work.id:
                dependency = by_id.get(edge.target_record_id)
                if dependency is None or state_of(store, dependency.id) == "SUPERSEDED":
                    errors.append({"code": "DEPENDENCY_SUPERSEDED_OR_MISSING", "record_id": work.id,
                                   "dependency_id": edge.target_record_id})
    return {"valid": not errors, "errors": errors}


def release_readiness(store):
    records = _records(store)
    baselines = [record for record in records if record.type == RecordType.checkpoint
                 and record.content.get("checkpoint_kind") == "project_intelligence_baseline"]
    baselines.sort(key=lambda record: (record.created_at, record.id))
    baseline = baselines[-1] if baselines else None
    accepted_ids = baseline.content.get("accepted_ids", []) if baseline else []
    required = [store.get(record_id) for record_id in accepted_ids]
    required = [record for record in required if record and record.type == RecordType.requirement
                and record.content.get("priority", "required") == "required"]
    blockers = []
    if baseline is None:
        blockers.append({"code": "BASELINE_MISSING"})
    for requirement in required:
        state = state_of(store, requirement.id)
        if state != "VERIFIED":
            blockers.append({"code": "REQUIREMENT_NOT_VERIFIED", "record_id": requirement.id,
                             "state": state})
    for conflict in records:
        if (conflict.type == RecordType.observation
                and conflict.content.get("observation_kind") == "reconciliation"
                and conflict.content.get("critical")
                and not any(item.content.get("target_id") == conflict.id
                            and item.content.get("observation_kind") == "reconciliation_resolution"
                            for item in records)):
            blockers.append({"code": "CRITICAL_CONFLICT_OPEN", "record_id": conflict.id})
    for bug in (record for record in records if record.type == RecordType.bug):
        if state_of(store, bug.id) != "CLOSED":
            blockers.append({"code": "BUG_OPEN", "record_id": bug.id})
    for regression in (record for record in records if record.type == RecordType.regression):
        has_fix = any(edge.relation == RelationType.fixes and edge.target_record_id == regression.id
                      and store.get(edge.source_record_id)
                      and store.get(edge.source_record_id).type == RecordType.fix
                      for edge in _relations(store))
        if not has_fix:
            blockers.append({"code": "REGRESSION_OPEN", "record_id": regression.id})
    stale_requirements = [record.id for record in required
                          if state_of(store, record.id) == "NEEDS_REVERIFICATION"]
    configured_checks = [record for record in records if record.type == RecordType.work_unit
                         and record.content.get("release_gate")]
    for check in configured_checks:
        state = state_of(store, check.id)
        if state != "VERIFIED":
            blockers.append({"code": "RELEASE_CHECK_NOT_VERIFIED", "record_id": check.id,
                             "state": state})
    return {"ready": not blockers, "baseline_id": baseline.id if baseline else None,
            "required_requirements": len(required), "verified_requirements": sum(
                state_of(store, item.id) == "VERIFIED" for item in required),
            "release_checks": len(configured_checks), "stale_requirement_ids": stale_requirements,
            "blocking_reasons": blockers}


def project_context(store):
    records = _records(store)
    baselines = [r for r in records if r.type == RecordType.checkpoint
                 and r.content.get("checkpoint_kind") == "project_intelligence_baseline"]
    baselines.sort(key=lambda r: (r.created_at, r.id))
    phases = sorted((r for r in records if r.type == RecordType.phase),
                    key=lambda r: (r.content.get("ordinal", 0), r.id))
    open_reconciliations = [r for r in records if r.type == RecordType.observation
                            and r.content.get("observation_kind") == "reconciliation"
                            and not any(x.content.get("target_id") == r.id for x in records)]
    work = [r for r in records if r.type == RecordType.work_unit]
    relations = _relations(store)
    sessions = [r for r in records if r.type == RecordType.session]
    implementations = [r for r in records if r.type == RecordType.implementation]
    verifications = [r for r in records if r.type == RecordType.verification]
    incidents = [r for r in records if r.type in {RecordType.bug, RecordType.fix, RecordType.regression}]
    counts = {}
    work_summaries = []
    for item in work:
        state = state_of(store, item.id)
        counts[state] = counts.get(state, 0) + 1
        phase_edge = next((edge for edge in _relations(store, RelationType.contains)
                           if edge.target_record_id == item.id
                           and edge.source_record_id in {phase.id for phase in phases}), None)
        work_summaries.append({"id": item.id, "title": item.content["title"],
                               "objective": item.content["objective"], "state": state,
                               "phase_id": phase_edge.source_record_id if phase_edge else None,
                               "requirement_ids": [edge.target_record_id for edge in relations
                                                   if edge.relation == RelationType.implements
                                                   and edge.source_record_id == item.id],
                               "dependency_ids": [edge.target_record_id for edge in relations
                                                  if edge.relation == RelationType.depends_on
                                                  and edge.source_record_id == item.id],
                               "session_ids": [r.id for r in sessions
                                               if r.content.get("work_unit_id") == item.id],
                               "implementation_ids": [r.id for r in implementations
                                                      if r.content.get("work_unit_id") == item.id],
                               "verification_ids": [edge.source_record_id for edge in relations
                                                    if edge.relation == RelationType.verifies
                                                    and edge.target_record_id == item.id],
                               "readiness": evaluate_readiness(store, item.id)})
    requirement_counts = {}
    for item in (r for r in records if r.type == RecordType.requirement):
        state = state_of(store, item.id)
        requirement_counts[state] = requirement_counts.get(state, 0) + 1
    open_bugs = [r.id for r in records if r.type == RecordType.bug and state_of(store, r.id) != "CLOSED"]
    stale_events = [r.id for r in records if r.type == RecordType.observation
                    and r.content.get("event_kind") == "verification_stale"]
    requirements = [r for r in records if r.type == RecordType.requirement]
    dependency_edges = [e for e in _relations(store, RelationType.depends_on)]
    return {"project_id": store.project_id, "project_name": store.require_manifest()["name"],
            "baseline_id": baselines[-1].id if baselines else None,
            "open_reconciliations": [{"id": r.id, "classification": r.content["classification"],
                                      "summary": r.content["summary"]} for r in open_reconciliations],
            "phases": [{"id": r.id, "name": r.content["name"], "ordinal": r.content["ordinal"],
                        "state": state_of(store, r.id)} for r in phases],
            "work_state_counts": counts, "requirement_state_counts": requirement_counts,
            "open_bug_ids": open_bugs, "stale_verification_event_ids": stale_events,
            "work_units": work_summaries,
            "requirements": [{"id": r.id, "statement": r.content.get("statement", r.title),
                              "kind": r.content.get("requirement_kind", "requirement"),
                              "priority": r.content.get("priority", "required"),
                              "state": state_of(store, r.id)} for r in requirements],
            "dependencies": [{"work_id": edge.source_record_id,
                              "depends_on_id": edge.target_record_id}
                             for edge in dependency_edges],
            "sessions": [{"id": r.id, "title": r.title, "state": state_of(store, r.id),
                          "work_unit_id": r.content.get("work_unit_id"),
                          "branch": r.content.get("branch"), "started_at": r.content.get("started_at"),
                          "base_commit": r.content.get("base_commit"),
                          "read_only": bool(r.content.get("read_only")),
                          "known_incidents": (r.content.get("contract") or {}).get("known_incidents", []),
                          "previous_failed_attempts": (r.content.get("contract") or {}).get("previous_failed_attempts", [])}
                         for r in sessions],
            "implementations": [{"id": r.id, "summary": r.summary,
                                 "work_unit_id": r.content.get("work_unit_id"),
                                 "session_id": r.content.get("session_id"),
                                 "commit_sha": r.content.get("commit_sha"),
                                 "changed_files": r.content.get("changed_files", [])}
                                for r in implementations],
            "verifications": [{"id": r.id, "summary": r.summary,
                               "overall": r.content.get("overall"),
                               "verification_type": r.content.get("verification_type"),
                               "commit_sha": r.content.get("target_snapshot", {}).get("commit"),
                               "work_ids": [edge.target_record_id for edge in relations
                                            if edge.relation == RelationType.verifies
                                            and edge.source_record_id == r.id]}
                              for r in verifications],
            "incidents": [{"id": r.id, "type": r.type.value, "title": r.title,
                           "summary": r.summary, "state": state_of(store, r.id),
                           "related_ids": [edge.target_record_id for edge in relations
                                           if edge.source_record_id == r.id]}
                          for r in incidents],
            "plan_validation": validate_plan(store),
            "release_readiness": release_readiness(store)}


def work_context(store, work_id):
    contract = session_contract(store, work_id)
    work = store.get(work_id)
    related_ids = {work_id}
    related_ids.update(item["id"] for item in contract["requirements"])
    related_ids.update(item["id"] for item in contract["dependencies"])
    related_ids.update(item["id"] for item in contract["active_decisions"])
    incidents = [r for r in _records(store) if r.type in {RecordType.bug, RecordType.fix, RecordType.regression}
                 and any(e.source_record_id == r.id and e.target_record_id in related_ids
                         for e in _relations(store))]
    contract["work_unit"] = {"id": work.id, "title": work.content["title"],
                              "state": state_of(store, work.id)}
    contract["incidents"] = [{"id": r.id, "type": r.type.value,
                               "title": r.title, "summary": r.summary} for r in incidents]
    return contract


def session_context(store, session_id):
    session = store.get(session_id)
    if session is None or session.type != RecordType.session:
        raise ProjectIntelligenceError("session_id must reference a session")
    context = session.content.get("contract") or work_context(store, session.content["work_unit_id"])
    context["session"] = {"id": session.id, "state": state_of(store, session.id),
                          "agent": session.content.get("agent"),
                          "branch": session.content.get("branch"),
                          "base_commit": session.content.get("base_commit"),
                          "started_at": session.content.get("started_at")}
    context["checkpoints"] = [{"id": r.id, "summary": r.summary, "created_at": r.created_at}
                              for r in _records(store, RecordType.checkpoint)
                              if r.content.get("session_id") == session_id]
    context["implementations"] = [{"id": r.id, "summary": r.summary,
                                   "commit_sha": r.content.get("commit_sha"),
                                   "changed_files": r.content.get("changed_files", [])}
                                  for r in _records(store, RecordType.implementation)
                                  if r.content.get("session_id") == session_id]
    return context


def code_context(store, path):
    relative = _text(path, "path").replace("\\", "/")
    if Path(relative).is_absolute() or ".." in Path(relative).parts:
        raise ProjectIntelligenceError("code context path must be repository-relative")
    implementations = [r for r in _records(store, RecordType.implementation)
                       if relative in r.content.get("changed_files", [])]
    work_ids = {r.content.get("work_unit_id") for r in implementations}
    requirement_ids = {e.target_record_id for e in _relations(store, RelationType.implements)
                       if e.source_record_id in work_ids}
    relevant = implementations + [store.get(item) for item in requirement_ids]
    relevant_ids = {r.id for r in relevant if r is not None}
    incidents = [r for r in _records(store) if r.type in {RecordType.bug, RecordType.fix, RecordType.regression}
                 and any(e.source_record_id == r.id and e.target_record_id in relevant_ids
                         for e in _relations(store))]
    return {"path": relative,
            "implementations": [{"id": r.id, "summary": r.summary, "commit_sha": r.content.get("commit_sha"),
                                 "work_unit_id": r.content.get("work_unit_id")} for r in implementations],
            "requirements": [{"id": r.id, "statement": r.content.get("statement"),
                              "state": state_of(store, r.id)} for r in relevant if r and r.type == RecordType.requirement],
            "incidents": [{"id": r.id, "type": r.type.value, "title": r.title, "summary": r.summary}
                          for r in incidents],
            "status": "OK" if relevant_ids else "NO_MATCH"}


def project_intelligence_doctor(store):
    errors, warnings = [], []
    records = _records(store)
    by_id = {r.id: r for r in records}
    edges = _relations(store)
    state_events = {}
    for record in records:
        if record.type == RecordType.observation and record.content.get("event_kind") == "project_intelligence_state":
            state_events.setdefault(record.content.get("subject_id"), []).append(record)
    for subject_id, events in state_events.items():
        subject = by_id.get(subject_id)
        if subject is None:
            errors.append({"code": "STATE_EVENT_TARGET_MISSING", "record_id": events[0].id})
            continue
        events.sort(key=lambda r: (r.created_at, r.id))
        current = subject.content.get("initial_state", subject.content.get("state", "PROPOSED"))
        previous_id = None
        for event in events:
            body = event.content
            if body.get("previous_event_id") != previous_id or body.get("from_state") != current:
                errors.append({"code": "LIFECYCLE_EVENT_CHAIN_BROKEN", "record_id": event.id,
                               "subject_id": subject_id})
                break
            if body.get("to_state") not in _TRANSITIONS.get(current, set()):
                errors.append({"code": "INVALID_LIFECYCLE_TRANSITION", "record_id": event.id,
                               "subject_id": subject_id})
                break
            current = body["to_state"]
            previous_id = event.id
    derived = {e.source_record_id for e in edges if e.relation == RelationType.derived_from
               and e.target_record_id in by_id and by_id[e.target_record_id].type == RecordType.source_artifact}
    criterion_owners = {e.target_record_id for e in edges if e.relation == RelationType.contains
                        and e.source_record_id in by_id
                        and by_id[e.source_record_id].type == RecordType.requirement}
    work_phase = {e.target_record_id for e in edges if e.relation == RelationType.contains
                  and e.source_record_id in by_id and by_id[e.source_record_id].type == RecordType.phase}
    if cycle := dependency_cycle(store):
        errors.append({"code": "DEPENDENCY_CYCLE", "record_ids": cycle})
    for record in records:
        if record.type == RecordType.requirement and record.id not in derived:
            errors.append({"code": "ORPHAN_REQUIREMENT", "record_id": record.id})
        if record.type == RecordType.acceptance_criterion and record.id not in criterion_owners:
            errors.append({"code": "ORPHAN_ACCEPTANCE_CRITERION", "record_id": record.id})
        if record.type == RecordType.work_unit:
            if record.id not in work_phase:
                errors.append({"code": "ORPHAN_WORK_UNIT", "record_id": record.id})
            if not any(e.source_record_id == record.id and e.relation == RelationType.implements for e in edges):
                errors.append({"code": "WORK_WITHOUT_REQUIREMENT", "record_id": record.id})
        if record.type == RecordType.source_artifact:
            source = record.content.get("original_text", "").encode("utf-8")
            expected = "sha256:" + hashlib.sha256(source).hexdigest()
            if record.content.get("source_hash") != expected:
                errors.append({"code": "SOURCE_HASH_MISMATCH", "record_id": record.id})
    lease_groups = {}
    for lease in records:
        if lease.type == RecordType.observation and lease.content.get("event_kind") == "work_lease":
            lease_groups.setdefault(lease.content.get("work_unit_id"), []).append(lease)
    for leases in lease_groups.values():
        leases.sort(key=lambda r: (r.created_at, r.id))
        lease = leases[-1]
        session = by_id.get(lease.content.get("session_id"))
        if session is None:
            errors.append({"code": "LEASE_SESSION_MISSING", "record_id": lease.id})
        elif lease.content.get("lease_state") == "ACTIVE" and state_of(store, session.id) == "COMPLETED":
            errors.append({"code": "COMPLETED_SESSION_HAS_LEASE", "record_id": lease.id})
        elif lease.content.get("lease_state") == "ACTIVE" and state_of(store, session.id) not in {"ACTIVE", "BLOCKED"}:
            errors.append({"code": "LEASE_SESSION_NOT_ACTIVE", "record_id": lease.id})
    for verification in (r for r in records if r.type == RecordType.verification):
        for criterion in verification.content.get("criteria", []):
            for evidence_id in criterion.get("evidence", []):
                if evidence_id not in by_id:
                    errors.append({"code": "VERIFICATION_EVIDENCE_MISSING", "record_id": verification.id,
                                   "evidence_id": evidence_id})
    verified_work_ids = {edge.target_record_id for edge in edges
                         if edge.relation == RelationType.verifies
                         and edge.source_record_id in by_id
                         and by_id[edge.source_record_id].type == RecordType.verification}
    for record in records:
        if record.type in {RecordType.requirement, RecordType.work_unit} and state_of(store, record.id) == "VERIFIED":
            direct = any(edge.relation == RelationType.verifies
                         and edge.source_record_id in by_id
                         and by_id[edge.source_record_id].type == RecordType.verification
                         and edge.target_record_id == record.id for edge in edges)
            via_work = record.type == RecordType.requirement and any(
                edge.source_record_id in verified_work_ids and edge.target_record_id == record.id
                for edge in edges if edge.relation == RelationType.implements)
            if not (direct or via_work):
                errors.append({"code": "VERIFIED_WITHOUT_EVIDENCE", "record_id": record.id})
    return {"status": "unhealthy" if errors else ("degraded" if warnings else "healthy"),
            "errors": errors, "warnings": warnings}


def project_sqlite_state(conn, store):
    """Rebuild deterministic Project Intelligence query tables in a fresh cache."""
    conn.executescript("""
        CREATE TABLE pi_record_state (
            record_id TEXT PRIMARY KEY, record_type TEXT NOT NULL,
            state TEXT NOT NULL, latest_event_id TEXT
        );
        CREATE TABLE pi_work_readiness (
            work_id TEXT PRIMARY KEY, ready INTEGER NOT NULL,
            blocking_reasons_json TEXT NOT NULL
        );
        CREATE TABLE pi_work_lease (
            work_id TEXT PRIMARY KEY, session_id TEXT NOT NULL,
            lease_state TEXT NOT NULL, expires_at TEXT NOT NULL
        );
        CREATE TABLE pi_project_summary (
            key TEXT PRIMARY KEY, value_json TEXT NOT NULL
        );
    """)
    state_types = {RecordType.requirement, RecordType.acceptance_criterion, RecordType.phase,
                   RecordType.work_unit, RecordType.session, RecordType.implementation,
                   RecordType.verification, RecordType.bug, RecordType.fix, RecordType.regression}
    records = _records(store)
    for record in records:
        if record.type in state_types:
            event = state_event_for(store, record.id)
            conn.execute("INSERT INTO pi_record_state VALUES (?,?,?,?)",
                         (record.id, record.type.value, state_of(store, record.id), event.id if event else None))
    for work in (r for r in records if r.type == RecordType.work_unit):
        readiness = evaluate_readiness(store, work.id)
        conn.execute("INSERT INTO pi_work_readiness VALUES (?,?,?)",
                     (work.id, int(readiness["ready"]),
                      json.dumps(readiness["blocking_reasons"], sort_keys=True, separators=(",", ":"))))
    now = dt.datetime.now(dt.timezone.utc)
    lease_groups = {}
    for lease in records:
        if lease.type == RecordType.observation and lease.content.get("event_kind") == "work_lease":
            lease_groups.setdefault(lease.content["work_unit_id"], []).append(lease)
    for work_id, leases in lease_groups.items():
        leases.sort(key=lambda r: (r.created_at, r.id))
        lease = leases[-1]
        lease_state = lease.content["lease_state"]
        if lease_state == "ACTIVE" and dt.datetime.fromisoformat(lease.content["expires_at"]) <= now:
            lease_state = "EXPIRED"
        conn.execute("INSERT INTO pi_work_lease VALUES (?,?,?,?)",
                     (work_id, lease.content["session_id"], lease_state, lease.content["expires_at"]))
    summary = project_context(store)
    conn.execute("INSERT INTO pi_project_summary VALUES (?,?)",
                 ("current", json.dumps(summary, sort_keys=True, separators=(",", ":"))))
    return {"states": sum(record.type in state_types for record in records),
            "work_units": sum(record.type == RecordType.work_unit for record in records),
            "leases": len(lease_groups)}
