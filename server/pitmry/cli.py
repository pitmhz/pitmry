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
from . import project_intelligence as pi
from .models import record_to_dict


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


def _pi_output(value):
    if hasattr(value, "type"):
        value = record_to_dict(value)
    elif isinstance(value, dict):
        value = {key: (record_to_dict(item) if hasattr(item, "type") else item)
                 for key, item in value.items()}
    print(json.dumps(value, indent=2, ensure_ascii=False, default=str))
    return 0


def cmd_pi_ingest(args):
    return _pi_output(pi.ingest_markdown(_make_store(args), args.path))


def cmd_pi_import(args):
    store = _make_store(args)
    path = (store.paths.root / args.file).resolve()
    try:
        path.relative_to(store.paths.root.resolve())
    except ValueError as exc:
        raise ValueError("decomposition file must be inside the project root") from exc
    payload = json.loads(path.read_text(encoding="utf-8"))
    return _pi_output(pi.import_decomposition(store, args.artifact_id, payload))


def cmd_pi_reconcile(args):
    return _pi_output(pi.record_reconciliation(_make_store(args), args.classification,
                     args.record_ids, args.summary, critical=not args.noncritical))


def cmd_pi_resolve(args):
    store = _make_store(args)
    if not sys.stdin.isatty():
        raise ValueError("reconciliation resolution requires an interactive terminal")
    record = store.get(args.observation_id)
    if record is None:
        raise ValueError(f"reconciliation not found: {args.observation_id}")
    print(f"{record.title}: {record.summary}")
    answer = input("Enter the reviewed resolution: ").strip()
    return _pi_output(pi.resolve_reconciliation(store, args.observation_id, answer,
                     decision_id=args.decision_id, actor="human"))


def cmd_pi_baseline(args):
    store = _make_store(args)
    if not sys.stdin.isatty():
        raise ValueError("baseline approval requires an interactive terminal")
    name = store.require_manifest()["name"]
    print(f"Reviewing proposed baseline for {name}")
    print("Accepted records:")
    for record_id in args.record_ids:
        record = store.get(record_id)
        if record is None:
            raise ValueError(f"record not found: {record_id}")
        print(f"- [{record.type.value}] {record.title}: {record.summary}")
    conflicts = [record for record in store.iter_records()
                 if record.type == RecordType.observation
                 and record.content.get("observation_kind") == "reconciliation"
                 and record.content.get("critical")
                 and not any(item.type == RecordType.observation
                             and item.content.get("observation_kind") == "reconciliation_resolution"
                             and item.content.get("target_id") == record.id
                             for item in store.iter_records())]
    if conflicts:
        print("Unresolved critical reconciliations:")
        for conflict in conflicts:
            print(f"- {conflict.id}: {conflict.content.get('summary', conflict.summary)}")
    answer = input(f"Type {name!r} to approve this baseline: ").strip()
    waivers = {}
    for item in args.waive_conflict:
        conflict_id, separator, reason = item.partition("=")
        if not separator or not conflict_id.strip() or not reason.strip():
            raise ValueError("--waive-conflict must use ID=REASON")
        waivers[conflict_id.strip()] = reason.strip()
    return _pi_output(pi.baseline_project(store, args.record_ids,
                     confirmation=answer, waived_conflicts=waivers))


def cmd_pi_phase(args):
    return _pi_output(pi.create_phase(_make_store(args), args.name, args.ordinal, args.objective))


def cmd_pi_work(args):
    return _pi_output(pi.create_work_unit(_make_store(args), args.phase_id, args.title,
                     args.objective, args.requirement, scope={"paths": args.path, "symbols": args.symbol},
                     release_gate=args.release_gate))


def cmd_pi_readiness(args):
    result = pi.evaluate_readiness(_make_store(args), args.work_id)
    print(json.dumps(result, indent=2))
    return 0 if result["ready"] else 2


def cmd_pi_next(args):
    store = _make_store(args)
    result = pi.list_ready_work(store, phase_id=args.phase_id, tags=args.tag)
    _pi_output([{"work_unit": record_to_dict(item["work_unit"]),
                 "readiness": item["readiness"]} for item in result])
    return 0


def cmd_pi_session_start(args):
    result = pi.start_session(_make_store(args), args.work_id, agent=args.agent,
                              branch=args.branch, worktree=args.worktree,
                              base_commit=args.base_commit, lease_seconds=args.lease_seconds,
                              read_only=args.read_only)
    return _pi_output(result)


