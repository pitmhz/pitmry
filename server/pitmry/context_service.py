"""Compact, trust-aware context for agent and CLI callers."""

from __future__ import annotations

import uuid
import json

from .canonical_store import CanonicalStore
from .enums import QueryStatus, RelationProvenance
from .models import MemoryRecord, RelationRecord
from .relations import explicit_relations, inferred_relations, relation_payload
from .retrieval import retrieve
from .state_resolver import (CONFLICTING, CURRENT, HISTORICAL, REVERTED,
                             SUPERSEDED, UNKNOWN, resolve_states)


def _short_provenance(record):
    return {
        "source_type": record.provenance.source_type,
        "source_id": record.provenance.source_id,
        "source_commit": record.provenance.source_commit,
        "evidence_refs": list(record.provenance.evidence_refs),
    }


def _serialize(record, state, reasons=None):
    title = record.title if len(record.title) <= 180 else record.title[:177].rstrip() + "..."
    summary = record.summary if len(record.summary) <= 700 else record.summary[:697].rstrip() + "..."
    return {
        "id": record.id,
        "type": record.type.value,
        "title": title,
        "summary": summary,
        "authority": record.authority.value,
        "truth_domain": record.truth_domain.value,
        "state": state,
        "created_at": record.created_at,
        "provenance": _short_provenance(record),
        "reasons": list(reasons or []),
    }


def context(query, *, root=None, project_id=None, max_records=8,
            character_budget=12000, include_vectors=True, include_inferred=False,
            embedder=None):
    """Retrieve bounded project context and report uncertainty explicitly."""
    store = CanonicalStore(root)
    manifest = store.require_manifest()
    project_id = project_id or manifest["project_id"]
    all_records = [record for record in store.load_all()
                   if record.project_id == project_id]
    memories = [record for record in all_records if isinstance(record, MemoryRecord)]
    relations = explicit_relations(all_records)
    states = resolve_states(memories, relations)
    found = retrieve(query, root=root, project_id=project_id, limit=max_records,
                     include_vectors=include_vectors, embedder=embedder)
    warnings = list(found["warnings"])
    candidate_ids = [record.id for record in found["records"]]
    if found["ambiguous"]:
        status = QueryStatus.AMBIGUOUS.value
    elif any(states.get(record_id) == CONFLICTING for record_id in candidate_ids):
        status = QueryStatus.CONFLICT.value
    elif not candidate_ids:
        status = QueryStatus.NO_MATCH.value
    elif warnings:
        status = QueryStatus.DEGRADED.value
    else:
        status = QueryStatus.OK.value

    by_id = {record.id: record for record in memories}
    # One-hop expansion uses only canonical explicit relations. It adds
    # evidence records; it never turns them into search hits or causal claims.
    expanded_ids = set(candidate_ids)
    evidence_edges = []
    for edge in relations:
        if edge.source_record_id in candidate_ids or edge.target_record_id in candidate_ids:
            evidence_edges.append(edge)
            expanded_ids.add(edge.source_record_id)
            expanded_ids.add(edge.target_record_id)

    candidates = [by_id[item_id] for item_id in candidate_ids if item_id in by_id]
    if found["mode"] == "CURRENT":
        candidates.sort(key=lambda record: (
            states.get(record.id) != CURRENT,
            -found["signals"].get(record.id, {}).get("rrf_score", 0), record.id,
        ))
    elif found["mode"] == "HISTORICAL":
        candidates.sort(key=lambda record: (
            -found["signals"].get(record.id, {}).get("rrf_score", 0), record.id,
        ))

    # A conflict is useful only if callers can inspect both sides. Retrieval
    # may rank one member of a same-subject group and omit its counterpart, so
    # expand conflicting candidates from canonical project records before
    # applying the output budget. Never pull a peer from another project.
    conflict_group_ids = set()
    for record in candidates:
        if states.get(record.id) != CONFLICTING:
            continue
        subject_key = record.content.get("subject_key")
        if not isinstance(subject_key, str) or not subject_key.strip():
            continue
        conflict_group_ids.update(
            peer.id for peer in memories
            if peer.project_id == record.project_id
            and states.get(peer.id) == CONFLICTING
            and peer.content.get("subject_key") == subject_key
        )

    candidate_by_id = {record.id: record for record in candidates}
    candidate_by_id.update({record_id: by_id[record_id]
                            for record_id in conflict_group_ids if record_id in by_id})
    # Conflict evidence is prioritized over ordinary hits so that a tight
    # context budget does not silently retain only unrelated search results.
    conflict_order = [record.id for record in candidates
                      if record.id in conflict_group_ids]
    conflict_order.extend(sorted(conflict_group_ids - set(conflict_order)))
    other_order = [record.id for record in candidates
                   if record.id not in conflict_group_ids]
    candidates = [candidate_by_id[item_id]
                  for item_id in conflict_order + other_order]
    retrieved_candidate_ids = set(candidate_ids)

    budget_left = max(0, int(character_budget))
    current, historical, conflicts, evidence, included = [], [], [], [], set()
    truncated_conflict_ids = set()

    def add(target, record, reasons=None):
        nonlocal budget_left
        item = _serialize(record, states.get(record.id, UNKNOWN),
                          reasons if reasons is not None else
                          found["signals"].get(record.id, {}).get("reasons", []))
        cost = len(json.dumps(item, ensure_ascii=False, separators=(",", ":")))
        if cost > budget_left:
            return False
        target.append(item)
        included.add(record.id)
        budget_left -= cost
        return True

    for record in candidates:
        state = states.get(record.id, UNKNOWN)
        target = conflicts if state == CONFLICTING else (
            historical if state in (SUPERSEDED, REVERTED, HISTORICAL) else
            current if state == CURRENT else evidence)
        reasons = None
        if record.id in conflict_group_ids and record.id not in retrieved_candidate_ids:
            reasons = [f"conflict_group_member:{record.content['subject_key']}"]
        if not add(target, record, reasons=reasons) and record.id in conflict_group_ids:
            truncated_conflict_ids.add(record.id)
    for record_id in sorted(expanded_ids - included):
        record = by_id.get(record_id)
        if record is not None and evidence_edges:
            reasons = [
                f"explicit_relation:{edge.relation.value}:{edge.id}"
                for edge in evidence_edges
                if record_id in (edge.source_record_id, edge.target_record_id)
            ]
            add(evidence, record, reasons=reasons)

    explicit_payloads = [relation_payload(edge) for edge in evidence_edges]
    possibly_related = []
    if include_inferred and candidates:
        local_records = {record.id: record for record in memories}
        vector_order = found["vector_ids"]
        for record in candidates:
            possibly_related.extend(inferred_relations(
                record.id, local_records, vector_neighbors=vector_order))
        deduped = {}
        for item in possibly_related:
            deduped[(item["record_id"], item["relation"])] = item
        possibly_related = list(deduped.values())

    if conflicts and status in (QueryStatus.OK.value, QueryStatus.DEGRADED.value):
        status = QueryStatus.CONFLICT.value
    if truncated_conflict_ids:
        warnings.append("CONFLICT_CONTEXT_TRUNCATED")
    return {
        "status": status,
        "project_id": project_id,
        "query": query,
        "mode": found["mode"],
        "current": current,
        "historical": historical,
        "evidence": evidence,
        "explicit_relations": explicit_payloads,
        "possibly_related": possibly_related,
        # Keep the existing ID list stable and expose compact serialized
        # records separately so clients can inspect the competing decisions.
        "conflicts": sorted(conflict_group_ids),
        "conflict_records": conflicts,
        "warnings": warnings,
        "trace_id": uuid.uuid4().hex,
    }


