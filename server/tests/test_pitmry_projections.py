"""Phase 2 projection, capture, and cache publication coverage."""

import json
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_DIR))

from server.pitmry.canonical_store import CanonicalStore
from server.pitmry.embeddings import EmbeddingUnavailable, LocalEmbedder
from server.pitmry.rebuild import rebuild
from server.pitmry.capture import capture_session_summary
from server.pitmry.sqlite_projection import initialize, integrity_check, project_record
from server.pitmry.vector_projection import build_embedding_text
from server.tests.test_canonical_store_helpers import make_decision


class ProjectionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.store = CanonicalStore(self.root)
        self.store.init_project(name="projection-test")
        self.record = make_decision(project_id=self.store.project_id)
        self.store.write(self.record)
        self.record = self.store.get(self.record.id)

    def test_projection_is_idempotent_and_creates_fts_row(self):
        db = self.root / "test.db"
        conn = initialize(db)
        try:
            self.assertTrue(project_record(conn, self.record))
            self.assertFalse(project_record(conn, self.record))
            conn.commit()
            self.assertEqual(conn.execute("select count(*) from records").fetchone()[0], 1)
            self.assertEqual(conn.execute("select count(*) from records_fts").fetchone()[0], 1)
            rows = conn.execute("select id from records_fts where records_fts match ?",
                                ('"Sanity"',)).fetchall()
            self.assertEqual([row[0] for row in rows], [self.record.id])
            integrity_check(conn)
        finally:
            conn.close()

    def test_embedding_text_is_deterministic_and_not_raw_json(self):
        self.assertEqual(build_embedding_text(self.record), build_embedding_text(self.record))
        self.assertIn("Decision:", build_embedding_text(self.record))
        self.assertNotIn("content_hash", build_embedding_text(self.record))

    def test_capture_retry_is_idempotent_with_a_stable_source_id(self):
        first = capture_session_summary(self.store, "Phase 2", "Implemented projections",
                                        source_id="session:test-retry")
        second = capture_session_summary(self.store, "Phase 2", "Implemented projections",
                                         source_id="session:test-retry")
        self.assertEqual(first.id, second.id)
        self.assertEqual(len(self.store.all_ids()), 2)

    def test_missing_model_fails_without_a_synthetic_vector(self):
        embedder = LocalEmbedder(model_path=self.root / "missing.onnx",
                                 tokenizer_path=self.root / "missing.json")
        with self.assertRaises(EmbeddingUnavailable):
            embedder.embed("test phrase")

    def test_missing_model_still_publishes_a_healthy_lexical_projection(self):
        embedder = LocalEmbedder(model_path=self.root / "missing.onnx",
                                 tokenizer_path=self.root / "missing.json")
        result = rebuild(self.root, embedder=embedder)
        self.assertEqual(result["records"], 1)
        self.assertTrue(any(message.startswith("VECTOR_RETRIEVAL_UNAVAILABLE")
                            for message in result["warnings"]))
        conn = sqlite3.connect(result["sqlite"])
        try:
            self.assertEqual(conn.execute("select count(*) from records").fetchone()[0], 1)
            self.assertEqual(conn.execute("select count(*) from records_fts").fetchone()[0], 1)
            self.assertEqual(conn.execute("pragma integrity_check").fetchone()[0], "ok")
        finally:
            conn.close()

    def test_legacy_modules_use_the_single_shared_embedder(self):
        from server import cavemem_strategic, lancedb_strategic
        self.assertIs(cavemem_strategic.LocalEmbedder, LocalEmbedder)
        self.assertIs(lancedb_strategic.LocalEmbedder, LocalEmbedder)

    def test_no_vector_rebuild_survives_cache_deletion(self):
        first = rebuild(self.root, no_vectors=True)
        first_conn = sqlite3.connect(first["sqlite"])
        try:
            first_ids = [row[0] for row in first_conn.execute("select id from records order by id")]
        finally:
            first_conn.close()
        self.assertIn("VECTOR_RETRIEVAL_SKIPPED", first["warnings"])
        shutil.rmtree(self.root / ".pitmry-cache")
        second = rebuild(self.root, no_vectors=True)
        second_conn = sqlite3.connect(second["sqlite"])
        try:
            second_ids = [row[0] for row in second_conn.execute("select id from records order by id")]
        finally:
            second_conn.close()
        self.assertEqual(first_ids, second_ids)
        pointer = json.loads(self.store.paths.active_pointer.read_text(encoding="utf-8"))
        self.assertEqual(pointer["generation"], second["generation"])

    def test_invalid_canonical_data_does_not_replace_active_generation(self):
        active = rebuild(self.root, no_vectors=True)
        pointer_before = self.store.paths.active_pointer.read_bytes()
        invalid = self.root / ".pitmry" / "records" / "2026" / "09" / ("dec_" + "a" * 24 + ".json")
        invalid.parent.mkdir(parents=True, exist_ok=True)
        invalid.write_text('{"schema_version": 1}', encoding="utf-8")
        with self.assertRaises(ValueError):
            rebuild(self.root, no_vectors=True)
        self.assertEqual(self.store.paths.active_pointer.read_bytes(), pointer_before)
        self.assertEqual(self.store.paths.active_generation.name, active["generation"])


class GitCaptureTests(unittest.TestCase):
    def test_git_capture_keeps_full_sha_and_objective_fields(self):
        from server.pitmry.capture import capture_git_change

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            subprocess.run(["git", "-C", str(root), "init", "-q"], check=True)
            subprocess.run(["git", "-C", str(root), "config", "user.name", "Test"], check=True)
            subprocess.run(["git", "-C", str(root), "config", "user.email", "test@example.invalid"], check=True)
            (root / "sample.txt").write_text("phase two\n", encoding="utf-8")
            subprocess.run(["git", "-C", str(root), "add", "sample.txt"], check=True)
            subprocess.run(["git", "-C", str(root), "commit", "-q", "-m", "capture fixture"], check=True)
            store = CanonicalStore(root)
            store.init_project(name="git-test")
            record, edge = capture_git_change(store, "HEAD", root=root)
            self.assertIsNone(edge)
            self.assertEqual(len(record.content["commit_sha"]), 40)
            self.assertEqual(record.provenance.source_id, record.content["commit_sha"])
            self.assertIn("sample.txt", record.content["changed_files"])
            self.assertIn("patch_id", record.content)


if __name__ == "__main__":
    unittest.main()
