#!/usr/bin/env python3
"""
cavemem_strategic.py - Strategic Memory Extension for Cavemem
Provides structured schemas and CLI commands for:
  - Architectural Decision Records (ADRs)
  - Grill-Me / Interview Logs
  - Git Semantic Digests
  - FTS5 instant keyword search + Local ONNX embedding semantic search
    using ~/.cavemem/models/Xenova/all-MiniLM-L6-v2/onnx/model_quantized.onnx
"""

import sys
import os
import re
import json
import time
import sqlite3
import argparse
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

DEFAULT_DB_PATH = os.path.expanduser(r"~\.cavemem\data.db")
DEFAULT_MODEL_PATH = os.path.expanduser(r"~\.cavemem\models\Xenova\all-MiniLM-L6-v2\onnx\model_quantized.onnx")
DEFAULT_TOKENIZER_PATH = os.path.expanduser(r"~\.cavemem\models\Xenova\all-MiniLM-L6-v2\tokenizer.json")
EMBEDDING_DIM = 384
EMBEDDING_MODEL_NAME = "Xenova/all-MiniLM-L6-v2"
try:
    from .pitmry.embeddings import EmbeddingUnavailable, LocalEmbedder
except ImportError:  # direct `python server/cavemem_strategic.py` invocation
    from pitmry.embeddings import EmbeddingUnavailable, LocalEmbedder


def sanitize_fts_query(query: str) -> str:
    """Prepares safe FTS5 MATCH expression supporting multi-term prefix search."""
    cleaned = re.sub(r'[^\w\s]', ' ', query)
    tokens = [t.strip() for t in cleaned.split() if t.strip()]
    if not tokens:
        return ""
    return " AND ".join(f'"{t}"*' for t in tokens)


