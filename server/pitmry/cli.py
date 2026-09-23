"""PITMRY command line.

    python -m server.pitmry init [--root PATH] [--name NAME]
    python -m server.pitmry validate [--root PATH] [--json]
    python -m server.pitmry get <record-id> [--root PATH] [--json]
    python -m server.pitmry rebuild [--root PATH] [--no-vectors]
    python -m server.pitmry migrate-legacy --db PATH [--dry-run] [--root PATH]

`validate` exits 1 when any canonical record is malformed, and prints the path
plus the reason for each problem. `get` exits 1 when the record is absent.
"""

from __future__ import annotations

import argparse
import json
import sys

from .canonical_store import CanonicalStore
from .migration import migrate_legacy
from .rebuild import rebuild


def _make_store(args) -> CanonicalStore:
    root = getattr(args, "root", None)
    return CanonicalStore(root)


def cmd_init(args) -> int:
    store = _make_store(args)
    try:
        manifest = store.init_project(name=args.name)
    except ValueError as exc:
        print(f"init failed: {exc}", file=sys.stderr)
        return 1
    if args.json:
        print(json.dumps(manifest, indent=2))
        return 0

    root = store.paths.root
    print(f"project     : {manifest['name']}")
    print(f"project_id  : {manifest['project_id']}")
    print(f"schema      : v{manifest['schema_version']}")
    print(f"canonical   : {root / '.pitmry'}")
    print(f"records     : {root / '.pitmry' / 'records'}")
    print()
    print("Add `.pitmry/` to Git and add `.pitmry-cache/` to .gitignore.")
    return 0


def cmd_validate(args) -> int:
    store = _make_store(args)
    try:
        manifest = store.read_manifest()
    except ValueError:
        manifest = {}
    if manifest is None:
        print(
            f"{store.paths.manifest_path} not found. "
            "Run `python -m server.pitmry init` first.",
            file=sys.stderr,
        )
        return 2

    problems = store.validate_all()

    if args.json:
        print(json.dumps({"valid": not problems, "problems": problems}, indent=2))
    elif problems:
        print(f"Found {len(problems)} problem(s) in the canonical store:\n")
        for problem in problems:
            print(f"  ! {problem}")
    else:
        count = len(store.all_ids())
        print(f"Canonical store is valid. {count} record(s) checked.")
    return 1 if problems else 0


def cmd_get(args) -> int:
    store = _make_store(args)
    try:
        manifest = store.read_manifest()
    except ValueError as exc:
        print(f"invalid PITMRY manifest: {exc}", file=sys.stderr)
        return 2
    if manifest is None:
        print(
            f"{store.paths.manifest_path} not found. "
            "Run `python -m server.pitmry init` first.",
            file=sys.stderr,
        )
        return 2
    try:
        record = store.get(args.record_id)
    except ValueError as exc:
        print(f"invalid record id or canonical record: {exc}", file=sys.stderr)
        return 1
    if record is None:
        print(f"record '{args.record_id}' not found in the canonical store",
              file=sys.stderr)
        return 1

    if args.json:
        from .models import record_to_dict

        print(json.dumps(record_to_dict(record), indent=2))
        return 0

    from .models import record_to_dict

    payload = record_to_dict(record)
    print(f"id           : {payload['id']}")
    print(f"type         : {payload['type']}")
    print(f"project      : {payload['project_id']}")
    print(f"created_at   : {payload['created_at']}")
    if "authority" in payload:
        print(f"title        : {payload['title']}")
        print(f"authority    : {payload['authority']}")
        print(f"truth domain : {payload['truth_domain']}")
        print(f"summary      : {payload['summary']}")
    if "relation" in payload:
        print(f"relation     : {payload['relation']} ({payload['provenance']})")
        print(f"source       : {payload['source_record_id']}")
        print(f"target       : {payload['target_record_id']}")
        print(f"evidence     : {json.dumps(payload.get('evidence_refs', []), ensure_ascii=False)}")
    print(f"content hash : {payload.get('content_hash', '')}")
    return 0


def cmd_rebuild(args) -> int:
    try:
        result = rebuild(root=args.root, no_vectors=args.no_vectors)
    except (ValueError, OSError, RuntimeError) as exc:
        print(f"rebuild failed: {exc}", file=sys.stderr)
        return 1
    print(json.dumps({key: str(value) if hasattr(value, "__fspath__") else value
                      for key, value in result.items()}, indent=2))
    return 0


def cmd_migrate_legacy(args) -> int:
    try:
        result = migrate_legacy(args.db, root=args.root, dry_run=args.dry_run)
    except (ValueError, OSError, RuntimeError) as exc:
        print(f"legacy migration failed: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    # Shared options. `parents=` is what makes `--root` and `--json` valid on
    # every subcommand, because a global option is only parsed *before* the
    # subcommand. An agent that writes `pitmry get X --json` must not fail.
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--root", default=None,
                        help="project root (default: walk up for .pitmry/manifest.json)")
    common.add_argument("--json", action="store_true", help="machine-readable output")

    parser = argparse.ArgumentParser(
        prog="pitmry",
        description="PITMRY canonical memory engine",
        parents=[common],
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    p_init = subparsers.add_parser("init", parents=[common],
                                   help="initialize canonical memory")
    p_init.add_argument("--name", default=None,
                        help="project name (default: directory name)")
    p_init.set_defaults(func=cmd_init)

    p_validate = subparsers.add_parser("validate", parents=[common],
                                       help="validate every canonical record")
    p_validate.set_defaults(func=cmd_validate)

    p_get = subparsers.add_parser("get", parents=[common],
                                  help="read one canonical record by id")
    p_get.add_argument("record_id")
    p_get.set_defaults(func=cmd_get)

    p_rebuild = subparsers.add_parser("rebuild", parents=[common],
                                      help="rebuild disposable projections")
    p_rebuild.add_argument("--no-vectors", action="store_true",
                           help="build SQLite and FTS only")
    p_rebuild.set_defaults(func=cmd_rebuild)

    p_migrate = subparsers.add_parser("migrate-legacy", parents=[common],
                                      help="import selected legacy Cavemem records")
    p_migrate.add_argument("--db", required=True, help="legacy Cavemem SQLite file")
    p_migrate.add_argument("--dry-run", action="store_true",
                            help="report selected legacy rows without writing canonical data")
    p_migrate.set_defaults(func=cmd_migrate_legacy)

    return parser


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