def cmd_pi_session_finish(args):
    store = _make_store(args)
    reuse = None
    if args.reuse_analysis_file:
        path = (store.paths.root / args.reuse_analysis_file).resolve()
        try:
            path.relative_to(store.paths.root.resolve())
        except ValueError as exc:
            raise ValueError("reuse-analysis file must be inside the project root") from exc
        reuse = json.loads(path.read_text(encoding="utf-8"))
    tests = args.test
    if args.tests_file:
        path = (store.paths.root / args.tests_file).resolve()
        try:
            path.relative_to(store.paths.root.resolve())
        except ValueError as exc:
            raise ValueError("test evidence file must be inside the project root") from exc
        payload = json.loads(path.read_text(encoding="utf-8"))
        tests = payload.get("tests", payload) if isinstance(payload, dict) else payload
        if not isinstance(tests, list):
            raise ValueError("test evidence file must contain a list or an object with a tests list")
    return _pi_output(pi.finish_session(store, args.session_id,
                     changed_files=args.changed_file, summary=args.summary,
                     commit_sha=args.commit, tests=tests, build_result=args.build_result,
                     changed_symbols=args.changed_symbol, reuse_analysis=reuse,
                     limitations=args.limitation, decision_ids=args.decision_id,
                     bug_ids=args.bug_id, unresolved_work=args.unresolved_work))


def cmd_pi_checkpoint(args):
    return _pi_output(pi.checkpoint_session(_make_store(args), args.session_id,
                     args.summary, open_work=args.open_work))


def cmd_pi_block(args):
    return _pi_output(pi.block_session(_make_store(args), args.session_id, args.reason))


def cmd_pi_resume(args):
    return _pi_output(pi.resume_session(_make_store(args), args.session_id))


def cmd_pi_abandon(args):
    return _pi_output(pi.abandon_session(_make_store(args), args.session_id, reason=args.reason))


def cmd_pi_incident(args):
    kind = {"bug": RecordType.bug, "fix": RecordType.fix, "regression": RecordType.regression}[args.type]
    return _pi_output(pi.record_incident(_make_store(args), kind, args.title, args.summary,
                     related_ids=args.related))


def cmd_pi_close_bug(args):
    store = _make_store(args)
    if not sys.stdin.isatty():
        raise ValueError("bug closure requires an interactive terminal")
    answer = input(f"Type {args.bug_id!r} to close this bug: ").strip()
    return _pi_output(pi.close_bug(store, args.bug_id, fix_id=args.fix_id,
                     disposition=args.disposition, confirmation=answer))


def cmd_pi_staleness(args):
    return _pi_output(pi.verification_staleness(_make_store(args), args.verification_id, head=args.head))


def cmd_pi_context(args):
    store = _make_store(args)
    if args.kind == "project":
        value = pi.project_context(store)
    elif args.kind == "work":
        value = pi.work_context(store, args.record_id)
    elif args.kind == "session":
        value = pi.session_context(store, args.record_id)
    else:
        value = pi.code_context(store, args.record_id)
    return _pi_output(value)


def cmd_pi_plan_validate(args):
    result = pi.validate_plan(_make_store(args))
    _pi_output(result)
    return 0 if result["valid"] else 2


def cmd_pi_release_readiness(args):
    result = pi.release_readiness(_make_store(args))
    _pi_output(result)
    return 0 if result["ready"] else 2


def cmd_pi_verify(args):
    store = _make_store(args)
    path = (store.paths.root / args.file).resolve()
    try:
        path.relative_to(store.paths.root.resolve())
    except ValueError as exc:
        raise ValueError("verification file must be inside the project root") from exc
    payload = json.loads(path.read_text(encoding="utf-8"))
    confirmation = None
    if args.type in {"human", "human_confirmed"}:
        if not sys.stdin.isatty():
            raise ValueError("human verification requires an interactive terminal")
        confirmation = input(f"Type {args.work_id!r} to confirm this verification: ").strip()
    return _pi_output(pi.verify_work(store, args.work_id, args.commit,
                     payload.get("criteria", []), verification_type=args.type,
                     human_confirmation=confirmation))


def cmd_hook_post_commit(args):
    from .git_hooks import post_commit
    post_commit(args.root)
    return 0


def cmd_hooks_install(args):
    from .git_hooks import install_post_commit
    return _pi_output(install_post_commit(args.root))