class StrategicMemoryDB:
    def __init__(self, db_path: str = DEFAULT_DB_PATH, embedder: Optional[LocalEmbedder] = None):
        self.db_path = db_path
        self.embedder = embedder or LocalEmbedder()
        self.init_schema()

    def get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def init_schema(self):
        """Builds custom structured schemas and FTS5 indexes alongside base cavemem tables."""
        schema_sql = """
        -- 1. Architectural Decision Records (ADRs)
        CREATE TABLE IF NOT EXISTS adrs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project TEXT NOT NULL,
            title TEXT NOT NULL,
            context TEXT NOT NULL,
            decision TEXT NOT NULL,
            rationale TEXT NOT NULL,
            trade_offs TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'accepted',
            timestamp INTEGER NOT NULL,
            tags TEXT NOT NULL DEFAULT '',
            metadata TEXT NOT NULL DEFAULT '{}'
        );
        CREATE INDEX IF NOT EXISTS idx_adrs_project ON adrs(project);
        CREATE INDEX IF NOT EXISTS idx_adrs_timestamp ON adrs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_adrs_status ON adrs(status);

        CREATE VIRTUAL TABLE IF NOT EXISTS adrs_fts USING fts5(
            title,
            context,
            decision,
            rationale,
            trade_offs,
            tags,
            content='adrs',
            content_rowid='id',
            tokenize='porter unicode61'
        );

        CREATE TRIGGER IF NOT EXISTS adrs_ai AFTER INSERT ON adrs BEGIN
            INSERT INTO adrs_fts(rowid, title, context, decision, rationale, trade_offs, tags)
            VALUES (new.id, new.title, new.context, new.decision, new.rationale, new.trade_offs, new.tags);
        END;

        CREATE TRIGGER IF NOT EXISTS adrs_ad AFTER DELETE ON adrs BEGIN
            INSERT INTO adrs_fts(adrs_fts, rowid, title, context, decision, rationale, trade_offs, tags)
            VALUES ('delete', old.id, old.title, old.context, old.decision, old.rationale, old.trade_offs, old.tags);
        END;

        CREATE TRIGGER IF NOT EXISTS adrs_au AFTER UPDATE ON adrs BEGIN
            INSERT INTO adrs_fts(adrs_fts, rowid, title, context, decision, rationale, trade_offs, tags)
            VALUES ('delete', old.id, old.title, old.context, old.decision, old.rationale, old.trade_offs, old.tags);
            INSERT INTO adrs_fts(rowid, title, context, decision, rationale, trade_offs, tags)
            VALUES (new.id, new.title, new.context, new.decision, new.rationale, new.trade_offs, new.tags);
        END;

        -- 2. Grill-Me / Interview Logs
        CREATE TABLE IF NOT EXISTS grill_me_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project TEXT NOT NULL,
            topic TEXT NOT NULL,
            questions TEXT NOT NULL,
            answers TEXT NOT NULL,
            key_takeaways TEXT NOT NULL,
            resolved_direction TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            metadata TEXT NOT NULL DEFAULT '{}'
        );
        CREATE INDEX IF NOT EXISTS idx_grill_me_project ON grill_me_logs(project);
        CREATE INDEX IF NOT EXISTS idx_grill_me_timestamp ON grill_me_logs(timestamp);

        CREATE VIRTUAL TABLE IF NOT EXISTS grill_me_fts USING fts5(
            topic,
            questions,
            answers,
            key_takeaways,
            resolved_direction,
            content='grill_me_logs',
            content_rowid='id',
            tokenize='porter unicode61'
        );

        CREATE TRIGGER IF NOT EXISTS grill_me_ai AFTER INSERT ON grill_me_logs BEGIN
            INSERT INTO grill_me_fts(rowid, topic, questions, answers, key_takeaways, resolved_direction)
            VALUES (new.id, new.topic, new.questions, new.answers, new.key_takeaways, new.resolved_direction);
        END;

        CREATE TRIGGER IF NOT EXISTS grill_me_ad AFTER DELETE ON grill_me_logs BEGIN
            INSERT INTO grill_me_fts(grill_me_fts, rowid, topic, questions, answers, key_takeaways, resolved_direction)
            VALUES ('delete', old.id, old.topic, old.questions, old.answers, old.key_takeaways, old.resolved_direction);
        END;

        CREATE TRIGGER IF NOT EXISTS grill_me_au AFTER UPDATE ON grill_me_logs BEGIN
            INSERT INTO grill_me_fts(grill_me_fts, rowid, topic, questions, answers, key_takeaways, resolved_direction)
            VALUES ('delete', old.id, old.topic, old.questions, old.answers, old.key_takeaways, old.resolved_direction);
            INSERT INTO grill_me_fts(rowid, topic, questions, answers, key_takeaways, resolved_direction)
            VALUES (new.id, new.topic, new.questions, new.answers, new.key_takeaways, new.resolved_direction);
        END;

        -- 3. Git Semantic Digests
        CREATE TABLE IF NOT EXISTS git_semantic_digests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project TEXT NOT NULL,
            commit_hash TEXT NOT NULL,
            branch TEXT NOT NULL,
            summary TEXT NOT NULL,
            files_changed TEXT NOT NULL,
            rationale TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            metadata TEXT NOT NULL DEFAULT '{}'
        );
        CREATE INDEX IF NOT EXISTS idx_git_digests_project ON git_semantic_digests(project);
        CREATE INDEX IF NOT EXISTS idx_git_digests_commit ON git_semantic_digests(commit_hash);
        CREATE INDEX IF NOT EXISTS idx_git_digests_timestamp ON git_semantic_digests(timestamp);

        CREATE VIRTUAL TABLE IF NOT EXISTS git_digests_fts USING fts5(
            commit_hash,
            branch,
            summary,
            files_changed,
            rationale,
            content='git_semantic_digests',
            content_rowid='id',
            tokenize='porter unicode61'
        );

        CREATE TRIGGER IF NOT EXISTS git_digests_ai AFTER INSERT ON git_semantic_digests BEGIN
            INSERT INTO git_digests_fts(rowid, commit_hash, branch, summary, files_changed, rationale)
            VALUES (new.id, new.commit_hash, new.branch, new.summary, new.files_changed, new.rationale);
        END;

        CREATE TRIGGER IF NOT EXISTS git_digests_ad AFTER DELETE ON git_semantic_digests BEGIN
            INSERT INTO git_digests_fts(git_digests_fts, rowid, commit_hash, branch, summary, files_changed, rationale)
            VALUES ('delete', old.id, old.commit_hash, old.branch, old.summary, old.files_changed, old.rationale);
        END;

        CREATE TRIGGER IF NOT EXISTS git_digests_au AFTER UPDATE ON git_semantic_digests BEGIN
            INSERT INTO git_digests_fts(git_digests_fts, rowid, commit_hash, branch, summary, files_changed, rationale)
            VALUES ('delete', old.id, old.commit_hash, old.branch, old.summary, old.files_changed, old.rationale);
            INSERT INTO git_digests_fts(rowid, commit_hash, branch, summary, files_changed, rationale)
            VALUES (new.id, new.commit_hash, new.branch, new.summary, new.files_changed, new.rationale);
        END;

        -- 4. Strategic Vector Embeddings
        CREATE TABLE IF NOT EXISTS strategic_embeddings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type TEXT NOT NULL CHECK(entity_type IN ('adr', 'grill_me', 'git_digest')),
            entity_id INTEGER NOT NULL,
            model TEXT NOT NULL,
            dim INTEGER NOT NULL,
            vec BLOB NOT NULL,
            UNIQUE(entity_type, entity_id, model)
        );
        CREATE INDEX IF NOT EXISTS idx_strat_embed_lookup ON strategic_embeddings(entity_type, entity_id);
        """
        with self.get_connection() as conn:
            conn.executescript(schema_sql)

    # ----------------- RECORD METHODS -----------------

    def record_adr(self, project: str, title: str, context: str, decision: str,
                   rationale: str, trade_offs: str = "", status: str = "accepted",
                   tags: str = "", metadata: Optional[Dict] = None,
                   timestamp: Optional[int] = None, embed: bool = True) -> int:
        ts = timestamp if timestamp is not None else int(time.time() * 1000)
        meta_str = json.dumps(metadata or {})
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO adrs (project, title, context, decision, rationale, trade_offs, status, timestamp, tags, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (project, title, context, decision, rationale, trade_offs, status, ts, tags, meta_str))
            adr_id = cur.lastrowid
            conn.commit()

        if embed:
            text_to_embed = f"ADR: {title}\nProject: {project}\nDecision: {decision}\nRationale: {rationale}\nContext: {context}\nTrade-offs: {trade_offs}\nTags: {tags}"
            self._save_embedding("adr", adr_id, text_to_embed)

        return adr_id

    def record_grill(self, project: str, topic: str, questions: str, answers: str,
                     key_takeaways: str, resolved_direction: str,
                     metadata: Optional[Dict] = None, timestamp: Optional[int] = None,
                     embed: bool = True) -> int:
        ts = timestamp if timestamp is not None else int(time.time() * 1000)
        meta_str = json.dumps(metadata or {})
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO grill_me_logs (project, topic, questions, answers, key_takeaways, resolved_direction, timestamp, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (project, topic, questions, answers, key_takeaways, resolved_direction, ts, meta_str))
            grill_id = cur.lastrowid
            conn.commit()

        if embed:
            text_to_embed = f"Grill-Me Log: {topic}\nProject: {project}\nResolved: {resolved_direction}\nKey Takeaways: {key_takeaways}\nQuestions: {questions}\nAnswers: {answers}"
            self._save_embedding("grill_me", grill_id, text_to_embed)

        return grill_id

    def record_git_digest(self, project: str, commit_hash: str, branch: str,
                          summary: str, files_changed: str, rationale: str,
                          metadata: Optional[Dict] = None, timestamp: Optional[int] = None,
                          embed: bool = True) -> int:
        ts = timestamp if timestamp is not None else int(time.time() * 1000)
        meta_str = json.dumps(metadata or {})
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO git_semantic_digests (project, commit_hash, branch, summary, files_changed, rationale, timestamp, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (project, commit_hash, branch, summary, files_changed, rationale, ts, meta_str))
            digest_id = cur.lastrowid
            conn.commit()

        if embed:
            text_to_embed = f"Git Semantic Digest [{commit_hash[:8]}] on {branch} ({project}):\nSummary: {summary}\nRationale: {rationale}\nFiles: {files_changed}"
            self._save_embedding("git_digest", digest_id, text_to_embed)

        return digest_id

    def _save_embedding(self, entity_type: str, entity_id: int, text: str):
        try:
            import numpy as np
            vec = self.embedder.embed(text)
            vec_blob = np.asarray(vec, dtype=np.float32).tobytes()
            with self.get_connection() as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO strategic_embeddings (entity_type, entity_id, model, dim, vec)
                    VALUES (?, ?, ?, ?, ?)
                """, (entity_type, entity_id, EMBEDDING_MODEL_NAME, EMBEDDING_DIM, vec_blob))
                conn.commit()
        except Exception as e:
            print(f"[Warning] Failed to generate embedding for {entity_type} {entity_id}: {e}", file=sys.stderr)

    # ----------------- RETRIEVAL & QUERY METHODS -----------------

    def get_adr(self, adr_id: int) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            row = conn.execute("SELECT * FROM adrs WHERE id = ?", (adr_id,)).fetchone()
            return dict(row) if row else None

    def get_grill(self, grill_id: int) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            row = conn.execute("SELECT * FROM grill_me_logs WHERE id = ?", (grill_id,)).fetchone()
            return dict(row) if row else None

    def get_git_digest(self, digest_id: int) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            row = conn.execute("SELECT * FROM git_semantic_digests WHERE id = ?", (digest_id,)).fetchone()
            return dict(row) if row else None

    def query_adrs(self, project: Optional[str] = None, status: Optional[str] = None,
                   tag: Optional[str] = None, keyword: Optional[str] = None,
                   semantic: Optional[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
        if semantic:
            return self._semantic_search("adr", semantic, limit, project=project)

        if keyword:
            safe_match = sanitize_fts_query(keyword)
            if not safe_match:
                return []
            params = [safe_match]
            where_clauses = ["adrs_fts MATCH ?"]
            if project:
                where_clauses.append("a.project = ?")
                params.append(project)
            if status:
                where_clauses.append("a.status = ?")
                params.append(status)
            if tag:
                where_clauses.append("a.tags LIKE ?")
                params.append(f"%{tag}%")
            params.append(limit)

            sql = f"""
                SELECT a.*, bm25(adrs_fts) AS rank_score
                FROM adrs_fts f
                JOIN adrs a ON f.rowid = a.id
                WHERE {" AND ".join(where_clauses)}
                ORDER BY rank_score ASC
                LIMIT ?
            """
            with self.get_connection() as conn:
                return [dict(r) for r in conn.execute(sql, params).fetchall()]

        # Plain query
        where_clauses = []
        params = []
        if project:
            where_clauses.append("project = ?")
            params.append(project)
        if status:
            where_clauses.append("status = ?")
            params.append(status)
        if tag:
            where_clauses.append("tags LIKE ?")
            params.append(f"%{tag}%")
        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
        params.append(limit)

        sql = f"SELECT * FROM adrs {where_sql} ORDER BY timestamp DESC LIMIT ?"
        with self.get_connection() as conn:
            return [dict(r) for r in conn.execute(sql, params).fetchall()]

    def query_grills(self, project: Optional[str] = None, keyword: Optional[str] = None,
                     semantic: Optional[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
        if semantic:
            return self._semantic_search("grill_me", semantic, limit, project=project)

        if keyword:
            safe_match = sanitize_fts_query(keyword)
            if not safe_match:
                return []
            params = [safe_match]
            where_clauses = ["grill_me_fts MATCH ?"]
            if project:
                where_clauses.append("g.project = ?")
                params.append(project)
            params.append(limit)

            sql = f"""
                SELECT g.*, bm25(grill_me_fts) AS rank_score
                FROM grill_me_fts f
                JOIN grill_me_logs g ON f.rowid = g.id
                WHERE {" AND ".join(where_clauses)}
                ORDER BY rank_score ASC
                LIMIT ?
            """
            with self.get_connection() as conn:
                return [dict(r) for r in conn.execute(sql, params).fetchall()]

        where_sql = "WHERE project = ?" if project else ""
        params = [project, limit] if project else [limit]
        sql = f"SELECT * FROM grill_me_logs {where_sql} ORDER BY timestamp DESC LIMIT ?"
        with self.get_connection() as conn:
            return [dict(r) for r in conn.execute(sql, params).fetchall()]

    def query_git_digests(self, project: Optional[str] = None, branch: Optional[str] = None,
                          commit_hash: Optional[str] = None, keyword: Optional[str] = None,
                          semantic: Optional[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
        if semantic:
            return self._semantic_search("git_digest", semantic, limit, project=project)

        if keyword:
            safe_match = sanitize_fts_query(keyword)
            if not safe_match:
                return []
            params = [safe_match]
            where_clauses = ["git_digests_fts MATCH ?"]
            if project:
                where_clauses.append("g.project = ?")
                params.append(project)
            if branch:
                where_clauses.append("g.branch = ?")
                params.append(branch)
            if commit_hash:
                where_clauses.append("g.commit_hash LIKE ?")
                params.append(f"{commit_hash}%")
            params.append(limit)

            sql = f"""
                SELECT g.*, bm25(git_digests_fts) AS rank_score
                FROM git_digests_fts f
                JOIN git_semantic_digests g ON f.rowid = g.id
                WHERE {" AND ".join(where_clauses)}
                ORDER BY rank_score ASC
                LIMIT ?
            """
            with self.get_connection() as conn:
                return [dict(r) for r in conn.execute(sql, params).fetchall()]

        where_clauses = []
        params = []
        if project:
            where_clauses.append("project = ?")
            params.append(project)
        if branch:
            where_clauses.append("branch = ?")
            params.append(branch)
        if commit_hash:
            where_clauses.append("commit_hash LIKE ?")
            params.append(f"{commit_hash}%")
        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
        params.append(limit)

        sql = f"SELECT * FROM git_semantic_digests {where_sql} ORDER BY timestamp DESC LIMIT ?"
        with self.get_connection() as conn:
            return [dict(r) for r in conn.execute(sql, params).fetchall()]

    def _semantic_search(self, entity_type: str, query: str, limit: int = 10,
                         project: Optional[str] = None) -> List[Dict[str, Any]]:
        import numpy as np
        try:
            query_vec = np.asarray(self.embedder.embed(query), dtype=np.float32)
        except EmbeddingUnavailable as exc:
            print(f"[Warning] Vector search unavailable; use FTS search: {exc}", file=sys.stderr)
            return []

        # Retrieve vectors for target entity_type
        sql = """
            SELECT entity_id, vec FROM strategic_embeddings
            WHERE entity_type = ? AND model = ?
        """
        with self.get_connection() as conn:
            rows = conn.execute(sql, (entity_type, EMBEDDING_MODEL_NAME)).fetchall()

        if not rows:
            return []

        entity_ids = [r["entity_id"] for r in rows]
        vectors = np.array([np.frombuffer(r["vec"], dtype=np.float32) for r in rows])

        # Cosine similarity for normalized vectors is simply the dot product
        scores = np.dot(vectors, query_vec)
        top_indices = np.argsort(scores)[::-1]

        # Fetch records
        table_map = {
            "adr": ("adrs", "id"),
            "grill_me": ("grill_me_logs", "id"),
            "git_digest": ("git_semantic_digests", "id"),
        }
        tbl, id_col = table_map[entity_type]

        results = []
        for idx in top_indices:
            eid = entity_ids[idx]
            sim = float(scores[idx])
            with self.get_connection() as conn:
                q_sql = f"SELECT * FROM {tbl} WHERE {id_col} = ?"
                params = [eid]
                if project:
                    q_sql += " AND project = ?"
                    params.append(project)
                row = conn.execute(q_sql, params).fetchone()
                if row:
                    res_dict = dict(row)
                    res_dict["similarity"] = round(sim, 4)
                    results.append(res_dict)
            if len(results) >= limit:
                break

        return results

    def unified_search(self, query: str, mode: str = "keyword", limit: int = 10) -> Dict[str, Any]:
        """Searches across all 3 strategic tables."""
        if mode == "semantic":
            adrs = self.query_adrs(semantic=query, limit=limit)
            grills = self.query_grills(semantic=query, limit=limit)
            digests = self.query_git_digests(semantic=query, limit=limit)
        else:
            adrs = self.query_adrs(keyword=query, limit=limit)
            grills = self.query_grills(keyword=query, limit=limit)
            digests = self.query_git_digests(keyword=query, limit=limit)

        return {
            "query": query,
            "mode": mode,
            "adrs": adrs,
            "grill_me_logs": grills,
            "git_semantic_digests": digests,
        }

    def backfill_embeddings(self) -> Dict[str, int]:
        """Generates missing embeddings for all strategic tables."""
        counts = {"adr": 0, "grill_me": 0, "git_digest": 0}

        with self.get_connection() as conn:
            # ADRs
            unembedded_adrs = conn.execute("""
                SELECT a.* FROM adrs a
                LEFT JOIN strategic_embeddings e ON e.entity_type = 'adr' AND e.entity_id = a.id AND e.model = ?
                WHERE e.id IS NULL
            """, (EMBEDDING_MODEL_NAME,)).fetchall()

            for a in unembedded_adrs:
                text = f"ADR: {a['title']}\nProject: {a['project']}\nDecision: {a['decision']}\nRationale: {a['rationale']}\nContext: {a['context']}\nTrade-offs: {a['trade_offs']}\nTags: {a['tags']}"
                self._save_embedding("adr", a["id"], text)
                counts["adr"] += 1

            # Grill Me
            unembedded_grills = conn.execute("""
                SELECT g.* FROM grill_me_logs g
                LEFT JOIN strategic_embeddings e ON e.entity_type = 'grill_me' AND e.entity_id = g.id AND e.model = ?
                WHERE e.id IS NULL
            """, (EMBEDDING_MODEL_NAME,)).fetchall()

            for g in unembedded_grills:
                text = f"Grill-Me Log: {g['topic']}\nProject: {g['project']}\nResolved: {g['resolved_direction']}\nKey Takeaways: {g['key_takeaways']}\nQuestions: {g['questions']}\nAnswers: {g['answers']}"
                self._save_embedding("grill_me", g["id"], text)
                counts["grill_me"] += 1

            # Git Digests
            unembedded_digests = conn.execute("""
                SELECT d.* FROM git_semantic_digests d
                LEFT JOIN strategic_embeddings e ON e.entity_type = 'git_digest' AND e.entity_id = d.id AND e.model = ?
                WHERE e.id IS NULL
            """, (EMBEDDING_MODEL_NAME,)).fetchall()

            for d in unembedded_digests:
                text = f"Git Semantic Digest [{d['commit_hash'][:8]}] on {d['branch']} ({d['project']}):\nSummary: {d['summary']}\nRationale: {d['rationale']}\nFiles: {d['files_changed']}"
                self._save_embedding("git_digest", d["id"], text)
                counts["git_digest"] += 1

        return counts

    def get_status(self) -> Dict[str, Any]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            base_obs = cur.execute("SELECT count(*) FROM observations").fetchone()[0]
            base_sessions = cur.execute("SELECT count(*) FROM sessions").fetchone()[0]
            base_summaries = cur.execute("SELECT count(*) FROM summaries").fetchone()[0]

            adrs_count = cur.execute("SELECT count(*) FROM adrs").fetchone()[0]
            grill_count = cur.execute("SELECT count(*) FROM grill_me_logs").fetchone()[0]
            git_count = cur.execute("SELECT count(*) FROM git_semantic_digests").fetchone()[0]
            strat_embeds = cur.execute("SELECT count(*) FROM strategic_embeddings").fetchone()[0]

        return {
            "db_path": self.db_path,
            "base_cavemem": {
                "observations": base_obs,
                "sessions": base_sessions,
                "summaries": base_summaries
            },
            "strategic_tables": {
                "adrs": adrs_count,
                "grill_me_logs": grill_count,
                "git_semantic_digests": git_count,
                "strategic_embeddings": strat_embeds
            },
            "embedding_model": EMBEDDING_MODEL_NAME,
            "onnx_model_path": DEFAULT_MODEL_PATH,
            "onnx_model_exists": os.path.exists(DEFAULT_MODEL_PATH)
        }


# ----------------- CLI HANDLERS -----------------

def format_timestamp(ts_ms: int) -> str:
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(ts_ms / 1000 if ts_ms > 1e11 else ts_ms))


def main():
    parser = argparse.ArgumentParser(description="Cavemem Strategic Memory Extension CLI")
    parser.add_argument("--db", default=DEFAULT_DB_PATH, help=f"Path to data.db (default: {DEFAULT_DB_PATH})")
    parser.add_argument("--json", action="store_true", help="Output results in JSON format")

    subparsers = parser.add_subparsers(dest="command", required=True)

    # status
    subparsers.add_parser("status", help="Show cavemem and strategic memory status")

    # init
    subparsers.add_parser("init", help="Initialize or verify strategic schema and FTS5 tables")

    # backfill
    subparsers.add_parser("backfill", help="Generate missing embeddings for all strategic entities")

    # unified search
    search_parser = subparsers.add_parser("search", help="Unified search across ADRs, Grill logs, and Git digests")
    search_parser.add_argument("query", help="Search query string")
    search_parser.add_argument("--semantic", action="store_true", help="Use semantic vector similarity via ONNX")
    search_parser.add_argument("--limit", type=int, default=5, help="Max results per entity type")

    # ADR commands
    adr_parser = subparsers.add_parser("adr", help="Manage Architectural Decision Records (ADRs)")
    adr_subs = adr_parser.add_subparsers(dest="subaction", required=True)

    adr_rec = adr_subs.add_parser("record", help="Record a new ADR")
    adr_rec.add_argument("--project", required=True, help="Project name / identifier")
    adr_rec.add_argument("--title", required=True, help="ADR Title")
    adr_rec.add_argument("--context", required=True, help="Problem context and background")
    adr_rec.add_argument("--decision", required=True, help="The architectural decision made")
    adr_rec.add_argument("--rationale", required=True, help="Rationale justifying the decision")
    adr_rec.add_argument("--trade-offs", default="", help="Trade-offs, consequences, and alternatives considered")
    adr_rec.add_argument("--status", default="accepted", help="Status (e.g. proposed, accepted, deprecated)")
    adr_rec.add_argument("--tags", default="", help="Comma-separated tags")
    adr_rec.add_argument("--no-embed", action="store_true", help="Skip generating ONNX embedding")

    adr_get = adr_subs.add_parser("get", help="Get ADR by ID")
    adr_get.add_argument("id", type=int, help="ADR ID")

    adr_list = adr_subs.add_parser("list", help="List / query ADRs")
    adr_list.add_argument("--project", help="Filter by project")
    adr_list.add_argument("--status", help="Filter by status")
    adr_list.add_argument("--tag", help="Filter by tag substring")
    adr_list.add_argument("--keyword", help="FTS5 full-text keyword search")
    adr_list.add_argument("--semantic", help="Semantic vector similarity search via ONNX")
    adr_list.add_argument("--limit", type=int, default=10, help="Max results")

    # Grill-Me commands
    grill_parser = subparsers.add_parser("grill", help="Manage Grill-Me / Interview Logs")
    grill_subs = grill_parser.add_subparsers(dest="subaction", required=True)

    grill_rec = grill_subs.add_parser("record", help="Record a new Grill-Me log")
    grill_rec.add_argument("--project", required=True, help="Project name")
    grill_rec.add_argument("--topic", required=True, help="Interview topic")
    grill_rec.add_argument("--questions", required=True, help="Questions probed")
    grill_rec.add_argument("--answers", required=True, help="User/Agent responses")
    grill_rec.add_argument("--key-takeaways", required=True, help="Key takeaways")
    grill_rec.add_argument("--resolved-direction", required=True, help="Agreed direction and next actions")
    grill_rec.add_argument("--no-embed", action="store_true", help="Skip generating ONNX embedding")

    grill_get = grill_subs.add_parser("get", help="Get Grill-Me log by ID")
    grill_get.add_argument("id", type=int, help="Log ID")

    grill_list = grill_subs.add_parser("list", help="List / query Grill-Me logs")
    grill_list.add_argument("--project", help="Filter by project")
    grill_list.add_argument("--keyword", help="FTS5 full-text keyword search")
    grill_list.add_argument("--semantic", help="Semantic vector similarity search via ONNX")
    grill_list.add_argument("--limit", type=int, default=10, help="Max results")

    # Git Semantic Digest commands
    git_parser = subparsers.add_parser("git", help="Manage Git Semantic Digests")
    git_subs = git_parser.add_subparsers(dest="subaction", required=True)

    git_rec = git_subs.add_parser("record", help="Record a git commit digest")
    git_rec.add_argument("--project", required=True, help="Project name")
    git_rec.add_argument("--commit-hash", required=True, help="Git commit hash")
    git_rec.add_argument("--branch", required=True, help="Git branch")
    git_rec.add_argument("--summary", required=True, help="Semantic summary of changes")
    git_rec.add_argument("--files-changed", required=True, help="Files changed (comma-separated or list)")
    git_rec.add_argument("--rationale", required=True, help="Why this change was made")
    git_rec.add_argument("--no-embed", action="store_true", help="Skip generating ONNX embedding")

    git_get = git_subs.add_parser("get", help="Get Git Digest by ID")
    git_get.add_argument("id", type=int, help="Digest ID")

    git_list = git_subs.add_parser("list", help="List / query Git Digests")
    git_list.add_argument("--project", help="Filter by project")
    git_list.add_argument("--branch", help="Filter by branch")
    git_list.add_argument("--commit-hash", help="Filter by commit hash prefix")
    git_list.add_argument("--keyword", help="FTS5 full-text keyword search")
    git_list.add_argument("--semantic", help="Semantic vector similarity search via ONNX")
    git_list.add_argument("--limit", type=int, default=10, help="Max results")

    args = parser.parse_args()

    db = StrategicMemoryDB(db_path=args.db)

    if args.command == "status":
        status = db.get_status()
        if args.json:
            print(json.dumps(status, indent=2))
        else:
            print("========================================")
            print(" Cavemem Strategic Memory Status")
            print("========================================")
            print(f"Database: {status['db_path']}")
            print(f"Base Cavemem:")
            print(f"  • Observations: {status['base_cavemem']['observations']}")
            print(f"  • Sessions:     {status['base_cavemem']['sessions']}")
            print(f"  • Summaries:    {status['base_cavemem']['summaries']}")
            print(f"Strategic Extensions:")
            print(f"  • ADRs:                 {status['strategic_tables']['adrs']}")
            print(f"  • Grill-Me Logs:        {status['strategic_tables']['grill_me_logs']}")
            print(f"  • Git Semantic Digests: {status['strategic_tables']['git_semantic_digests']}")
            print(f"  • Strategic Embeddings: {status['strategic_tables']['strategic_embeddings']}")
            print(f"Local ONNX Model:")
            print(f"  • Model:  {status['embedding_model']}")
            print(f"  • Exists: {'✓ Yes' if status['onnx_model_exists'] else '✗ No'}")
            print("========================================")

    elif args.command == "init":
        db.init_schema()
        status = db.get_status()
        if args.json:
            print(json.dumps({"initialized": True, "status": status}, indent=2))
        else:
            print("✓ Strategic memory schemas, triggers, and FTS5 tables initialized successfully!")

    elif args.command == "backfill":
        counts = db.backfill_embeddings()
        if args.json:
            print(json.dumps({"backfilled": counts}, indent=2))
        else:
            print(f"✓ Backfilled embeddings: {counts['adr']} ADRs, {counts['grill_me']} Grill logs, {counts['git_digest']} Git digests.")

    elif args.command == "search":
        mode = "semantic" if args.semantic else "keyword"
        res = db.unified_search(args.query, mode=mode, limit=args.limit)
        if args.json:
            print(json.dumps(res, indent=2))
        else:
            print(f"\nUnified Search ({mode}): '{args.query}'")
            print("-" * 50)
            print(f"ADRs ({len(res['adrs'])}):")
            for a in res["adrs"]:
                sim_str = f" [score: {a.get('similarity') or a.get('rank_score')}]" if ('similarity' in a or 'rank_score' in a) else ""
                print(f"  • [#{a['id']}] {a['title']} ({a['project']}) - status: {a['status']}{sim_str}")

            print(f"\nGrill-Me Logs ({len(res['grill_me_logs'])}):")
            for g in res["grill_me_logs"]:
                sim_str = f" [score: {g.get('similarity') or g.get('rank_score')}]" if ('similarity' in g or 'rank_score' in g) else ""
                print(f"  • [#{g['id']}] {g['topic']} ({g['project']}) -> {g['resolved_direction'][:60]}...{sim_str}")

            print(f"\nGit Semantic Digests ({len(res['git_semantic_digests'])}):")
            for d in res["git_semantic_digests"]:
                sim_str = f" [score: {d.get('similarity') or d.get('rank_score')}]" if ('similarity' in d or 'rank_score' in d) else ""
                print(f"  • [#{d['id']}] [{d['commit_hash'][:8]}] {d['summary'][:60]} ({d['project']}/{d['branch']}){sim_str}")

    elif args.command == "adr":
        if args.subaction == "record":
            adr_id = db.record_adr(
                project=args.project,
                title=args.title,
                context=args.context,
                decision=args.decision,
                rationale=args.rationale,
                trade_offs=args.trade_offs,
                status=args.status,
                tags=args.tags,
                embed=not args.no_embed
            )
            if args.json:
                print(json.dumps({"id": adr_id, "status": "recorded"}))
            else:
                print(f"✓ Recorded ADR #{adr_id}: '{args.title}' (embedded: {not args.no_embed})")

        elif args.subaction == "get":
            adr = db.get_adr(args.id)
            if not adr:
                print(f"ADR #{args.id} not found.", file=sys.stderr)
                sys.exit(1)
            if args.json:
                print(json.dumps(adr, indent=2))
            else:
                print(f"==================================================")
                print(f" ADR #{adr['id']}: {adr['title']}")
                print(f"==================================================")
                print(f"Project:     {adr['project']}")
                print(f"Status:      {adr['status']}")
                print(f"Timestamp:   {format_timestamp(adr['timestamp'])}")
                print(f"Tags:        {adr['tags']}")
                print(f"\nContext:\n{adr['context']}")
                print(f"\nDecision:\n{adr['decision']}")
                print(f"\nRationale:\n{adr['rationale']}")
                if adr['trade_offs']:
                    print(f"\nTrade-offs:\n{adr['trade_offs']}")
                print(f"==================================================")

        elif args.subaction == "list":
            rows = db.query_adrs(
                project=args.project,
                status=args.status,
                tag=args.tag,
                keyword=args.keyword,
                semantic=args.semantic,
                limit=args.limit
            )
            if args.json:
                print(json.dumps(rows, indent=2))
            else:
                print(f"Found {len(rows)} ADR(s):")
                for r in rows:
                    sim = f" (similarity: {r['similarity']})" if 'similarity' in r else ""
                    print(f"  • [#{r['id']}] [{r['status'].upper()}] {r['title']} ({r['project']}) {sim}")

    elif args.command == "grill":
        if args.subaction == "record":
            gid = db.record_grill(
                project=args.project,
                topic=args.topic,
                questions=args.questions,
                answers=args.answers,
                key_takeaways=args.key_takeaways,
                resolved_direction=args.resolved_direction,
                embed=not args.no_embed
            )
            if args.json:
                print(json.dumps({"id": gid, "status": "recorded"}))
            else:
                print(f"✓ Recorded Grill-Me Log #{gid}: '{args.topic}' (embedded: {not args.no_embed})")

        elif args.subaction == "get":
            g = db.get_grill(args.id)
            if not g:
                print(f"Grill-Me Log #{args.id} not found.", file=sys.stderr)
                sys.exit(1)
            if args.json:
                print(json.dumps(g, indent=2))
            else:
                print(f"==================================================")
                print(f" Grill-Me Log #{g['id']}: {g['topic']}")
                print(f"==================================================")
                print(f"Project:            {g['project']}")
                print(f"Timestamp:          {format_timestamp(g['timestamp'])}")
                print(f"\nQuestions:\n{g['questions']}")
                print(f"\nAnswers:\n{g['answers']}")
                print(f"\nKey Takeaways:\n{g['key_takeaways']}")
                print(f"\nResolved Direction:\n{g['resolved_direction']}")
                print(f"==================================================")

        elif args.subaction == "list":
            rows = db.query_grills(
                project=args.project,
                keyword=args.keyword,
                semantic=args.semantic,
                limit=args.limit
            )
            if args.json:
                print(json.dumps(rows, indent=2))
            else:
                print(f"Found {len(rows)} Grill-Me Log(s):")
                for r in rows:
                    sim = f" (similarity: {r['similarity']})" if 'similarity' in r else ""
                    print(f"  • [#{r['id']}] {r['topic']} ({r['project']}) -> {r['resolved_direction'][:60]}... {sim}")

    elif args.command == "git":
        if args.subaction == "record":
            did = db.record_git_digest(
                project=args.project,
                commit_hash=args.commit_hash,
                branch=args.branch,
                summary=args.summary,
                files_changed=args.files_changed,
                rationale=args.rationale,
                embed=not args.no_embed
            )
            if args.json:
                print(json.dumps({"id": did, "status": "recorded"}))
            else:
                print(f"✓ Recorded Git Digest #{did}: [{args.commit_hash[:8]}] '{args.summary}' (embedded: {not args.no_embed})")

        elif args.subaction == "get":
            d = db.get_git_digest(args.id)
            if not d:
                print(f"Git Digest #{args.id} not found.", file=sys.stderr)
                sys.exit(1)
            if args.json:
                print(json.dumps(d, indent=2))
            else:
                print(f"==================================================")
                print(f" Git Digest #{d['id']}: [{d['commit_hash']}] on {d['branch']}")
                print(f"==================================================")
                print(f"Project:       {d['project']}")
                print(f"Timestamp:     {format_timestamp(d['timestamp'])}")
                print(f"Files Changed: {d['files_changed']}")
                print(f"\nSummary:\n{d['summary']}")
                print(f"\nRationale:\n{d['rationale']}")
                print(f"==================================================")

        elif args.subaction == "list":
            rows = db.query_git_digests(
                project=args.project,
                branch=args.branch,
                commit_hash=args.commit_hash,
                keyword=args.keyword,
                semantic=args.semantic,
                limit=args.limit
            )
            if args.json:
                print(json.dumps(rows, indent=2))
            else:
                print(f"Found {len(rows)} Git Digest(s):")
                for r in rows:
                    sim = f" (similarity: {r['similarity']})" if 'similarity' in r else ""
                    print(f"  • [#{r['id']}] [{r['commit_hash'][:8]}] {r['summary']} ({r['project']}/{r['branch']}) {sim}")


if __name__ == "__main__":
    main()
