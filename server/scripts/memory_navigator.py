"""Compatibility CLI over the canonical PITMRY retrieval engine.

The script keeps the familiar ``search``, ``inspect``, ``status``, ``schema``,
and ``journey`` commands. It does not query legacy Cavemem or LanceDB tables.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_DIR = Path(__file__).resolve().parents[2]
if str(REPO_DIR) not in sys.path:
    sys.path.insert(0, str(REPO_DIR))

from server.pitmry.canonical_store import CanonicalStore  # noqa: E402
from server.pitmry.context_service import context, lineage  # noqa: E402
from server.pitmry.models import MemoryRecord, RelationRecord, record_to_dict  # noqa: E402
from server.pitmry.relations import explicit_relations  # noqa: E402
from server.pitmry.retrieval import retrieve  # noqa: E402
from server.pitmry.state_resolver import resolve_states  # noqa: E402

_LEGACY_TYPES = {
    "adr": "decision", "commit": "git_change", "grill": "discussion",
    "observation": "observation", "summary": "session_summary",
    "checkpoint": "checkpoint", "memory": "note",
}


def _emit(payload, as_json=False):
    if as_json:
        print(json.dumps(payload, indent=2, ensure_ascii=False))
    else:
        print(json.dumps(payload, indent=2, ensure_ascii=False))
    return payload


def cmd_status(root=None):
    store = CanonicalStore(root)
    manifest = store.require_manifest()
    records = store.load_all()
    problems = store.validate_all()
    sqlite_path = store.paths.sqlite_cache
    vector_path = store.paths.lancedb_cache
    return {
        "status": "degraded" if problems or not sqlite_path.is_file() else "healthy",
        "project_id": manifest["project_id"],
        "project": manifest["name"],
        "canonical": {"path": str(store.paths.canonical_dir),
                      "healthy": not problems, "records": len(records),
                      "problems": problems},
        "sqlite_fts": {"path": str(sqlite_path), "available": sqlite_path.is_file()},
        "vectors": {"path": str(vector_path), "available": vector_path.is_dir()},
    }


def cmd_schema(root=None):
    store = CanonicalStore(root)
    manifest = store.require_manifest()
    result = {"canonical": {"manifest": manifest,
                             "record_fields": list(record_to_dict(next(
                                 (item for item in store.load_all()
                                  if isinstance(item, MemoryRecord)),
                                 _example_record(manifest["project_id"]))).keys())},
              "projection": {"path": str(store.paths.sqlite_cache), "tables": []}}
    if store.paths.sqlite_cache.is_file():
        import sqlite3
        with sqlite3.connect(str(store.paths.sqlite_cache)) as conn:
            names = [row[0] for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
            result["projection"]["tables"] = {
                name: [row[1] for row in conn.execute(f"PRAGMA table_info('{name}')")]
                for name in names
            }
    return result


def _example_record(project_id):
    from server.pitmry.enums import Authority
    # Constructing a temporary object without writing it keeps schema output
    # useful for an empty but initialized project.
    from server.pitmry.ids import derive_record_id
    from server.pitmry.models import MemoryRecord, Provenance, SCHEMA_VERSION
    from server.pitmry.enums import RecordType, TruthDomain
    return MemoryRecord(
        schema_version=SCHEMA_VERSION,
        id=derive_record_id(project_id, "schema", "example", "decision"),
        project_id=project_id, type=RecordType.decision, title="example",
        summary="example", created_at="2000-01-01T00:00:00+00:00",
        authority=Authority.agent_reported, truth_domain=TruthDomain.intent,
        provenance=Provenance("schema", "example", "pitmry", "pitmry"),
    )


def cmd_search(query, *, root=None, project=None, record_type=None,
               limit=5, as_json=False, explain=False, no_vectors=False):
    store = CanonicalStore(root)
    manifest = store.require_manifest()
    project_id = project or manifest["project_id"]
    if project == manifest.get("name"):
        project_id = manifest["project_id"]
    result = retrieve(query, root=root, project_id=project_id,
                      limit=max(limit * 8, limit), include_vectors=not no_vectors)
    records = result["records"]
    if record_type:
        wanted = _LEGACY_TYPES.get(record_type, record_type)
        records = [record for record in records if record.type.value == wanted]
    records = records[:limit]
    all_records = [record for record in store.load_all()
                   if isinstance(record, (MemoryRecord, RelationRecord))]
    states = resolve_states(all_records, explicit_relations(all_records))
    payload = {
        "status": "AMBIGUOUS" if result["ambiguous"] else
                  "OK" if records and not result["warnings"] else
                  "DEGRADED" if records else "NO_MATCH",
        "query": query, "project_id": project_id, "mode": result["mode"],
        "results": [{
            "id": record.id, "type": record.type.value, "title": record.title,
            "summary": record.summary, "state": states.get(record.id, "UNKNOWN"),
            "authority": record.authority.value,
            "truth_domain": record.truth_domain.value,
            **(result["signals"].get(record.id, {}) if explain else {}),
        } for record in records],
        "warnings": result["warnings"],
    }
    return _emit(payload, as_json)


def cmd_inspect(record_id, *, root=None, as_json=False):
    record = CanonicalStore(root).get(record_id)
    if record is None:
        return _emit({"status": "NO_MATCH", "id": record_id}, as_json)
    return _emit(record_to_dict(record), as_json)


def cmd_journey(record_id, *, root=None, hops=2, as_json=False):
    # Historical command name retained; results contain explicit lineage only.
    return _emit(lineage(record_id, root=root, max_hops=min(hops, 2)), as_json)


def build_parser():
    parser = argparse.ArgumentParser(description="PITMRY canonical memory navigator")
    parser.add_argument("--root", default=None, help="PITMRY project root")
    sub = parser.add_subparsers(dest="command", required=True)

    status = sub.add_parser("status", help="show canonical and projection health")
    status.add_argument("--json", action="store_true")

    schema = sub.add_parser("schema", help="show canonical and projection fields")
    schema.add_argument("--json", action="store_true")

    search = sub.add_parser("search", help="search canonical records")
    search.add_argument("query")
    search.add_argument("--project", "-p", default=None,
                        help="canonical project id (or this project's name)")
    search.add_argument("--type", "-t", choices=sorted(_LEGACY_TYPES), default=None)
    search.add_argument("--limit", "-l", type=int, default=5)
    search.add_argument("--no-vectors", action="store_true")
    search.add_argument("--explain", action="store_true")
    search.add_argument("--json", action="store_true")

    inspect = sub.add_parser("inspect", help="read a canonical record")
    inspect.add_argument("id")
    inspect.add_argument("--json", action="store_true")

    journey = sub.add_parser("journey", help="show explicit relation lineage")
    journey.add_argument("id")
    journey.add_argument("--hops", type=int, default=2)
    journey.add_argument("--json", action="store_true")

    context_parser = sub.add_parser("context", help="build compact agent context")
    context_parser.add_argument("query")
    context_parser.add_argument("--limit", type=int, default=8)
    context_parser.add_argument("--character-budget", type=int, default=12000)
    context_parser.add_argument("--no-vectors", action="store_true")
    context_parser.add_argument("--include-inferred", action="store_true")
    context_parser.add_argument("--json", action="store_true")
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        if args.command == "status":
            _emit(cmd_status(args.root), args.json)
        elif args.command == "schema":
            _emit(cmd_schema(args.root), args.json)
        elif args.command == "search":
            cmd_search(args.query, root=args.root, project=args.project,
                       record_type=args.type, limit=args.limit, as_json=args.json,
                       explain=args.explain, no_vectors=args.no_vectors)
        elif args.command == "inspect":
            cmd_inspect(args.id, root=args.root, as_json=args.json)
        elif args.command == "journey":
            cmd_journey(args.id, root=args.root, hops=args.hops, as_json=args.json)
        else:
            _emit(context(args.query, root=args.root, max_records=args.limit,
                          character_budget=args.character_budget,
                          include_vectors=not args.no_vectors,
                          include_inferred=args.include_inferred), args.json)
    except (FileNotFoundError, OSError, RuntimeError, ValueError) as exc:
        print(f"memory navigator failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
