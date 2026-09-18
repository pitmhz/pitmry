#!/usr/bin/env python3
"""
memory_navigator.py - Universal Developer Memory & Vector DB Retrieval Tool
Designed for AI agents (first-timers, lightweight models, and cross-model handoffs)
to search, inspect, and adaptively navigate offline developer memory.

Features:
  --status              : Introspect database paths, active tables, row counts, and health
  --schema              : Introspect dynamic schema definitions for LanceDB and SQLite
  search "<query>"      : Hybrid search (LanceDB 384d vector + SQLite FTS5) with query distillation
  inspect <id>          : Full deep dive of a specific record (e.g. adr-24, commit-16, grill-1)
  journey <id>          : Trace multi-hop decision journey (origin -> decision -> implementation)
  --project <name>      : Narrow search to a specific project (e.g. pitmry, portfolio, daschool)
  --type <type>         : Narrow search to adr, commit, or grill
  --limit <n>           : Max results to return (default 5)
  --json                : Emit machine-parseable JSON
"""

import os
import sys
import re
import json
import sqlite3
import argparse
from pathlib import Path
from typing import List, Dict, Any, Optional

# Paths (allows environment variable override)
DEFAULT_CAVEMEM_DB = os.getenv("CAVEMEM_DB_PATH", os.path.expanduser(r"~\.cavemem\data.db"))
DEFAULT_LANCE_DIR = os.getenv("LANCEDB_DIR", os.path.expanduser(r"~\.strategic_memory\lancedb"))
DEFAULT_GIT_FLOW_DIR = os.path.expanduser(r"~\.agents\skills\cavemem\memory\git-flow")
DEFAULT_SESSIONS_DIR = os.path.expanduser(r"~\docs\sessions")

# Re-use existing local embedder
SCRIPTS_DIR = Path(__file__).resolve().parent
SERVER_DIR = SCRIPTS_DIR.parent
for d in [str(SCRIPTS_DIR), str(SERVER_DIR)]:
    if d not in sys.path:
        sys.path.insert(0, d)

try:
    from cavemem_strategic import LocalEmbedder, sanitize_fts_query
except ImportError:
    # Fallback embedder if cavemem_strategic isn't directly on sys.path
    LocalEmbedder = None
    sanitize_fts_query = None


STOP_PHRASES = [
    r"can you remind me\b",
    r"can you tell me\b",
    r"can you check\b",
    r"can you find\b",
    r"tell me about\b",
    r"what did we do with\b",
    r"what happened with\b",
    r"why did we\b",
    r"why is\b",
    r"how did we\b",
    r"how come\b",
    r"do you know if\b",
    r"check our memory for\b",
    r"find out why\b",
    r"search for\b",
    r"look up\b",
    r"please\b",
    r"i want to know\b"
]


def distill_query(raw_query: str) -> str:
    """Strips conversational noise to maximize embedding vector sharpness."""
    q = raw_query.strip()
    for pattern in STOP_PHRASES:
        q = re.sub(pattern, " ", q, flags=re.IGNORECASE)
    # Collapse multiple spaces
    q = re.sub(r"\s+", " ", q).strip(" ?.,!")
    return q if q else raw_query.strip()


def get_sqlite_conn(db_path: str = DEFAULT_CAVEMEM_DB) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def get_lancedb(db_dir: str = DEFAULT_LANCE_DIR):
    import lancedb
    os.makedirs(db_dir, exist_ok=True)
    return lancedb.connect(db_dir)


def get_lance_table_names(db) -> List[str]:
    res = db.list_tables()
    if hasattr(res, "tables"):
        return res.tables
    return list(res)


# ==============================================================================
# 1. Introspection: Status & Schema
# ==============================================================================

