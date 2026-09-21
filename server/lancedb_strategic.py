#!/usr/bin/env python3
"""
lancedb_strategic.py - High-Performance Columnar Vector Memory Engine
Uses LanceDB (in-process, serverless, Apache Arrow disk format) for
ultrafast semantic and hybrid search over Architectural Decision Records (ADRs),
Grill-Me logs, and Git Semantic Digests.

Runs 100% offline on Windows with local ONNX embeddings (all-MiniLM-L6-v2).
Can also seamlessly sync with ~/.cavemem/data.db.
"""

import os
import sys
import json
import time
import sqlite3
import argparse
import hashlib
from pathlib import Path
from typing import List, Dict, Any, Optional

import lancedb
import pyarrow as pa
import numpy as np

# Use the pre-downloaded local quantized model
DEFAULT_LANCE_DIR = os.path.expanduser(r"~\.strategic_memory\lancedb")
DEFAULT_CAVEMEM_DB = os.path.expanduser(r"~\.cavemem\data.db")
DEFAULT_MODEL_PATH = os.path.expanduser(r"~\.cavemem\models\Xenova\all-MiniLM-L6-v2\onnx\model_quantized.onnx")
DEFAULT_TOKENIZER_PATH = os.path.expanduser(r"~\.cavemem\models\Xenova\all-MiniLM-L6-v2\tokenizer.json")
EMBED_DIM = 384
RECOVERY_TABLE = "recovery_records"


class LocalEmbedder:
    def __init__(self, model_path: str = DEFAULT_MODEL_PATH, tokenizer_path: str = DEFAULT_TOKENIZER_PATH):
        self.model_path = model_path
        self.tokenizer_path = tokenizer_path
        self._session = None
        self._tokenizer = None

    def _ensure_loaded(self):
        if self._session is None or self._tokenizer is None:
            if not os.path.exists(self.model_path) or not os.path.exists(self.tokenizer_path):
                try:
                    from sentence_transformers import SentenceTransformer
                    self._st_model = SentenceTransformer("all-MiniLM-L6-v2")
                    self._use_st = True
                    return
                except Exception:
                    pass
                self._fallback_mode = True
                return

            try:
                import onnxruntime as ort
                import tokenizers
                opts = ort.SessionOptions()
                opts.log_severity_level = 3
                self._session = ort.InferenceSession(self.model_path, sess_options=opts)
                self._tokenizer = tokenizers.Tokenizer.from_file(self.tokenizer_path)
                self._tokenizer.enable_truncation(max_length=256)
            except Exception:
                self._fallback_mode = True

    def embed(self, text: str) -> List[float]:
        self._ensure_loaded()
        if getattr(self, "_use_st", False):
            emb = self._st_model.encode(text, normalize_embeddings=True)
            return [float(x) for x in emb]

        if getattr(self, "_fallback_mode", False):
            import hashlib
            seed = int(hashlib.sha256(text.encode("utf-8")).hexdigest()[:8], 16)
            rng = np.random.RandomState(seed)
            v = rng.randn(EMBED_DIM).astype(np.float32)
            norm = np.linalg.norm(v)
            return [(float(x) / (float(norm) if norm > 0 else 1.0)) for x in v]

        enc = self._tokenizer.encode(text)
        feed = {
            "input_ids": np.array([enc.ids], dtype=np.int64),
            "attention_mask": np.array([enc.attention_mask], dtype=np.int64),
            "token_type_ids": np.array([enc.type_ids], dtype=np.int64)
        }
        outputs = self._session.run(None, feed)
        token_embeddings = outputs[0]  # [1, seq_len, 384]
        mask = np.array([enc.attention_mask], dtype=np.float32)[:, :, np.newaxis]
        mask_expanded = np.broadcast_to(mask, token_embeddings.shape)
        sum_emb = np.sum(token_embeddings * mask_expanded, axis=1)
        sum_mask = np.clip(np.sum(mask_expanded, axis=1), a_min=1e-9, a_max=None)
        pooled = sum_emb / sum_mask
        norm = np.linalg.norm(pooled, axis=1, keepdims=True)
        normalized = (pooled / norm)[0]
        return normalized.tolist()


