"""Tests for the Cavemem embedding worker watchdog.

These tests cover the pure decision logic and never spawn the real worker, so
they stay fast and safe in CI.
"""

import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_DIR / "scripts"))

import ensure_worker as watchdog  # noqa: E402


class HeartbeatTests(unittest.TestCase):
    def test_missing_state_has_no_age(self):
        self.assertIsNone(watchdog.heartbeat_age_ms(None))
        self.assertIsNone(watchdog.heartbeat_age_ms({}))

    def test_age_uses_heartbeat_then_last_batch(self):
        now = 1_000_000
        self.assertEqual(
            watchdog.heartbeat_age_ms({"heartbeatAt": now - 5_000}, now), 5_000)
        self.assertEqual(
            watchdog.heartbeat_age_ms({"lastBatchAt": now - 7_000}, now), 7_000)

    def test_never_returns_a_negative_age(self):
        self.assertEqual(
            watchdog.heartbeat_age_ms({"heartbeatAt": 2_000_000}, 1_000_000), 0)

    def test_garbage_values_are_ignored(self):
        for value in ("", "abc", None, 0):
            self.assertIsNone(watchdog.heartbeat_age_ms({"heartbeatAt": value}))


class CooldownTests(unittest.TestCase):
    def test_no_history_allows_a_start(self):
        self.assertTrue(watchdog.can_attempt_start(None))

    def test_recent_attempt_is_suppressed(self):
        now = 1_000_000
        self.assertFalse(
            watchdog.can_attempt_start({"lastAttemptAt": now - 1_000}, now=now))

    def test_expired_attempt_is_allowed_again(self):
        now = 1_000_000
        self.assertTrue(
            watchdog.can_attempt_start({"lastAttemptAt": now - 600_000}, now=now))

    def test_corrupt_history_does_not_block_startup(self):
        self.assertTrue(watchdog.can_attempt_start({"lastAttemptAt": "yesterday"}))


class UnembeddedCountTests(unittest.TestCase):
    def _make_db(self, folder: Path, with_embedding: bool) -> Path:
        db_path = folder / "data.db"
        conn = sqlite3.connect(db_path)
        conn.executescript("""
            CREATE TABLE observations (id INTEGER PRIMARY KEY, content TEXT);
            CREATE TABLE embeddings (observation_id INTEGER PRIMARY KEY, vec BLOB);
            INSERT INTO observations (id, content) VALUES (1, 'a'), (2, 'b');
        """)
        if with_embedding:
            conn.execute("INSERT INTO embeddings VALUES (1, x'00')")
        conn.commit()
        conn.close()
        return db_path

    def test_counts_observations_without_embeddings(self):
        with tempfile.TemporaryDirectory() as folder:
            db_path = self._make_db(Path(folder), with_embedding=True)
            self.assertEqual(watchdog.unembedded_observations(str(db_path)), 1)

    def test_reports_zero_when_fully_embedded(self):
        with tempfile.TemporaryDirectory() as folder:
            db_path = self._make_db(Path(folder), with_embedding=False)
            self.assertEqual(watchdog.unembedded_observations(str(db_path)), 2)

    def test_missing_database_is_unknown_not_zero(self):
        self.assertIsNone(watchdog.unembedded_observations("/nope/missing.db"))


class CheckReportTests(unittest.TestCase):
    def _write(self, folder: Path, state: dict, settings: dict) -> None:
        (folder / "worker.state.json").write_text(json.dumps(state), encoding="utf-8")
        (folder / "settings.json").write_text(json.dumps(settings), encoding="utf-8")

    def test_stale_heartbeat_is_degraded_with_a_reason(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            state = {"heartbeatAt": watchdog.now_ms() - 3_600_000, "lastError": None}
            self._write(root, state, {"dataDir": str(root), "embedding": {"autoStart": True}})
            report = watchdog.check(str(root), str(root / "settings.json"),
                                    str(root / "data.db"))
            self.assertFalse(report["healthy"])
            self.assertTrue(any("stale" in reason for reason in report["unhealthy_reasons"]))
            self.assertTrue(report["auto_start_enabled"])

    def test_fresh_heartbeat_is_healthy(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            state = {"heartbeatAt": watchdog.now_ms() - 1_000, "embedded": 5, "total": 5}
            self._write(root, state, {"dataDir": str(root), "embedding": {"autoStart": True}})
            report = watchdog.check(str(root), str(root / "settings.json"),
                                    str(root / "data.db"))
            self.assertTrue(report["healthy"])
            self.assertEqual(report["embedded"], 5)

    def test_last_error_is_surfaced_even_when_the_heartbeat_is_fresh(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            state = {"heartbeatAt": watchdog.now_ms() - 1_000, "lastError": "onnx oom"}
            self._write(root, state, {"dataDir": str(root)})
            report = watchdog.check(str(root), str(root / "settings.json"),
                                    str(root / "data.db"))
            self.assertFalse(report["healthy"])
            self.assertTrue(any("onnx oom" in reason for reason in report["unhealthy_reasons"]))

    def test_missing_state_file_is_reported_not_crashed(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "settings.json").write_text("{}", encoding="utf-8")
            report = watchdog.check(str(root), str(root / "settings.json"),
                                    str(root / "data.db"))
            self.assertFalse(report["healthy"])
            self.assertIn("worker.state.json missing", report["unhealthy_reasons"])

    def test_ensure_respects_autostart_false(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            state = {"heartbeatAt": watchdog.now_ms() - 3_600_000}
            self._write(root, state, {"dataDir": str(root), "embedding": {"autoStart": False}})
            report = watchdog.ensure(str(root), settings_path=str(root / "settings.json"),
                                     db_path=str(root / "data.db"), allow_start=False)
            self.assertEqual(report["action"], "skipped")


if __name__ == "__main__":
    unittest.main()