def cmd_status(as_json: bool = False) -> Dict[str, Any]:
    """Inspects database health, table counts, file sizes, and embedder status."""
    sqlite_ok = os.path.exists(DEFAULT_CAVEMEM_DB)
    sqlite_size_kb = round(os.path.getsize(DEFAULT_CAVEMEM_DB) / 1024, 1) if sqlite_ok else 0
    sqlite_tables = {}
    integrity_status = "unknown"

    if sqlite_ok:
        try:
            conn = get_sqlite_conn()
            cur = conn.cursor()
            cur.execute("PRAGMA integrity_check;")
            integrity_status = cur.fetchone()[0]
            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
            tables = [r[0] for r in cur.fetchall()]
            for t in tables:
                cur.execute(f"SELECT COUNT(*) FROM \"{t}\";")
                sqlite_tables[t] = cur.fetchone()[0]
            conn.close()
        except Exception as e:
            integrity_status = f"error: {e}"

    lance_ok = os.path.exists(DEFAULT_LANCE_DIR)
    lance_tables = {}
    total_vectors = 0
    if lance_ok:
        try:
            ldb = get_lancedb()
            for t in get_lance_table_names(ldb):
                tbl = ldb.open_table(t)
                cnt = len(tbl)
                lance_tables[t] = cnt
                total_vectors += cnt
        except Exception as e:
            lance_tables["error"] = str(e)

    embedder_ok = False
    embedder_model = "all-MiniLM-L6-v2 (384 dims)"
    try:
        if LocalEmbedder:
            emb = LocalEmbedder()
            embedder_ok = os.path.exists(emb.model_path)
    except Exception:
        embedder_ok = False

    data = {
        "status": "operational" if (sqlite_ok and lance_ok and integrity_status == "ok") else "degraded",
        "embedder": {
            "model": embedder_model,
            "operational": embedder_ok,
            "dimensions": 384
        },
        "databases": {
            "sqlite": {
                "path": DEFAULT_CAVEMEM_DB,
                "exists": sqlite_ok,
                "size_kb": sqlite_size_kb,
                "integrity": integrity_status,
                "tables": sqlite_tables
            },
            "lancedb": {
                "path": DEFAULT_LANCE_DIR,
                "exists": lance_ok,
                "total_vectors": total_vectors,
                "tables": lance_tables
            }
        },
        "storage_dirs": {
            "git_flow_logs": DEFAULT_GIT_FLOW_DIR,
            "session_docs": DEFAULT_SESSIONS_DIR
        }
    }

    if as_json:
        return data

    print("================================================================================")
    print("                    OFFLINE DEVELOPER MEMORY TOPOLOGY                           ")
    print("================================================================================")
    print(f"Overall Status   : {data['status'].upper()}")
    print(f"Local Embedder   : {embedder_model} (Available: {embedder_ok})")
    print(f"LanceDB Path     : {DEFAULT_LANCE_DIR}")
    print(f"LanceDB Vectors  : {total_vectors} vectors across {len(lance_tables)} table(s)")
    for t, cnt in lance_tables.items():
        print(f"  • {t:<20} : {cnt} rows")
    print(f"SQLite Path      : {DEFAULT_CAVEMEM_DB} ({sqlite_size_kb} KB, integrity: {integrity_status})")
    for t, cnt in sqlite_tables.items():
        if not t.endswith("_fts") and not t.endswith("_data") and not t.endswith("_idx"):
            print(f"  • {t:<20} : {cnt} rows")
    print("================================================================================")
    return data


def cmd_schema(as_json: bool = False) -> Dict[str, Any]:
    """Discovers table definitions and column types dynamically from disk."""
    schema_info: Dict[str, Any] = {"sqlite": {}, "lancedb": {}}

    # 1. SQLite schema
    if os.path.exists(DEFAULT_CAVEMEM_DB):
        conn = get_sqlite_conn()
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%_fts%' AND name NOT LIKE '%_data%';")
        tables = [r[0] for r in cur.fetchall()]
        for t in tables:
            cur.execute(f"PRAGMA table_info(\"{t}\");")
            cols = [{"cid": r[0], "name": r[1], "type": r[2], "notnull": bool(r[3]), "dflt_value": r[4], "pk": bool(r[5])} for r in cur.fetchall()]
            schema_info["sqlite"][t] = cols
        conn.close()

    # 2. LanceDB schema
    if os.path.exists(DEFAULT_LANCE_DIR):
        ldb = get_lancedb()
        for t in get_lance_table_names(ldb):
            tbl = ldb.open_table(t)
            arrow_schema = tbl.schema
            schema_info["lancedb"][t] = [
                {"name": f.name, "type": str(f.type), "nullable": f.nullable}
                for f in arrow_schema
            ]

    if as_json:
        return schema_info

    print("================================================================================")
    print("                    DYNAMIC MEMORY SCHEMA INTROSPECTION                         ")
    print("================================================================================")
    print("\n--- SQLite Relational Tables (ACID & Exact Metadata) ---")
    for tbl, cols in schema_info["sqlite"].items():
        col_summary = ", ".join(f"{c['name']} ({c['type']})" for c in cols[:6])
        if len(cols) > 6:
            col_summary += f", ... (+{len(cols)-6} more)"
        print(f"• Table `{tbl}`: {col_summary}")

    print("\n--- LanceDB Vector Tables (384-dim Dense Columnar Storage) ---")
    for tbl, cols in schema_info["lancedb"].items():
        col_summary = ", ".join(c['name'] for c in cols if c['name'] != 'vector')
        print(f"• Vector Table `{tbl}`: fields: [{col_summary}] + vector (384d)")
    print("================================================================================")
    return schema_info