def get_db(db_dir: str = DEFAULT_LANCE_DIR):
    os.makedirs(db_dir, exist_ok=True)
    return lancedb.connect(db_dir)


def get_table_names(db):
    res = db.list_tables()
    if hasattr(res, "tables"):
        return res.tables
    return list(res)


def init_tables(db):
    table_names = get_table_names(db)
    
    # 1. ADR schema
    if "adrs" not in table_names:
        schema = pa.schema([
            pa.field("id", pa.int64()),
            pa.field("project", pa.string()),
            pa.field("title", pa.string()),
            pa.field("context", pa.string()),
            pa.field("decision", pa.string()),
            pa.field("rationale", pa.string()),
            pa.field("trade_offs", pa.string()),
            pa.field("status", pa.string()),
            pa.field("tags", pa.string()),
            pa.field("timestamp", pa.string()),
            pa.field("vector", pa.list_(pa.float32(), EMBED_DIM))
        ])
        db.create_table("adrs", schema=schema)
        
    # 2. Grill-Me schema
    if "grill_me_logs" not in table_names:
        schema = pa.schema([
            pa.field("id", pa.int64()),
            pa.field("project", pa.string()),
            pa.field("topic", pa.string()),
            pa.field("questions", pa.string()),
            pa.field("answers", pa.string()),
            pa.field("key_takeaways", pa.string()),
            pa.field("resolved_direction", pa.string()),
            pa.field("timestamp", pa.string()),
            pa.field("vector", pa.list_(pa.float32(), EMBED_DIM))
        ])
        db.create_table("grill_me_logs", schema=schema)
        
    # 3. Git digests schema
    if "git_digests" not in table_names:
        schema = pa.schema([
            pa.field("id", pa.int64()),
            pa.field("project", pa.string()),
            pa.field("commit_hash", pa.string()),
            pa.field("branch", pa.string()),
            pa.field("summary", pa.string()),
            pa.field("files_changed", pa.string()),
            pa.field("rationale", pa.string()),
            pa.field("timestamp", pa.string()),
            pa.field("vector", pa.list_(pa.float32(), EMBED_DIM))
        ])
        db.create_table("git_digests", schema=schema)

    # Recovery records are the compact, high-signal memories that agents need
    # after compaction. Raw observations deliberately remain SQLite-only.
    if RECOVERY_TABLE not in table_names:
        schema = pa.schema([
            pa.field("id", pa.string()),
            pa.field("stable_key", pa.string()),
            pa.field("record_type", pa.string()),
            pa.field("project", pa.string()),
            pa.field("title", pa.string()),
            pa.field("content", pa.string()),
            pa.field("tags", pa.string()),
            pa.field("timestamp", pa.string()),
            pa.field("indexed_at", pa.string()),
            pa.field("related_ids", pa.string()),
            pa.field("vector", pa.list_(pa.float32(), EMBED_DIM))
        ])
        db.create_table(RECOVERY_TABLE, schema=schema)