def lineage(record_id, *, root=None, project_id=None, max_hops=2):
    """Return up to two hops of canonical explicit lineage."""
    store = CanonicalStore(root)
    manifest = store.require_manifest()
    project_id = project_id or manifest["project_id"]
    records = [record for record in store.load_all() if record.project_id == project_id]
    by_id = {record.id: record for record in records if isinstance(record, MemoryRecord)}
    if record_id not in by_id:
        return {"status": QueryStatus.NO_MATCH.value, "record_id": record_id,
                "nodes": [], "relations": [], "warnings": []}
    edges = explicit_relations(records)
    visited = {record_id}
    frontier = {record_id}
    selected_edges = []
    for _ in range(max(0, min(int(max_hops), 2))):
        next_frontier = set()
        for edge in edges:
            if edge.source_record_id in frontier or edge.target_record_id in frontier:
                selected_edges.append(edge)
                next_frontier.add(edge.source_record_id)
                next_frontier.add(edge.target_record_id)
        frontier = next_frontier - visited
        visited.update(next_frontier)
        if not frontier:
            break
    states = resolve_states(records, edges)
    return {
        "status": QueryStatus.OK.value,
        "record_id": record_id,
        "nodes": [_serialize(by_id[item_id], states.get(item_id, UNKNOWN))
                  for item_id in sorted(visited) if item_id in by_id],
        "relations": [relation_payload(edge) for edge in sorted(
            {edge.id: edge for edge in selected_edges}.values(),
            key=lambda edge: (edge.created_at, edge.id))],
        "warnings": [],
    }