# ==============================================================================
# 2. Search Engine (Hybrid LanceDB + SQLite FTS5)
# ==============================================================================

def cmd_search(
    query: str,
    project: Optional[str] = None,
    record_type: Optional[str] = None,
    limit: int = 5,
    as_json: bool = False
) -> List[Dict[str, Any]]:
    """Performs hybrid semantic and keyword search with progressive ranking."""
    cleaned_query = distill_query(query)
    
    embedder = LocalEmbedder() if LocalEmbedder else None
    query_vec = embedder.embed(cleaned_query) if embedder else None

    results: Dict[str, Dict[str, Any]] = {}

    # 1. LanceDB Vector Search (Semantic)
    if query_vec is not None and os.path.exists(DEFAULT_LANCE_DIR):
        try:
            ldb = get_lancedb()
            table_map = [
                ("adrs", "adr", "title", "decision", "rationale"),
                ("git_digests", "commit", "summary", "summary", "rationale"),
                ("grill_me_logs", "grill", "topic", "resolved_direction", "key_takeaways")
            ]
            for tbl_name, itype, title_col, primary_col, rationale_col in table_map:
                if record_type and record_type != itype:
                    continue
                if tbl_name in get_lance_table_names(ldb):
                    tbl = ldb.open_table(tbl_name)
                    if len(tbl) > 0:
                        q = tbl.search(query_vec).metric("cosine")
                        if project:
                            q = q.where(f"project = '{project}'")
                        hits = q.limit(limit * 2).to_list()
                        for h in hits:
                            dist = float(h.get("_distance", 1.0))
                            sim = max(0.01, min(1.0, 1.0 - (dist / 2.0)))
                            rec_id = f"{itype}-{h.get('id')}"
                            results[rec_id] = {
                                "id": rec_id,
                                "numeric_id": h.get("id"),
                                "type": itype,
                                "project": h.get("project", "workspace"),
                                "title": h.get(title_col, ""),
                                "primary_text": h.get(primary_col, ""),
                                "rationale": h.get(rationale_col, ""),
                                "tags": h.get("tags", "") or h.get("files_changed", ""),
                                "timestamp": h.get("timestamp", ""),
                                "score": round(sim, 4),
                                "source": "vector"
                            }
        except Exception:
            pass

    # 2. SQLite Keyword Search (FTS5 / LIKE fallback)
    if os.path.exists(DEFAULT_CAVEMEM_DB):
        try:
            conn = get_sqlite_conn()
            cur = conn.cursor()
            words = [w for w in cleaned_query.split() if len(w) > 2]

            # Search ADRs
            if not record_type or record_type == "adr":
                like_clauses = " AND ".join(["(title LIKE ? OR decision LIKE ? OR rationale LIKE ? OR tags LIKE ?)"] * len(words))
                if words and like_clauses:
                    params = []
                    for w in words:
                        params.extend([f"%{w}%", f"%{w}%", f"%{w}%", f"%{w}%"])
                    sql = f"SELECT id, project, title, decision, rationale, tags, timestamp FROM adrs WHERE {like_clauses}"
                    if project:
                        sql += f" AND project = '{project}'"
                    sql += f" LIMIT {limit}"
                    cur.execute(sql, params)
                    for r in cur.fetchall():
                        rec_id = f"adr-{r['id']}"
                        if rec_id in results:
                            results[rec_id]["score"] = min(1.0, results[rec_id]["score"] + 0.15)
                            results[rec_id]["source"] = "hybrid"
                        else:
                            results[rec_id] = {
                                "id": rec_id,
                                "numeric_id": r["id"],
                                "type": "adr",
                                "project": r["project"],
                                "title": r["title"],
                                "primary_text": r["decision"],
                                "rationale": r["rationale"],
                                "tags": r["tags"],
                                "timestamp": str(r["timestamp"]),
                                "score": 0.65,
                                "source": "keyword"
                            }

            # Search Git Digests
            if not record_type or record_type == "commit":
                like_clauses = " AND ".join(["(summary LIKE ? OR rationale LIKE ? OR files_changed LIKE ?)"] * len(words))
                if words and like_clauses:
                    params = []
                    for w in words:
                        params.extend([f"%{w}%", f"%{w}%", f"%{w}%"])
                    sql = f"SELECT id, project, commit_hash, summary, rationale, files_changed, timestamp FROM git_semantic_digests WHERE {like_clauses}"
                    if project:
                        sql += f" AND project = '{project}'"
                    sql += f" LIMIT {limit}"
                    cur.execute(sql, params)
                    for r in cur.fetchall():
                        rec_id = f"commit-{r['id']}"
                        if rec_id in results:
                            results[rec_id]["score"] = min(1.0, results[rec_id]["score"] + 0.15)
                            results[rec_id]["source"] = "hybrid"
                        else:
                            results[rec_id] = {
                                "id": rec_id,
                                "numeric_id": r["id"],
                                "type": "commit",
                                "project": r["project"],
                                "title": r["summary"],
                                "primary_text": r["summary"],
                                "rationale": r["rationale"],
                                "tags": r["files_changed"],
                                "timestamp": str(r["timestamp"]),
                                "score": 0.65,
                                "source": "keyword"
                            }

            # Search automatically captured summaries, compaction checkpoints,
            # and promoted durable memories. These are the bridge between the
            # hook ledger and the strategic ADR/commit index.
            if words and (not record_type or record_type in ("observation", "summary", "checkpoint", "memory")):
                match_any = " OR ".join(["content LIKE ?"] * len(words))
                word_params = [f"%{w}%" for w in words]
                if not record_type or record_type == "observation":
                    sql = f"SELECT o.id,o.session_id,o.kind,o.content,o.ts,COALESCE(s.project_key,s.cwd,'global') project_key FROM observations o JOIN sessions s ON s.id=o.session_id WHERE ({match_any})"
                    params = list(word_params)
                    if project:
                        sql += " AND COALESCE(s.project_key,s.cwd,'') LIKE ?"
                        params.append(f"%{project}%")
                    sql += " ORDER BY o.ts DESC LIMIT ?"
                    params.append(limit)
                    for r in cur.execute(sql, params).fetchall():
                        rid = f"observation-{r['id']}"
                        results[rid] = {"id": rid, "numeric_id": r["id"], "type": "observation", "project": r["project_key"], "title": f"{r['kind'].replace('_',' ').title()} observation", "primary_text": r["content"], "rationale": "Automatically captured agent event", "tags": r["session_id"], "timestamp": str(r["ts"]), "score": 0.62, "source": "keyword"}
                if not record_type or record_type == "summary":
                    sql = f"SELECT x.id, x.session_id, x.scope, x.content, x.ts, COALESCE(s.project_key,s.cwd,'global') project_key FROM summaries x JOIN sessions s ON s.id=x.session_id WHERE ({match_any})"
                    params = list(word_params)
                    if project:
                        sql += " AND COALESCE(s.project_key,s.cwd,'') LIKE ?"
                        params.append(f"%{project}%")
                    sql += " ORDER BY x.ts DESC LIMIT ?"
                    params.append(limit)
                    for r in cur.execute(sql, params).fetchall():
                        rid = f"summary-{r['id']}"
                        results[rid] = {"id": rid, "numeric_id": r["id"], "type": "summary", "project": r["project_key"], "title": f"{r['scope'].title()} summary", "primary_text": r["content"], "rationale": "Automatically captured session summary", "tags": r["session_id"], "timestamp": str(r["ts"]), "score": 0.72, "source": "keyword"}
                if table_exists(conn, "checkpoints") and (not record_type or record_type == "checkpoint"):
                    sql = f"SELECT id,session_id,project_key,trigger,content,ts FROM checkpoints WHERE ({match_any})"
                    params = list(word_params)
                    if project:
                        sql += " AND project_key LIKE ?"
                        params.append(f"%{project}%")
                    sql += " ORDER BY ts DESC LIMIT ?"
                    params.append(limit)
                    for r in cur.execute(sql, params).fetchall():
                        rid = f"checkpoint-{r['id']}"
                        results[rid] = {"id": rid, "numeric_id": r["id"], "type": "checkpoint", "project": r["project_key"], "title": f"Compaction checkpoint ({r['trigger']})", "primary_text": r["content"], "rationale": "Deterministic context recovery capsule", "tags": r["session_id"], "timestamp": str(r["ts"]), "score": 0.82, "source": "keyword"}
                if table_exists(conn, "memory_items") and (not record_type or record_type == "memory"):
                    sql = f"SELECT id,project_key,kind,title,content,updated_at FROM memory_items WHERE ({match_any})"
                    params = list(word_params)
                    if project:
                        sql += " AND project_key LIKE ?"
                        params.append(f"%{project}%")
                    sql += " ORDER BY updated_at DESC LIMIT ?"
                    params.append(limit)
                    for r in cur.execute(sql, params).fetchall():
                        rid = f"memory-{r['id']}"
                        results[rid] = {"id": rid, "numeric_id": r["id"], "type": "memory", "project": r["project_key"], "title": r["title"], "primary_text": r["content"], "rationale": f"Promoted {r['kind']}", "tags": r["kind"], "timestamp": str(r["updated_at"]), "score": 0.85, "source": "keyword"}

            conn.close()
        except Exception:
            pass

    # Sort descending by score
    sorted_items = sorted(results.values(), key=lambda x: x["score"], reverse=True)[:limit]

    if as_json:
        return sorted_items

    print("================================================================================")
    print(f" SEARCH RESULTS for: '{query}'")
    if cleaned_query != query:
        print(f" Distilled Query    : '{cleaned_query}'")
    print(f" Matches Found      : {len(sorted_items)}")
    print("================================================================================")

    if not sorted_items:
        print("No matching records found. Try broader technical keywords or check --status.")
        return []

    for item in sorted_items:
        badge = item["type"].upper()
        src_tag = f"[{item['source']}]"
        print(f"\n▶ [{item['id']}] ({badge}) {item['title']}")
        print(f"  Project: {item['project']} | Score: {item['score']:.3f} {src_tag}")
        if item.get("primary_text"):
            snippet = item['primary_text'].replace('\n', ' ')[:140]
            print(f"  Decision/Summary: {snippet}...")
        if item.get("rationale"):
            rat_snippet = item['rationale'].replace('\n', ' ')[:140]
            print(f"  Rationale       : {rat_snippet}...")
        if item.get("tags"):
            print(f"  Tags/Files      : {item['tags'][:80]}")

    print("\n--------------------------------------------------------------------------------")
    print("To view full content of any record: python memory_navigator.py inspect <id>")
    print("================================================================================")
    return sorted_items


