#!/usr/bin/env python3
"""Import selected Markdown files as unverified PITMRY notes."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from server.pitmry.canonical_store import CanonicalStore
from server.pitmry.docs_importer import import_markdown
from server.pitmry.rebuild import rebuild


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="+", help="Markdown files relative to --docs-root")
    parser.add_argument("--root", default=None, help="initialized PITMRY project root")
    parser.add_argument("--docs-root", required=True, help="root that contains selected docs")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-vectors", action="store_true")
    args = parser.parse_args(argv)
    root = Path(args.root or Path.cwd()).resolve()
    try:
        store = CanonicalStore(root)
        if not args.dry_run:
            store.require_manifest()
        result = import_markdown(store, args.docs_root,
                                 [Path(args.docs_root) / item for item in args.files],
                                 dry_run=args.dry_run)
        if not args.dry_run:
            result["projection"] = rebuild(root, no_vectors=args.no_vectors)
    except (ValueError, OSError, RuntimeError) as exc:
        print(f"document import failed: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
