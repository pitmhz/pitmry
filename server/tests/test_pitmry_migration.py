"""Legacy migration remains project-scoped, repeatable, and non-causal."""

import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVER_DIR))

from server.pitmry.canonical_store import CanonicalStore
from server.pitmry.migration import migrate_legacy


class LegacyMigrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.db = self.root / "legacy.db"
        conn = sqlite3.connect(self.db)
        conn.executescript("""
            CREATE TABLE adrs(id INTEGER PRIMARY KEY, project TEXT, title TEXT, context TEXT,
              decision TEXT, rationale TEXT, trade_offs TEXT, status TEXT, timestamp INTEGER,
              tags TEXT, metadata TEXT);
            CREATE TABLE grill_me_logs(id INTEGER PRIMARY KEY, project TEXT, topic TEXT,
              questions TEXT, answers TEXT, key_takeaways TEXT, resolved_direction TEXT,
              timestamp INTEGER, metadata TEXT);
            CREATE TABLE git_semantic_digests(id INTEGER PRIMARY KEY, project TEXT,
              commit_hash TEXT, branch TEXT, summary TEXT, files_changed TEXT, rationale TEXT,
              timestamp INTEGER, metadata TEXT);
            INSERT INTO adrs VALUES (1,'pitmry','Pitmry decision','context','decision','why','cost','accepted',1780000000,'a,b','{}');
            INSERT INTO adrs VALUES (2,'memory-dashboard','Dashboard decision','context','choice','reason','','accepted',1780000001,'x','{}');
            INSERT INTO adrs VALUES (3,'portfolio','Other project','c','d','r','','accepted',1780000002,'','{}');
            INSERT INTO grill_me_logs VALUES (1,'pitmry','Review','q','a','takeaway','direction',1780000010,'{}');
            INSERT INTO grill_me_logs VALUES (2,'memory-dashboard','Review 2','q','a','takeaway 2','',1780000011,'{}');
            INSERT INTO git_semantic_digests VALUES (1,'pitmry','abc1234','main','change','a.py','reason',1780000020,'{}');
            INSERT INTO git_semantic_digests VALUES (2,'memory-dashboard','deadbeef','main','change 2','b.py','reason 2',1780000021,'{}');
        """)
        conn.commit()
        conn.close()

    def test_dry_run_selects_only_approved_project_labels(self):
        result = migrate_legacy(self.db, root=self.root, dry_run=True)
        self.assertEqual(result["total"], 6)
        self.assertEqual(result["selected_projects"], ["pitmry", "memory-dashboard"])
        self.assertFalse((self.root / ".pitmry").exists())

    def test_repeat_migration_keeps_same_canonical_records_without_edges(self):
        store = CanonicalStore(self.root)
        store.init_project(name="migration-test")
        first = migrate_legacy(self.db, root=self.root)
        second = migrate_legacy(self.db, root=self.root)
        self.assertEqual(first["ids"], second["ids"])
        self.assertEqual(len(store.all_ids()), 6)
        records = store.load_all()
        self.assertEqual(sum(record.type.value == "relation" for record in records), 0)
        self.assertTrue(all(record.authority.value == "imported_unverified"
                            for record in records))
        self.assertFalse(any(record.provenance.source_id.startswith("adrs:portfolio:")
                             for record in records))


if __name__ == "__main__":
    unittest.main()