def table_exists(conn: sqlite3.Connection, name: str) -> bool:
    return conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)).fetchone() is not None


# ==============================================================================
# 3. Deep Record Inspection & Journey
# ==============================================================================

def cmd_inspect(record_id: str, as_json: bool = False) -> Dict[str, Any]:
    """Retrieves the complete content of a single record without context flooding."""
    # Parse record_id: "adr-24", "commit-16", "grill-1"
    parts = record_id.lower().replace("#", "").split("-")
    if len(parts) == 2:
        itype, raw_id = parts[0], parts[1]
    elif len(parts) == 1 and parts[0].isdigit():
        itype, raw_id = "adr", parts[0]
    else:
        itype, raw_id = parts[0], parts[-1]

    try:
        numeric_id = int(raw_id)
    except ValueError:
        print(f"Error: Invalid record ID format: '{record_id}'. Expected format: adr-24, commit-16, grill-1.")
        return {}

    conn = get_sqlite_conn()
    cur = conn.cursor()
    record = {}

    if itype in ["adr", "decision"]:
        cur.execute("SELECT * FROM adrs WHERE id = ?", (numeric_id,))
        row = cur.fetchone()
        if row:
            record = dict(row)
            record["type"] = "adr"
    elif itype in ["commit", "git"]:
        cur.execute("SELECT * FROM git_semantic_digests WHERE id = ?", (numeric_id,))
        row = cur.fetchone()
        if row:
            record = dict(row)
            record["type"] = "commit"
    elif itype in ["grill", "interview"]:
        cur.execute("SELECT * FROM grill_me_logs WHERE id = ?", (numeric_id,))
        row = cur.fetchone()
        if row:
            record = dict(row)
            record["type"] = "grill"
    elif itype == "observation":
        cur.execute("SELECT o.*,COALESCE(s.project_key,s.cwd,'global') project FROM observations o JOIN sessions s ON s.id=o.session_id WHERE o.id=?", (numeric_id,))
        row = cur.fetchone()
        if row: record = {**dict(row), "type": "observation", "title": f"{row['kind']} observation", "primary_text": row['content']}
    elif itype == "summary":
        cur.execute("SELECT x.*,COALESCE(s.project_key,s.cwd,'global') project FROM summaries x JOIN sessions s ON s.id=x.session_id WHERE x.id=?", (numeric_id,))
        row = cur.fetchone()
        if row: record = {**dict(row), "type": "summary", "title": f"{row['scope']} summary", "primary_text": row['content']}
    elif itype == "checkpoint" and table_exists(conn, "checkpoints"):
        cur.execute("SELECT *,project_key project FROM checkpoints WHERE id=?", (numeric_id,))
        row = cur.fetchone()
        if row: record = {**dict(row), "type": "checkpoint", "title": f"{row['trigger']} checkpoint", "primary_text": row['content']}
    elif itype == "memory" and table_exists(conn, "memory_items"):
        cur.execute("SELECT *,project_key project FROM memory_items WHERE id=?", (numeric_id,))
        row = cur.fetchone()
        if row: record = {**dict(row), "type": "memory", "primary_text": row['content']}

    conn.close()

    if not record:
        print(f"Record '{record_id}' not found in database.")
        return {}

    if as_json:
        return record

    print("================================================================================")
    print(f" RECORD DETAIL: [{record_id.upper()}] - {record.get('title') or record.get('summary') or record.get('topic')}")
    print("================================================================================")
    print(f"Project       : {record.get('project')}")
    print(f"Record Type   : {record.get('type')}")
    print(f"Timestamp     : {record.get('timestamp')}")
    if record.get('status'):
        print(f"Status        : {record.get('status')}")
    if record.get('commit_hash'):
        print(f"Commit Hash   : {record.get('commit_hash')} (Branch: {record.get('branch')})")

    if record.get('context'):
        print("\n--- CONTEXT & PROBLEM ---")
        print(record['context'])

    if record.get('decision'):
        print("\n--- DECISION ---")
        print(record['decision'])

    if record.get('rationale'):
        print("\n--- ARCHITECTURAL RATIONALE ---")
        print(record['rationale'])

    if record.get('trade_offs'):
        print("\n--- TRADE-OFFS ---")
        print(record['trade_offs'])

    if record.get('files_changed'):
        print("\n--- CHANGED FILES ---")
        print(record['files_changed'])

    if record.get('questions') or record.get('answers'):
        print("\n--- QUESTIONS & ANSWERS ---")
        print(f"Questions: {record.get('questions')}")
        print(f"Answers  : {record.get('answers')}")

    if record.get('key_takeaways') or record.get('resolved_direction'):
        print("\n--- RESOLVED DIRECTION ---")
        print(f"Takeaways: {record.get('key_takeaways')}")
        print(f"Direction: {record.get('resolved_direction')}")

    if record.get('tags'):
        print(f"\nTags: {record.get('tags')}")
    if record.get('primary_text'):
        print("\n--- CONTENT ---")
        print(record['primary_text'])
    print("================================================================================")
    return record


