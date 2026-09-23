"""PITMRY command line.

    python -m server.pitmry init [--root PATH] [--name NAME]
    python -m server.pitmry validate [--root PATH] [--json]
    python -m server.pitmry get <record-id> [--root PATH] [--json]
    python -m server.pitmry rebuild [--root PATH] [--no-vectors]
    python -m server.pitmry doctor [--root PATH]
    python -m server.pitmry migrate-legacy --db PATH [--dry-run] [--root PATH]
    python -m server.pitmry capture-git [--commit REF] [--decision ID]
    python -m server.pitmry decision --title TITLE --decision TEXT
    python -m server.pitmry supersede NEW_ID OLD_ID --evidence REF
    python -m server.pitmry link SOURCE_ID TARGET_ID --relation TYPE --evidence REF

`validate` exits 1 when any canonical record is malformed, and prints the path
plus the reason for each problem. `get` exits 1 when the record is absent.
"""

from __future__ import annotations

import argparse
import json
import sys

from .canonical_store import CanonicalStore
from .migration import PROJECT_LABELS, migrate_legacy
from .rebuild import rebuild
from .capture import (capture_decision, capture_git_change, capture_relation)
from .enums import Authority, EXPLICIT_RELATIONS, RecordType, RelationType


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
        result = migrate_legacy(args.db, root=args.root, dry_run=args.dry_run,
                                project_labels=args.project or PROJECT_LABELS)
    except (ValueError, OSError, RuntimeError) as exc:
        print(f"legacy migration failed: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2))
    return 0


def cmd_search(args) -> int:
    from .models import MemoryRecord
    from .relations import explicit_relations
    from .retrieval import retrieve
    from .state_resolver import resolve_states

    try:
        store = _make_store(args)
        result = retrieve(args.query, root=args.root, limit=args.limit,
                          include_vectors=not args.no_vectors)
        records = [item for item in store.load_all() if isinstance(item, MemoryRecord)]
        edges = explicit_relations(store.load_all())
        states = resolve_states(records, edges)
        payload = {
            "status": "AMBIGUOUS" if result["ambiguous"] else
                      "OK" if result["records"] and not result["warnings"] else
                      "DEGRADED" if result["records"] else "NO_MATCH",
            "query": args.query,
            "project_id": result["project_id"],
            "mode": result["mode"],
            "results": [{
                "id": record.id, "type": record.type.value,
                "title": record.title, "summary": record.summary,
                "state": states.get(record.id, "UNKNOWN"),
                **(result["signals"].get(record.id, {}) if args.explain else {}),
            } for record in result["records"]],
            "warnings": result["warnings"],
        }
    except (ValueError, OSError, RuntimeError) as exc:
        print(f"search failed: {exc}", file=sys.stderr)
        return 1
    if args.json:
        print(json.dumps(payload, indent=2, ensure_ascii=False))
    else:
        print(f"{payload['status']} ({payload['mode']}) — {len(payload['results'])} result(s)")
        for item in payload["results"]:
            print(f"{item['id']} [{item['state']}] {item['title']}")
            print(f"  {item['summary']}")
        for warning in payload["warnings"]:
            print(f"warning: {warning}")
    return 0


def cmd_context(args) -> int:
    from .context_service import context

    try:
        payload = context(args.query, root=args.root, max_records=args.limit,
                          character_budget=args.character_budget,
                          include_vectors=not args.no_vectors,
                          include_inferred=args.include_inferred)
    except (ValueError, OSError, RuntimeError) as exc:
        print(f"context failed: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    return 0


def cmd_lineage(args) -> int:
    from .context_service import lineage

    try:
        payload = lineage(args.record_id, root=args.root, max_hops=args.hops)
    except (ValueError, OSError, RuntimeError) as exc:
        print(f"lineage failed: {exc}", file=sys.stderr)
        return 1
    if args.json:
        print(json.dumps(payload, indent=2, ensure_ascii=False))
    else:
        for item in payload["nodes"]:
            print(f"{item['id']} [{item['state']}] {item['title']}")
        for edge in payload["relations"]:
            print(f"{edge['source_record_id']} -[{edge['relation']}]-> {edge['target_record_id']} [explicit]")
        if not payload["nodes"]:
            print(f"{payload['status']}: no canonical record for {args.record_id}")
    return 0


def cmd_doctor(args) -> int:
    from .doctor import doctor

    report = doctor(root=args.root)
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if report["status"] in ("healthy", "degraded") else 1


def cmd_diff(args) -> int:
    from .models import MemoryRecord

    store = _make_store(args)
    record = store.get(args.record_id)
    if not isinstance(record, MemoryRecord) or record.type is not RecordType.git_change:
        print(f"git change '{args.record_id}' not found", file=sys.stderr)
        return 1
    sha = record.content.get("commit_sha") or record.provenance.source_commit
    if not sha or len(sha) != 40:
        print("git change has no verified full commit SHA", file=sys.stderr)
        return 1
    import subprocess
    result = subprocess.run(["git", "-C", str(store.paths.root), "show", "--format=fuller", sha],
                            capture_output=True, text=True)
    if result.returncode:
        print(result.stderr.strip() or "git diff is unavailable", file=sys.stderr)
        return 1
    payload = {"record_id": record.id, "commit_sha": sha, "diff": result.stdout}
    print(json.dumps(payload, ensure_ascii=False) if args.json else result.stdout)
    return 0


def cmd_capture_git(args) -> int:
    store = _make_store(args)
    record, relation = capture_git_change(store, commit=args.commit, root=store.paths.root,
                                          decision_id=args.decision)
    payload = {"record": record.id, "relation": relation.id if relation else None}
    print(json.dumps(payload, indent=2))
    return 0


def cmd_decision(args) -> int:
    store = _make_store(args)
    authority = Authority.agent_reported
    # CLI input alone cannot claim human authority. Evidence is retained as
    # provenance but does not promote authority without a verified source.
    record = capture_decision(store, args.title, args.decision, context=args.context,
                              rationale=args.rationale, trade_offs=args.trade_offs,
                              authority=authority, tags=args.tag or (),
                              subject_key=args.subject_key)
    print(json.dumps({"id": record.id, "authority": record.authority.value}, indent=2))
    return 0


def cmd_link(args) -> int:
    store = _make_store(args)
    edge = capture_relation(store, args.source_id, args.target_id, args.relation,
                            tuple(args.evidence))
    print(json.dumps({"id": edge.id, "relation": edge.relation.value,
                      "provenance": edge.provenance.value}, indent=2))
    return 0


def cmd_supersede(args) -> int:
    return _capture_relation_command(args, RelationType.supersedes)


def _capture_relation_command(args, relation):
    store = _make_store(args)
    edge = capture_relation(store, args.new_id if hasattr(args, "new_id") else args.source_id,
                            args.old_id if hasattr(args, "old_id") else args.target_id,
                            relation, tuple(args.evidence))
    print(json.dumps({"id": edge.id, "relation": edge.relation.value}, indent=2))
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
    p_migrate.add_argument("--project", action="append", default=None,
                            help="legacy project label to migrate (repeatable)")
    p_migrate.set_defaults(func=cmd_migrate_legacy)

    p_search = subparsers.add_parser("search", parents=[common],
                                     help="rank canonical records with FTS and optional vectors")
    p_search.add_argument("query")
    p_search.add_argument("--limit", type=int, default=10)
    p_search.add_argument("--no-vectors", action="store_true")
    p_search.add_argument("--explain", action="store_true",
                          help="include lexical/vector ranks, RRF score, and reasons")
    p_search.set_defaults(func=cmd_search)

    p_context = subparsers.add_parser("context", parents=[common],
                                      help="build compact trust-aware agent context")
    p_context.add_argument("query")
    p_context.add_argument("--limit", type=int, default=8)
    p_context.add_argument("--character-budget", type=int, default=12000)
    p_context.add_argument("--no-vectors", action="store_true")
    p_context.add_argument("--include-inferred", action="store_true")
    p_context.set_defaults(func=cmd_context)

    p_lineage = subparsers.add_parser("lineage", parents=[common],
                                      help="show explicit canonical relations")
    p_lineage.add_argument("record_id")
    p_lineage.add_argument("--hops", type=int, default=2)
    p_lineage.set_defaults(func=cmd_lineage)

    p_doctor = subparsers.add_parser("doctor", parents=[common], help="inspect independent backend components")
    p_doctor.set_defaults(func=cmd_doctor)

    p_diff = subparsers.add_parser("diff", parents=[common], help="show a canonical Git change diff")
    p_diff.add_argument("record_id")
    p_diff.set_defaults(func=cmd_diff)

    p_capture = subparsers.add_parser("capture-git", parents=[common], help="capture a verified Git commit")
    p_capture.add_argument("--commit", default="HEAD")
    p_capture.add_argument("--decision", default=None, help="optional evidenced decision to link")
    p_capture.set_defaults(func=cmd_capture_git)

    p_decision = subparsers.add_parser("decision", parents=[common], help="capture an agent-reported decision")
    p_decision.add_argument("--title", required=True)
    p_decision.add_argument("--decision", required=True)
    p_decision.add_argument("--context", default="")
    p_decision.add_argument("--rationale", default="")
    p_decision.add_argument("--trade-offs", default="")
    p_decision.add_argument("--subject-key", default=None)
    p_decision.add_argument("--tag", action="append", default=[])
    p_decision.set_defaults(func=cmd_decision)

    p_link = subparsers.add_parser("link", parents=[common], help="create an evidence-backed explicit relation")
    p_link.add_argument("source_id")
    p_link.add_argument("target_id")
    p_link.add_argument("--relation", required=True,
                        choices=sorted(relation.value for relation in EXPLICIT_RELATIONS))
    p_link.add_argument("--evidence", required=True, action="append")
    p_link.set_defaults(func=cmd_link)

    p_supersede = subparsers.add_parser("supersede", parents=[common], help="record evidence-backed supersession")
    p_supersede.add_argument("new_id")
    p_supersede.add_argument("old_id")
    p_supersede.add_argument("--evidence", required=True, action="append")
    p_supersede.set_defaults(func=cmd_supersede)

    p_mcp = subparsers.add_parser("mcp", parents=[common], help="run the optional read-only MCP server")
    p_mcp.set_defaults(func=lambda args: __import__("server.pitmry.mcp_server", fromlist=["run"]).run(root=args.root))

    return parser


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except (OSError, RuntimeError, ValueError) as exc:
        print(f"{args.command} failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