def sync_from_cavemem(db_dir: str = DEFAULT_LANCE_DIR, cavemem_db: str = DEFAULT_CAVEMEM_DB,
                      embedder: Optional[LocalEmbedder] = None):
    db = get_db(db_dir)
    init_tables(db)
    embedder = embedder or LocalEmbedder()
    
    conn = sqlite3.connect(cavemem_db)
    cur = conn.cursor()
    
    # Sync ADRs
    cur.execute("SELECT id, project, title, context, decision, rationale, trade_offs, status, tags, timestamp FROM adrs")
    adr_rows = cur.fetchall()
    if adr_rows:
        tbl = db.open_table("adrs")
        records = []
        for r in adr_rows:
            embed_text = f"Title: {r[2]}\nContext: {r[3]}\nDecision: {r[4]}\nRationale: {r[5]}\nTags: {r[8]}"
            vec = embedder.embed(embed_text)
            records.append({
                "id": r[0], "project": r[1] or "", "title": r[2] or "", "context": r[3] or "",
                "decision": r[4] or "", "rationale": r[5] or "", "trade_offs": r[6] or "",
                "status": r[7] or "accepted", "tags": r[8] or "", "timestamp": str(r[9] or ""),
                "vector": vec
            })
        tbl.add(records, mode="overwrite")
        print(f"✓ Synced {len(records)} ADR(s) to LanceDB")

    # Sync Grill-Me
    cur.execute("SELECT id, project, topic, questions, answers, key_takeaways, resolved_direction, timestamp FROM grill_me_logs")
    grill_rows = cur.fetchall()
    if grill_rows:
        tbl = db.open_table("grill_me_logs")
        records = []
        for r in grill_rows:
            embed_text = f"Topic: {r[2]}\nQuestions: {r[3]}\nAnswers: {r[4]}\nDirection: {r[6]}"
            vec = embedder.embed(embed_text)
            records.append({
                "id": r[0], "project": r[1] or "", "topic": r[2] or "", "questions": r[3] or "",
                "answers": r[4] or "", "key_takeaways": r[5] or "", "resolved_direction": r[6] or "",
                "timestamp": str(r[7] or ""), "vector": vec
            })
        tbl.add(records, mode="overwrite")
        print(f"✓ Synced {len(records)} Grill-Me log(s) to LanceDB")

    # Sync Git digests
    cur.execute("SELECT id, project, commit_hash, branch, summary, files_changed, rationale, timestamp FROM git_semantic_digests")
    git_rows = cur.fetchall()
    if git_rows:
        tbl = db.open_table("git_digests")
        records = []
        for r in git_rows:
            embed_text = f"Commit: {r[2]}\nSummary: {r[4]}\nRationale: {r[6]}\nFiles: {r[5]}"
            vec = embedder.embed(embed_text)
            records.append({
                "id": r[0], "project": r[1] or "", "commit_hash": r[2] or "", "branch": r[3] or "",
                "summary": r[4] or "", "files_changed": r[5] or "", "rationale": r[6] or "",
                "timestamp": str(r[7] or ""), "vector": vec
            })
        tbl.add(records, mode="overwrite")
        print(f"✓ Synced {len(records)} Git digest(s) to LanceDB")

    # Sync compact recovery records. A durable memory promoted from a checkpoint
    # has the stable key checkpoint:<sha256(content)> and is linked to, rather
    # than duplicated beside, the original checkpoint.
    recovery_records = []
    checkpoint_index = {}
    indexed_at = str(int(time.time() * 1000))

    def content_hash(content: str) -> str:
        return hashlib.sha256((content or "").encode("utf-8")).hexdigest()

    def add_recovery(record_id: str, stable_key: str, record_type: str, project: str,
                     title: str, content: str, tags: str, timestamp: Any,
                     related_ids: str = ""):
        recovery_records.append({
            "id": record_id,
            "stable_key": stable_key,
            "record_type": record_type,
            "project": project or "",
            "title": title or "",
            "content": content or "",
            "tags": tags or "",
            "timestamp": str(timestamp or ""),
            "indexed_at": indexed_at,
            "related_ids": related_ids,
            "vector": embedder.embed(f"Title: {title}\nContent: {content}\nTags: {tags}")
        })

    if _table_exists(cur, "summaries") and _table_exists(cur, "sessions"):
        cur.execute("""
            SELECT x.id, x.scope, x.content, x.ts, COALESCE(s.project_key,s.cwd,'global'), x.session_id
            FROM summaries x JOIN sessions s ON s.id = x.session_id
        """)
        for row in cur.fetchall():
            add_recovery(f"summary-{row[0]}", f"summary:{row[0]}", "summary", row[4],
                         f"{(row[1] or 'session').title()} summary", row[2], row[5], row[3])

    if _table_exists(cur, "checkpoints"):
        cur.execute("SELECT id, session_id, project_key, trigger, content, ts FROM checkpoints")
        for row in cur.fetchall():
            stable_key = f"checkpoint:{content_hash(row[4])}"
            record_id = f"checkpoint-{row[0]}"
            checkpoint_index[stable_key] = len(recovery_records)
            add_recovery(record_id, stable_key, "checkpoint", row[2],
                         f"Compaction checkpoint ({row[3]})", row[4], row[1], row[5])

    if _table_exists(cur, "memory_items"):
        cur.execute("SELECT id, stable_key, project_key, kind, title, content, updated_at FROM memory_items")
        for row in cur.fetchall():
            record_id = f"memory-{row[0]}"
            checkpoint_key = row[1] if row[1] in checkpoint_index else f"checkpoint:{content_hash(row[5])}"
            if checkpoint_key in checkpoint_index:
                existing = recovery_records[checkpoint_index[checkpoint_key]]
                existing["related_ids"] = ",".join(filter(None, [existing["related_ids"], record_id]))
                continue
            add_recovery(record_id, row[1], "memory", row[2], row[4], row[5], row[3], row[6])

    recovery_table = db.open_table(RECOVERY_TABLE)
    if recovery_records:
        recovery_table.add(recovery_records, mode="overwrite")
    print(f"✓ Synced {len(recovery_records)} recovery record(s) to LanceDB")

    conn.close()


