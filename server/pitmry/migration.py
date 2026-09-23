"""Read-only legacy Cavemem migration into canonical PITMRY records."""

from __future__ import annotations

import datetime as dt
import json
import sqlite3
import subprocess
from pathlib import Path

from .canonical_store import CanonicalStore
from .capture import _record
from .enums import Authority, RecordType, TruthDomain

PROJECT_LABELS = ("pitmry", "memory-dashboard")
TABLES = ("adrs", "grill_me_logs", "git_semantic_digests")


def _connect_readonly(path):
    path = Path(path).resolve()
    uri = path.as_uri() + "?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def _timestamp(value):
    if isinstance(value, (int, float)):
        epoch = value / 1000 if abs(value) > 100_000_000_000 else value
        try:
            return dt.datetime.fromtimestamp(epoch, dt.timezone.utc).isoformat()
        except (OverflowError, OSError, ValueError):
            return "1970-01-01T00:00:00+00:00"
    if isinstance(value, str):
        try:
            parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=dt.timezone.utc)
            return parsed.isoformat()
        except ValueError:
            pass
    return "1970-01-01T00:00:00+00:00"


def _rows(conn, table):
    names = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if table not in names:
        return []
    columns = {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}
    if "project" not in columns:
        return []
    placeholders = ",".join("?" for _ in PROJECT_LABELS)
    return conn.execute(f"SELECT * FROM {table} WHERE project IN ({placeholders}) ORDER BY id",
                        PROJECT_LABELS).fetchall()


def _resolve_commit(root, reference):
    if not root or not reference:
        return ""
    result = subprocess.run(["git", "-C", str(root), "rev-parse", "--verify",
                             f"{reference}^{{commit}}"], capture_output=True, text=True)
    if result.returncode:
        return ""
    sha = result.stdout.strip()
    check = subprocess.run(["git", "-C", str(root), "cat-file", "-e", f"{sha}^{{commit}}"],
                           capture_output=True, text=True)
    return sha if check.returncode == 0 else ""


def _convert(store, table, row, root=None, source_id_override=None):
    data = dict(row)
    legacy_id = str(data.get("id", ""))
    project = str(data.get("project", ""))
    source_id = f"{table}:{project}:{legacy_id}"
    created_at = _timestamp(data.get("timestamp"))
    authority = Authority.imported_unverified
    metadata = {"legacy_table": table, "legacy_id": legacy_id, "legacy_project": project}
    tags = []
    if table == "adrs":
        title = str(data.get("title") or f"Imported ADR {legacy_id}")
        context = str(data.get("context") or "")
        decision = str(data.get("decision") or "")
        rationale = str(data.get("rationale") or "")
        trade_offs = str(data.get("trade_offs") or "")
        tags = [part.strip() for part in str(data.get("tags") or "").split(",") if part.strip()]
        content = {"context": context, "decision": decision, "rationale": rationale,
                   "trade_offs": trade_offs, "legacy_status": data.get("status", "")}
        record_type, summary, domain = RecordType.decision, decision or context or title, TruthDomain.intent
    elif table == "grill_me_logs":
        title = str(data.get("topic") or f"Imported discussion {legacy_id}")
        answers = str(data.get("answers") or "")
        takeaways = str(data.get("key_takeaways") or "")
        resolved = str(data.get("resolved_direction") or "")
        content = {"topic": title, "questions": str(data.get("questions") or ""),
                   "answers": answers, "takeaways": takeaways, "resolved_direction": resolved}
        record_type, summary, domain = RecordType.discussion, takeaways or resolved or answers or title, TruthDomain.intent
    else:
        reference = str(data.get("commit_hash") or "")
        resolved_sha = _resolve_commit(root, reference)
        if resolved_sha:
            authority = Authority.git_verified
            metadata["resolved_commit_sha"] = resolved_sha
        title = str(data.get("summary") or f"Imported Git digest {legacy_id}")
        raw_files = str(data.get("files_changed") or "")
        files = [item.strip() for item in raw_files.split(",") if item.strip()]
        content = {"commit_sha": resolved_sha or reference, "branch": str(data.get("branch") or ""),
                   "semantic_summary": str(data.get("summary") or ""),
                   "rationale": str(data.get("rationale") or ""), "changed_files": files,
                   "legacy_commit_reference": reference}
        source_id = f"git_semantic_digests:{resolved_sha or reference}:{project}"
        if source_id_override:
            source_id = source_id_override
        record_type, summary, domain = RecordType.git_change, title, TruthDomain.history
        tags = []
    record = _record(store, record_type, "legacy_cavemem", source_id, title, summary,
                     content, authority, domain, created_at=created_at, tags=tags,
                     related_files=content.get("changed_files", ()), metadata=metadata,
                     source_commit=metadata.get("resolved_commit_sha"))
    return record


def migrate_legacy(db_path, root=None, dry_run=False):
    conn = _connect_readonly(db_path)
    try:
        selected = [(table, row) for table in TABLES for row in _rows(conn, table)]
    finally:
        conn.close()
    counts = {table: sum(1 for candidate, _ in selected if candidate == table) for table in TABLES}
    resolved_git = sum(1 for table, row in selected
                       if table == "git_semantic_digests"
                       and _resolve_commit(root, str(dict(row).get("commit_hash") or "")))
    unresolved_git = counts["git_semantic_digests"] - resolved_git
    seen_git = set()
    duplicate_git_rows = 0
    source_ids = {}
    for table, row in selected:
        if table != "git_semantic_digests":
            continue
        data = dict(row)
        reference = str(data.get("commit_hash") or "")
        resolved = _resolve_commit(root, reference)
        key = (str(data.get("project") or ""), resolved or reference)
        if key in seen_git:
            duplicate_git_rows += 1
            source_ids[id(row)] = f"git_semantic_digests:{resolved or reference}:{key[0]}:legacy:{data.get('id')}"
        seen_git.add(key)
    if dry_run:
        return {"dry_run": True, "selected_projects": list(PROJECT_LABELS),
                "counts": counts, "total": len(selected),
                "git_verified": resolved_git, "git_unverified": unresolved_git,
                "duplicate_git_rows_preserved": duplicate_git_rows}
    store = CanonicalStore(root)
    store.require_manifest()
    imported = []
    for table, row in selected:
        imported.append(_convert(store, table, row, root=store.paths.root,
                                 source_id_override=source_ids.get(id(row))))
    return {"dry_run": False, "selected_projects": list(PROJECT_LABELS),
            "counts": counts, "total": len(imported), "git_verified": resolved_git,
            "git_unverified": unresolved_git,
            "duplicate_git_rows_preserved": duplicate_git_rows,
            "ids": [record.id for record in imported]}