def cmd_hooks_uninstall(args):
    from .git_hooks import uninstall_post_commit
    return _pi_output(uninstall_post_commit(args.root))


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

    p_pi = subparsers.add_parser("pi", parents=[common], help="Project Intelligence operations")
    pi_commands = p_pi.add_subparsers(dest="pi_command", required=True)

    p_pi_ingest = pi_commands.add_parser("ingest", parents=[common], help="preserve a Markdown source snapshot")
    p_pi_ingest.add_argument("path")
    p_pi_ingest.set_defaults(func=cmd_pi_ingest)

    p_pi_import = pi_commands.add_parser("import", parents=[common], help="import a validated decomposition JSON file")
    p_pi_import.add_argument("artifact_id")
    p_pi_import.add_argument("file")
    p_pi_import.set_defaults(func=cmd_pi_import)

    p_pi_reconcile = pi_commands.add_parser("reconcile", parents=[common], help="record a reconciliation proposal")
    p_pi_reconcile.add_argument("classification", choices=sorted(pi._RECONCILIATIONS))
    p_pi_reconcile.add_argument("record_ids", nargs="+")
    p_pi_reconcile.add_argument("--summary", required=True)
    p_pi_reconcile.add_argument("--noncritical", action="store_true")
    p_pi_reconcile.set_defaults(func=cmd_pi_reconcile)

    p_pi_resolve = pi_commands.add_parser("resolve", parents=[common], help="interactively resolve a reconciliation proposal")
    p_pi_resolve.add_argument("observation_id")
    p_pi_resolve.add_argument("--decision", dest="decision_id")
    p_pi_resolve.set_defaults(func=cmd_pi_resolve)

    p_pi_baseline = pi_commands.add_parser("baseline", parents=[common], help="review and approve the requirement baseline")
    p_pi_baseline.add_argument("record_ids", nargs="+")
    p_pi_baseline.add_argument("--waive-conflict", action="append", default=[], metavar="ID=REASON")
    p_pi_baseline.set_defaults(func=cmd_pi_baseline)

    p_pi_phase = pi_commands.add_parser("phase", parents=[common], help="create a planning phase")
    p_pi_phase.add_argument("name")
    p_pi_phase.add_argument("--ordinal", required=True, type=int)
    p_pi_phase.add_argument("--objective", required=True)
    p_pi_phase.set_defaults(func=cmd_pi_phase)

    p_pi_work = pi_commands.add_parser("work", parents=[common], help="create a work unit")
    p_pi_work.add_argument("phase_id")
    p_pi_work.add_argument("--title", required=True)
    p_pi_work.add_argument("--objective", required=True)
    p_pi_work.add_argument("--requirement", required=True, action="append")
    p_pi_work.add_argument("--path", action="append", default=[])
    p_pi_work.add_argument("--symbol", action="append", default=[])
    p_pi_work.add_argument("--release-gate", action="store_true",
                           help="require this work unit to pass before project release")
    p_pi_work.set_defaults(func=cmd_pi_work)

    p_pi_readiness = pi_commands.add_parser("readiness", parents=[common], help="explain work readiness")
    p_pi_readiness.add_argument("work_id")
    p_pi_readiness.set_defaults(func=cmd_pi_readiness)

    p_pi_next = pi_commands.add_parser("next", parents=[common], help="list ready work only")
    p_pi_next.add_argument("--phase", dest="phase_id")
    p_pi_next.add_argument("--tag", action="append", default=[])
    p_pi_next.set_defaults(func=cmd_pi_next)

    p_pi_start = pi_commands.add_parser("session-start", parents=[common], help="claim ready work and build a session contract")
    p_pi_start.add_argument("work_id")
    p_pi_start.add_argument("--agent", default="unknown")
    p_pi_start.add_argument("--branch", default="")
    p_pi_start.add_argument("--worktree", default="")
    p_pi_start.add_argument("--base-commit", default="")
    p_pi_start.add_argument("--lease-seconds", type=int, default=3600)
    p_pi_start.add_argument("--read-only", action="store_true")
    p_pi_start.set_defaults(func=cmd_pi_session_start)

    p_pi_finish = pi_commands.add_parser("session-finish", parents=[common], help="capture implementation and release the lease")
    p_pi_finish.add_argument("session_id")
    p_pi_finish.add_argument("--changed-file", action="append", default=[])
    p_pi_finish.add_argument("--changed-symbol", action="append", default=[])
    p_pi_finish.add_argument("--summary", default="")
    p_pi_finish.add_argument("--commit", default=None)
    p_pi_finish.add_argument("--test", action="append", default=[])
    p_pi_finish.add_argument("--tests-file", default=None,
                             help="project-relative JSON with structured test evidence")
    p_pi_finish.add_argument("--build-result", default=None)
    p_pi_finish.add_argument("--limitation", action="append", default=[])
    p_pi_finish.add_argument("--decision-id", action="append", default=[])
    p_pi_finish.add_argument("--bug-id", action="append", default=[])
    p_pi_finish.add_argument("--unresolved-work", action="append", default=[])
    p_pi_finish.add_argument("--reuse-analysis-file", default=None)
    p_pi_finish.set_defaults(func=cmd_pi_session_finish)

    p_pi_checkpoint = pi_commands.add_parser("checkpoint", parents=[common], help="record a session checkpoint")
    p_pi_checkpoint.add_argument("session_id")
    p_pi_checkpoint.add_argument("--summary", required=True)
    p_pi_checkpoint.add_argument("--open-work", default="")
    p_pi_checkpoint.set_defaults(func=cmd_pi_checkpoint)

    p_pi_block = pi_commands.add_parser("block", parents=[common], help="record a session blocker")
    p_pi_block.add_argument("session_id")
    p_pi_block.add_argument("--reason", required=True)
    p_pi_block.set_defaults(func=cmd_pi_block)

    p_pi_resume = pi_commands.add_parser("resume", parents=[common], help="resume a blocked session with a valid lease")
    p_pi_resume.add_argument("session_id")
    p_pi_resume.set_defaults(func=cmd_pi_resume)

    p_pi_abandon = pi_commands.add_parser("abandon", parents=[common], help="abandon a session and release its lease")
    p_pi_abandon.add_argument("session_id")
    p_pi_abandon.add_argument("--reason", required=True)
    p_pi_abandon.set_defaults(func=cmd_pi_abandon)

    p_pi_incident = pi_commands.add_parser("incident", parents=[common], help="record a bug, fix, or regression")
    p_pi_incident.add_argument("type", choices=("bug", "fix", "regression"))
    p_pi_incident.add_argument("--title", required=True)
    p_pi_incident.add_argument("--summary", required=True)
    p_pi_incident.add_argument("--related", action="append", default=[])
    p_pi_incident.set_defaults(func=cmd_pi_incident)

    p_pi_close_bug = pi_commands.add_parser("close-bug", parents=[common], help="interactively close a bug")
    p_pi_close_bug.add_argument("bug_id")
    p_pi_close_bug.add_argument("--fix")
    p_pi_close_bug.add_argument("--disposition")
    p_pi_close_bug.set_defaults(func=cmd_pi_close_bug)

    p_pi_staleness = pi_commands.add_parser("staleness", parents=[common], help="check and record verification staleness")
    p_pi_staleness.add_argument("verification_id")
    p_pi_staleness.add_argument("--head", default="HEAD")
    p_pi_staleness.set_defaults(func=cmd_pi_staleness)

    p_pi_context = pi_commands.add_parser("context", parents=[common], help="build structured project, work, session, or code context")
    p_pi_context.add_argument("kind", choices=("project", "work", "session", "code"))
    p_pi_context.add_argument("record_id", nargs="?")
    p_pi_context.set_defaults(func=cmd_pi_context)

    p_pi_verify = pi_commands.add_parser("verify", parents=[common], help="record criterion results at a commit")
    p_pi_verify.add_argument("work_id")
    p_pi_verify.add_argument("--commit", required=True)
    p_pi_verify.add_argument("--file", required=True, help="project-relative JSON containing criterion results")
    p_pi_verify.add_argument("--type", choices=("automated", "agent_reviewed", "human_confirmed", "runtime_observed"),
                             default="automated")
    p_pi_verify.set_defaults(func=cmd_pi_verify)

    p_pi_plan = pi_commands.add_parser("plan-validate", parents=[common],
                                       help="validate planning coverage and dependencies")
    p_pi_plan.set_defaults(func=cmd_pi_plan_validate)

    p_pi_release = pi_commands.add_parser("release-readiness", parents=[common],
                                          help="check required project completion gates")
    p_pi_release.set_defaults(func=cmd_pi_release_readiness)

    p_hooks = subparsers.add_parser("hooks", parents=[common],
                                    help="manage opt-in local Git hook integration")
    hook_commands = p_hooks.add_subparsers(dest="hooks_command", required=True)
    p_hooks_install = hook_commands.add_parser("install", parents=[common],
                                               help="install a fail-open post-commit adapter")
    p_hooks_install.set_defaults(func=cmd_hooks_install)
    p_hooks_uninstall = hook_commands.add_parser("uninstall", parents=[common],
                                                 help="remove the PITMRY post-commit adapter")
    p_hooks_uninstall.set_defaults(func=cmd_hooks_uninstall)

    p_hook = subparsers.add_parser("hook", parents=[common], help="run a Git hook adapter")
    hook_events = p_hook.add_subparsers(dest="hook_event", required=True)
    p_post_commit = hook_events.add_parser("post-commit", parents=[common],
                                           help="capture the commit and check verification freshness")
    p_post_commit.set_defaults(func=cmd_hook_post_commit)

    p_mcp = subparsers.add_parser("mcp", parents=[common], help="run the optional PITMRY agent tool server")
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
