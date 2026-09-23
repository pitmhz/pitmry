"""Canonical-store data adapter for the existing human dashboard."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from .canonical_store import CanonicalStore
from .context_service import lineage
from .models import MemoryRecord, RelationRecord
from .relations import explicit_relations, inferred_relations, relation_view
from .state_resolver import resolve_states


LEGACY_TYPE = {"decision": "adr", "git_change": "commit", "discussion": "grill",
               "checkpoint": "checkpoint", "session_summary": "summary",
               "note": "memory"}
TYPE_FILTER = {"adr": "decision", "commit": "git_change", "grill": "discussion",
               "checkpoint": "checkpoint", "summary": "session_summary", "memory": "note"}


def project_roots(root=None):
    current = Path(root or os.environ.get("PITMRY_ROOT") or Path.cwd()).resolve()
    config_file = current / "pitmry.config.json"
    configured = {}
    if config_file.is_file():
        try:
            configured = json.loads(config_file.read_text(encoding="utf-8")).get("tracked_repos", {})
        except (OSError, ValueError, AttributeError):
            configured = {}
    entries = configured.items() if isinstance(configured, dict) else (
        (Path(value).name, value) for value in configured if isinstance(configured, list))
    roots = {current}
    for _, value in entries:
        if not isinstance(value, str) or not value.strip():
            continue
        candidate = Path(value)
        candidate = candidate if candidate.is_absolute() else current / candidate
        roots.add(candidate.resolve())
    stores, seen = [], set()
    for candidate in sorted(roots, key=str):
        if not (candidate / ".pitmry" / "manifest.json").is_file():
            continue
        store = CanonicalStore(candidate)
        project_id = store.require_manifest()["project_id"]
        if project_id not in seen:
            stores.append(store)
            seen.add(project_id)
    return stores


def all_records(root=None):
    result = []
    for store in project_roots(root):
        result.extend((store, record) for record in store.load_all())
    return result


def _view(store, record, states=None):
    content = getattr(record, "content", {})
    rec_type = getattr(getattr(record, "type", None), "value", "relation")
    legacy_type = LEGACY_TYPE.get(rec_type, "other")
    return {
        "id": record.id, "type": legacy_type, "canonical_type": rec_type,
        "project": store.require_manifest()["name"], "project_id": record.project_id,
        "title": getattr(record, "title", rec_type), "summary": getattr(record, "summary", ""),
        "rationale": content.get("rationale", ""), "trade_offs": content.get("trade_offs", ""),
        "decision": content.get("decision", ""), "body": content.get("message", ""),
        "timestamp": getattr(record, "created_at", ""), "tags": list(getattr(record, "tags", ())),
        "related_files": list(getattr(record, "related_files", ())),
        "commit_hash": content.get("commit_sha") or getattr(record.provenance, "source_commit", None),
        "branch": content.get("branch"), "author": content.get("author"),
        "authority": getattr(getattr(record, "authority", None), "value", ""),
        "truth_domain": getattr(getattr(record, "truth_domain", None), "value", ""),
        "state": states.get(record.id, "UNKNOWN") if states else "UNKNOWN",
        "provenance": {"source_type": record.provenance.source_type,
                       "source_id": record.provenance.source_id,
                       "evidence_refs": list(record.provenance.evidence_refs)},
        "numeric_id": None,
    }


def summary(root=None):
    pairs = all_records(root)
    counts = {"decision": 0, "git_change": 0, "discussion": 0}
    tags = {}
    projects = set()
    vector_count = 0
    for store, record in pairs:
        projects.add(store.require_manifest()["name"])
        if isinstance(record, MemoryRecord):
            if record.type.value in counts:
                counts[record.type.value] += 1
            for tag in record.tags:
                tags[tag] = tags.get(tag, 0) + 1
    for store in project_roots(root):
        if store.paths.lancedb_cache.exists():
            try:
                import lancedb
                db = lancedb.connect(str(store.paths.lancedb_cache))
                if "records" in db.table_names():
                    vector_count += db.open_table("records").count_rows()
            except Exception:
                pass
    total = len(pairs)
    return {"stats": {"total_adrs": counts["decision"], "total_commits": counts["git_change"],
                       "total_grill": counts["discussion"], "total_records": total,
                       "total_vectors": vector_count}, "projects": sorted(projects),
            "tags": [{"tag": key, "count": value} for key, value in
                     sorted(tags.items(), key=lambda pair: (-pair[1], pair[0]))[:20]]}


def feed(project=None, record_type=None, tag=None, query=None, limit=50, root=None):
    pairs = all_records(root)
    selected = []
    project_ids = set()
    for store, record in pairs:
        if not isinstance(record, MemoryRecord):
            continue
        if project and project not in (store.require_manifest()["name"], record.project_id):
            continue
        if record_type and record.type.value != TYPE_FILTER.get(record_type, record_type):
            continue
        if tag and tag not in record.tags:
            continue
        project_ids.add(record.project_id)
        selected.append((store, record))
    states = {}
    for store in project_roots(root):
        records = store.load_all()
        states.update(resolve_states([item for item in records if isinstance(item, MemoryRecord)],
                                     explicit_relations(records)))
    if query:
        from .retrieval import retrieve
        ranked = {}
        for project_id in project_ids:
            store = next(store for store, record in selected if record.project_id == project_id)
            result = retrieve(query, root=store.paths.root, project_id=project_id, limit=limit)
            for record in result["records"]:
                ranked[record.id] = result["signals"].get(record.id, {})
        selected = [(store, record) for store, record in selected if record.id in ranked]
        selected.sort(key=lambda pair: -ranked[pair[1].id].get("rrf_score", 0))
    else:
        selected.sort(key=lambda pair: pair[1].created_at, reverse=True)
    output = []
    for store, record in selected[:max(0, min(int(limit), 500))]:
        item = _view(store, record, states)
        item["score"] = ranked.get(record.id, {}).get("rrf_score", 0) if query else None
        item["source"] = "hybrid" if query else "canonical"
        output.append(item)
    return output


def _find_record(record_id, root=None):
    for store in project_roots(root):
        record = store.get(record_id)
        if isinstance(record, MemoryRecord):
            return store, record
    return None, None


def relations(record_id, root=None):
    store, focal = _find_record(record_id, root)
    if not focal:
        return {"explicit": [], "inferred": [], "neighbors": [], "error": "Record not found."}
    records = store.load_all()
    view = relation_view(records, record_id, memory_records={
        item.id: item for item in records if isinstance(item, MemoryRecord)})
    by_id = {item.id: item for item in records if isinstance(item, MemoryRecord)}
    neighbors = []
    for edge in view["explicit"]:
        peer_id = edge["target_record_id"] if edge["source_record_id"] == record_id else edge["source_record_id"]
        if peer_id in by_id:
            neighbors.append({**_view(store, by_id[peer_id]), "relation": edge["relation"],
                              "provenance": "explicit", "similarity": None,
                              "snippet": by_id[peer_id].summary})
    for edge in view["inferred"]:
        peer = by_id.get(edge["record_id"])
        if peer:
            neighbors.append({**_view(store, peer), "relation": edge["relation"],
                              "provenance": "inferred", "similarity": None,
                              "snippet": peer.summary})
    return {**view, "neighbors": neighbors}


def graph(root=None, limit=500):
    pairs = [(store, record) for store, record in all_records(root)
             if isinstance(record, MemoryRecord)][:limit]
    nodes, edges = [], []
    by_project = {}
    for store, record in pairs:
        name = store.require_manifest()["name"]
        by_project.setdefault(record.project_id, name)
        view = _view(store, record)
        nodes.append({"id": record.id, "label": record.title, "full_title": record.title,
                      "type": view["type"], "canonical_type": record.type.value,
                      "project": name, "project_id": record.project_id, "authority": record.authority.value,
                      "state": "UNKNOWN", "size": 8, "color": ""})
    for project_id, name in by_project.items():
        nodes.append({"id": f"project:{project_id}", "label": name, "type": "project", "project": name, "size": 14})
        for node in nodes[:-1]:
            if node.get("project") == name and node.get("type") != "project":
                edges.append({"source": f"project:{project_id}", "target": node["id"],
                              "type": "contains", "provenance": "structural", "weight": 1})
    for store in project_roots(root):
        records = store.load_all()
        local_states = resolve_states([item for item in records if isinstance(item, MemoryRecord)],
                                      explicit_relations(records))
        for node in nodes:
            if node.get("project_id") == store.project_id:
                node["state"] = local_states.get(node["id"], "UNKNOWN")
        visible = {node["id"] for node in nodes if node.get("project_id") == store.project_id}
        for edge in explicit_relations(records):
            if edge.source_record_id in visible and edge.target_record_id in visible:
                edges.append({"source": edge.source_record_id, "target": edge.target_record_id,
                              "type": edge.relation.value, "provenance": "explicit",
                              "weight": 1, "evidence_refs": list(edge.evidence_refs)})
        memories = {item.id: item for item in records if isinstance(item, MemoryRecord)}
        visible_memories = {key: value for key, value in memories.items() if key in visible}
        for item in visible_memories.values():
            for edge in inferred_relations(item.id, visible_memories):
                if item.id < edge["record_id"]:
                    edges.append({"source": item.id, "target": edge["record_id"],
                                  "type": edge["relation"], "provenance": "inferred",
                                  "weight": 0.5, "metadata": edge["metadata"]})
    return {"nodes": nodes, "edges": edges, "warnings": [], "provenance": "canonical"}


def activity(root=None, limit=150):
    pairs = all_records(root)
    result = {"today": [], "yesterday": [], "earlier": [], "total": 0,
              "status": "OK", "provenance": "canonical"}
    now = datetime.now(timezone.utc).date()
    labels = {"human_direct": "Human", "human_evidenced": "Human evidence",
              "git_verified": "Git", "runtime_verified": "Runtime",
              "code_verified": "Code", "agent_observed": "Agent observation",
              "agent_reported": "Agent report", "agent_inferred": "Inference",
              "imported_unverified": "Imported"}
    for store, record in sorted(pairs, key=lambda pair: pair[1].created_at, reverse=True)[:limit]:
        if not isinstance(record, MemoryRecord):
            continue
        view = _view(store, record)
        try:
            created = datetime.fromisoformat(record.created_at.replace("Z", "+00:00")).date()
        except ValueError:
            created = now
        bucket = "today" if created == now else "yesterday" if (now - created).days == 1 else "earlier"
        legacy_type = view["type"] if view["type"] in ("adr", "commit", "grill") else "other"
        authority = labels.get(record.authority.value, "Unknown source")
        event = {"id": record.id, "raw_id": record.id, "type": legacy_type,
                 "who": authority, "initials": authority[:1], "what": "recorded",
                 "context": record.title, "project": view["project"], "Icon": "GitCommitIcon" if legacy_type == "commit" else "MessageCircleIcon" if legacy_type == "grill" else "CheckCircle2",
                 "tone": "emerald" if record.authority.value in ("human_direct", "human_evidenced") else "sky",
                 "time": record.created_at, "timestamp": record.created_at,
                 "meta": record.authority.value, "bullets": []}
        result[bucket].append(event)
        result["total"] += 1
    return result


def journey(record_id, max_hops=2, root=None):
    result = lineage(record_id, root=root, max_hops=max_hops)
    store, focal = _find_record(record_id, root)
    if not focal:
        return {"focal_id": record_id, "focal_node": None, "journey_chain": [],
                "upstream": [], "downstream": [], "relations": [],
                "stats": {"total_hops": 0, "upstream_count": 0, "downstream_count": 0},
                "status": result["status"]}
    by_id = {item.id: item for item in store.load_all() if isinstance(item, MemoryRecord)}
    nodes = []
    for item in result["nodes"]:
        record = by_id.get(item["id"])
        if record:
            nodes.append(_view(store, record, {record.id: item["state"]}))
    edge_by_id = {}
    for edge in result["relations"]:
        edge_by_id.setdefault(edge["source_record_id"], edge)
        edge_by_id.setdefault(edge["target_record_id"], edge)
    chain = []
    for index, node in enumerate(nodes):
        edge = edge_by_id.get(node["id"])
        if node["id"] == record_id:
            continue
        chain.append({"step": index + 1, "role": "related_record",
                      "relation": "selected" if not edge else edge["relation"],
                      "provenance": "explicit" if edge else "selected",
                      "node": node,
                      "badge": "Selected record" if not edge else "Explicit relation"})
    peers = [node for node in nodes if node["id"] != record_id]
    return {"focal_id": record_id, "focal_node": _view(store, focal),
            "journey_chain": chain, "upstream": [], "downstream": [],
            "related_records": peers, "relations": result["relations"],
            "stats": {"total_hops": max(0, len(peers)), "upstream_count": 0,
                      "downstream_count": 0, "related_count": len(peers)},
            "status": result["status"], "warnings": result["warnings"]}