def cmd_journey(record_id: str, hops: int = 3, as_json: bool = False) -> Dict[str, Any]:
    """Traces multi-hop causality for a record."""
    try:
        from memory_dashboard_api import cmd_journey as api_journey
        parts = record_id.lower().split("-")
        itype = parts[0] if len(parts) == 2 else "adr"
        iid = int(parts[1]) if len(parts) == 2 else int(parts[0])
        res = api_journey(itype, iid, max_hops=hops)
        if as_json:
            return res
        
        print("================================================================================")
        print(f" DECISION JOURNEY for: {record_id.upper()}")
        print("================================================================================")
        chain = res.get("journey_chain", [])
        for step in chain:
            print(f"Step {step['step']}: [{step['role'].upper()}] - {step['node']['title']}")
            print(f"  Relation: {step['relation']} | Similarity: {step.get('similarity', 1.0):.2f}")
        print("================================================================================")
        return res
    except Exception as e:
        print(f"Could not compute journey: {e}")
        return {}


# ==============================================================================
# CLI Entrypoint
# ==============================================================================

def main():
    parser = argparse.ArgumentParser(description="Universal Developer Memory Navigator")
    subparsers = parser.add_subparsers(dest="command")

    # Status
    p_status = subparsers.add_parser("status", help="Inspect database paths, health, and counts")
    p_status.add_argument("--json", action="store_true", help="Output JSON")

    # Schema
    p_schema = subparsers.add_parser("schema", help="Inspect dynamic database table schemas")
    p_schema.add_argument("--json", action="store_true", help="Output JSON")

    # Search
    p_search = subparsers.add_parser("search", help="Search memory using vector similarity + keyword")
    p_search.add_argument("query", help="Natural language query or keywords")
    p_search.add_argument("--project", "-p", default=None, help="Filter by project name")
    p_search.add_argument("--type", "-t", choices=["adr", "commit", "grill", "observation", "summary", "checkpoint", "memory"], default=None, help="Filter by type")
    p_search.add_argument("--limit", "-l", type=int, default=5, help="Max results (default 5)")
    p_search.add_argument("--json", action="store_true", help="Output JSON")

    # Inspect
    p_inspect = subparsers.add_parser("inspect", help="Inspect full record details (e.g. adr-24)")
    p_inspect.add_argument("id", help="Record ID (e.g. adr-24, commit-16, grill-1)")
    p_inspect.add_argument("--json", action="store_true", help="Output JSON")

    # Journey
    p_journey = subparsers.add_parser("journey", help="Trace multi-hop decision journey")
    p_journey.add_argument("id", help="Record ID (e.g. adr-24)")
    p_journey.add_argument("--hops", type=int, default=3, help="Max hops")
    p_journey.add_argument("--json", action="store_true", help="Output JSON")

    # Top-level fallback flags
    parser.add_argument("--status", action="store_true", help="Show database status")
    parser.add_argument("--schema", action="store_true", help="Show database schema")
    parser.add_argument("--json", action="store_true", help="Output JSON")

    args = parser.parse_args()

    if args.command == "status" or args.status:
        res = cmd_status(as_json=args.json)
        if args.json:
            print(json.dumps(res, indent=2))
    elif args.command == "schema" or args.schema:
        res = cmd_schema(as_json=args.json)
        if args.json:
            print(json.dumps(res, indent=2))
    elif args.command == "search":
        res = cmd_search(
            query=args.query,
            project=args.project,
            record_type=args.type,
            limit=args.limit,
            as_json=args.json
        )
        if args.json:
            print(json.dumps(res, indent=2))
    elif args.command == "inspect":
        res = cmd_inspect(args.id, as_json=args.json)
        if args.json:
            print(json.dumps(res, indent=2))
    elif args.command == "journey":
        res = cmd_journey(args.id, hops=args.hops, as_json=args.json)
        if args.json:
            print(json.dumps(res, indent=2))
    else:
        # If run with no args or query string directly
        cmd_status(as_json=False)


if __name__ == "__main__":
    main()
