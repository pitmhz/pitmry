"""Explicit Markdown import stores passive, unverified notes."""

import tempfile
import unittest
from pathlib import Path

from server.pitmry.canonical_store import CanonicalStore
from server.pitmry.docs_importer import import_markdown


class MarkdownImportTests(unittest.TestCase):
    def test_markdown_import_is_idempotent_and_never_creates_decisions(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            docs = root / "docs"
            docs.mkdir()
            (docs / "architecture.md").write_text("# Architecture\nUse the documented store.\n", encoding="utf-8")
            store = CanonicalStore(root)
            store.init_project(name="docs-import-test")
            first = import_markdown(store, docs, [docs / "architecture.md"])
            second = import_markdown(store, docs, [docs / "architecture.md"])
            self.assertEqual(first["ids"], second["ids"])
            records = store.load_all()
            self.assertEqual(len(records), 1)
            self.assertEqual(records[0].type.value, "note")
            self.assertEqual(records[0].authority.value, "imported_unverified")

    def test_markdown_import_rejects_paths_outside_selected_root(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            docs = root / "docs"
            docs.mkdir()
            other = root / "outside.md"
            other.write_text("# Outside", encoding="utf-8")
            store = CanonicalStore(root)
            store.init_project(name="docs-import-test")
            with self.assertRaisesRegex(ValueError, "outside docs root"):
                import_markdown(store, docs, [other])


if __name__ == "__main__":
    unittest.main()