def _table_exists(cursor, name: str) -> bool:
    return cursor.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)).fetchone() is not None


def search(query: str, limit: int = 5, db_dir: str = DEFAULT_LANCE_DIR,
           embedder: Optional[LocalEmbedder] = None, as_json: bool = False) -> List[Dict[str, Any]]:
    db = get_db(db_dir)
    init_tables(db)
    embedder = embedder or LocalEmbedder()
    query_vec = embedder.embed(query)
    output = []
    table_names = get_table_names(db)
    for tbl_name, title_key, desc_key in [
        ("adrs", "title", "rationale"),
        ("grill_me_logs", "topic", "resolved_direction"),
        ("git_digests", "summary", "rationale"),
        (RECOVERY_TABLE, "title", "content")
    ]:
        if tbl_name in table_names:
            tbl = db.open_table(tbl_name)
            if len(tbl) > 0:
                results = tbl.search(query_vec).metric("cosine").limit(limit).to_list()
                for r in results:
                    dist = float(r.get("_distance", 2.0))
                    similarity = max(0.0, min(1.0, 1.0 - (dist / 2.0)))
                    output.append({
                        "table": tbl_name,
                        "id": r.get("id"),
                        "record_type": r.get("record_type"),
                        "title": r.get(title_key, ""),
                        "preview": (r.get(desc_key, "") or "")[:130],
                        "distance": round(dist, 6),
                        "similarity": round(similarity, 6),
                        "indexed_at": r.get("indexed_at", ""),
                        "related_ids": r.get("related_ids", "")
                    })

    if as_json:
        return output

    print(f"\n==================================================")
    print(f" LanceDB Vector Search (Disk Columnar): '{query}'")
    print(f"==================================================")
    for item in output:
        label = item["record_type"] or item["table"]
        print(f"\n[{label.upper()}] {item['title']} (similarity: {item['similarity']:.4f}, distance: {item['distance']:.4f})")
        print(f"  • [{item['id']}] {item['preview']}...")
    return output


def status():
    db = get_db()
    init_tables(db)
    print("========================================")
    print(" LanceDB Strategic Engine Status")
    print("========================================")
    print(f"Directory: {DEFAULT_LANCE_DIR}")
    for t in sorted(get_table_names(db)):
        tbl = db.open_table(t)
        print(f"  • Table: {t:<18} Rows: {len(tbl)}")
    print(f"Embedding: {DEFAULT_MODEL_PATH}")
    print("========================================")


def main():
    parser = argparse.ArgumentParser(description="LanceDB Strategic Memory Engine")
    sub = parser.add_subparsers(dest="cmd")

    sub.add_parser("sync", help="Sync all records from Cavemem SQLite into LanceDB")
    sub.add_parser("status", help="Show LanceDB table counts and status")
    
    s_parser = sub.add_parser("search", help="Perform vector search across LanceDB")
    s_parser.add_argument("query", help="Search query string")
    s_parser.add_argument("--limit", type=int, default=3, help="Max results per table")
    s_parser.add_argument("--json", action="store_true", help="Output machine-readable JSON")

    args = parser.parse_args()
    if args.cmd == "sync":
        sync_from_cavemem()
    elif args.cmd == "search":
        results = search(args.query, args.limit, as_json=args.json)
        if args.json:
            print(json.dumps(results, indent=2))
    elif args.cmd == "status":
        status()
    else:
        status()

if __name__ == "__main__":
    main()
