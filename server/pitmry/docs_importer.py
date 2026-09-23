"""Import explicit Markdown paths as unverified notes, never as decisions."""

from __future__ import annotations

import hashlib
from pathlib import Path

from .capture import _record
from .enums import Authority, RecordType, TruthDomain


def import_markdown(store, docs_root, paths, dry_run=False):
    docs_root = Path(docs_root).resolve()
    selected = []
    for item in paths:
        path = Path(item).resolve()
        try:
            relative = path.relative_to(docs_root)
        except ValueError as exc:
            raise ValueError(f"document is outside docs root: {path}") from exc
        if path.suffix.lower() not in {".md", ".markdown"} or not path.is_file():
            raise ValueError(f"not a Markdown file: {path}")
        text = path.read_text(encoding="utf-8")
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
        title = next((line.lstrip("# ").strip() for line in text.splitlines()
                      if line.startswith("#") and line.lstrip("# ").strip()), relative.stem)
        selected.append((relative.as_posix(), digest, title, text))
    if dry_run:
        return {"dry_run": True, "count": len(selected),
                "documents": [item[0] for item in selected]}
    records = []
    for relative, digest, title, text in selected:
        records.append(_record(store, RecordType.note, "markdown_document",
                               f"{relative}:{digest}", title, text[:500].strip() or title,
                               {"document": text, "relative_path": relative,
                                "source_sha256": digest}, Authority.imported_unverified,
                               TruthDomain.history,
                               created_at="2000-01-01T00:00:00+00:00",
                               tags=("imported-document",)))
    return {"dry_run": False, "count": len(records), "ids": [item.id for item in records]}
