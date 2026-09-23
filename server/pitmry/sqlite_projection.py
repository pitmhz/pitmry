"""Rebuildable SQLite and FTS5 projection of canonical PITMRY records."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from .models import MemoryRecord, RelationRecord

PROJECTION_SCHEMA_VERSION = "1"


def _json(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def searchable_content(record):
    content = record.content
    fields = {
        "decision": ("context", "decision", "rationale", "trade_offs"),
        "git_change": ("semantic_summary", "rationale", "patch_id"),
        "discussion": ("topic", "takeaways", "answers", "resolved_direction"),
        "failure": ("symptom", "cause", "resolution"),
        "checkpoint": ("summary", "open_work"),
        "session_summary": ("summary", "open_work"),
    }.get(record.type.value, ("summary",))
    return " ".join(str(content.get(key, "")) for key in fields if content.get(key))


def _record_row(record):
    if isinstance(record, RelationRecord):
        return None
    return (record.id, record.project_id, record.type.value, record.title,
            record.summary, record.authority.value, record.truth_domain.value,
            record.created_at, _json(record.content),
            _json({"source_type": record.provenance.source_type,
                   "source_id": record.provenance.source_id,
                   "originator": record.provenance.originator,
                   "captured_by": record.provenance.captured_by,
                   "source_commit": record.provenance.source_commit,
                   "evidence_refs": record.provenance.evidence_refs}),
            _json(record.related_files), _json(record.related_symbols),
            _json(record.tags), record.content_hash)


def initialize(path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.execute("PRAGMA foreign_keys=ON")
    conn.executescript("""
        CREATE TABLE records (
            id TEXT PRIMARY KEY, project_id TEXT NOT NULL, record_type TEXT NOT NULL,
            title TEXT NOT NULL, summary TEXT NOT NULL, authority TEXT NOT NULL,
            truth_domain TEXT NOT NULL, created_at TEXT NOT NULL,
            content_json TEXT NOT NULL, provenance_json TEXT NOT NULL,
            related_files_json TEXT NOT NULL, related_symbols_json TEXT NOT NULL,
            tags_json TEXT NOT NULL, content_hash TEXT NOT NULL
        );
        CREATE TABLE relations (
            id TEXT PRIMARY KEY, project_id TEXT NOT NULL, relation TEXT NOT NULL,
            source_record_id TEXT NOT NULL, target_record_id TEXT NOT NULL,
            provenance TEXT NOT NULL, created_at TEXT NOT NULL,
            evidence_json TEXT NOT NULL, metadata_json TEXT NOT NULL,
            content_hash TEXT NOT NULL
        );
        CREATE TABLE projection_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE INDEX records_project_idx ON records(project_id);
        CREATE INDEX records_type_idx ON records(record_type);
        CREATE INDEX records_date_idx ON records(created_at);
        CREATE INDEX relations_project_idx ON relations(project_id);
        CREATE INDEX relations_source_idx ON relations(source_record_id);
        CREATE INDEX relations_target_idx ON relations(target_record_id);
        CREATE INDEX relations_type_idx ON relations(relation);
        CREATE VIRTUAL TABLE records_fts USING fts5(
            id UNINDEXED, title, summary, searchable_content, tags, related_files,
            tokenize='porter unicode61'
        );
    """)
    conn.commit()
    return conn


def project_record(conn, record):
    if isinstance(record, RelationRecord):
        row = (record.id, record.project_id, record.relation.value,
               record.source_record_id, record.target_record_id,
               record.provenance.value, record.created_at,
               _json(record.evidence_refs), _json(record.metadata), record.content_hash)
        old = conn.execute("SELECT content_hash FROM relations WHERE id=?", (record.id,)).fetchone()
        if old and old[0] == record.content_hash:
            return False
        conn.execute("INSERT OR REPLACE INTO relations VALUES (?,?,?,?,?,?,?,?,?,?)", row)
        return True
    row = _record_row(record)
    old = conn.execute("SELECT content_hash FROM records WHERE id=?", (record.id,)).fetchone()
    if old and old[0] == record.content_hash:
        return False
    conn.execute("INSERT OR REPLACE INTO records VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)", row)
    conn.execute("DELETE FROM records_fts WHERE id=?", (record.id,))
    conn.execute("INSERT INTO records_fts VALUES (?,?,?,?,?,?)",
                 (record.id, record.title, record.summary, searchable_content(record),
                  " ".join(record.tags), " ".join(record.related_files)))
    return True


def integrity_check(conn):
    result = conn.execute("PRAGMA integrity_check").fetchone()[0]
    if result != "ok":
        raise sqlite3.DatabaseError(f"SQLite integrity check failed: {result}")
    expected = conn.execute("SELECT count(*) FROM records").fetchone()[0]
    actual = conn.execute("SELECT count(*) FROM records_fts").fetchone()[0]
    if expected != actual:
        raise sqlite3.DatabaseError(f"FTS row count mismatch: {actual} != {expected}")
