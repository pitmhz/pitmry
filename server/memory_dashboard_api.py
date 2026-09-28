"""Compatibility CLI for the human dashboard, backed only by canonical PITMRY."""

from __future__ import annotations

import argparse
import json
import subprocess

from pitmry import dashboard
from pitmry.canonical_store import CanonicalStore
from pitmry.doctor import doctor
from pitmry.models import MemoryRecord
from pitmry.enums import RecordType
from pitmry.ids import is_record_id
from pitmry.patch_parser import parse_patch
from pitmry.project_intelligence import project_context


def _diff(project=None, commit_hash=None, item_id=None):
    for store in dashboard.project_roots():
        if project and project not in (store.require_manifest()["name"], store.project_id):
            continue
        # A git SHA and a record id are different things. Only a real record id
        # can be looked up in the store; a bare SHA is already what git wants,
        # and passing it to store.get would raise on the id format check.
        record = store.get(item_id) if is_record_id(item_id) else None
        if isinstance(record, MemoryRecord) and record.type is RecordType.git_change:
            sha = record.content.get("commit_sha") or record.provenance.source_commit
        else:
            sha = commit_hash
        if not sha or len(sha) != 40:
            continue
        # Git writes UTF-8 regardless of the host locale. On Windows the default
        # text codec is cp1252, which raises on any byte it cannot map and takes
        # the whole patch with it, so the encoding is pinned and errors are
        # replaced rather than allowed to abort the read.
        result = subprocess.run(
            ["git", "-C", str(store.paths.root), "show", "--format=fuller", sha],
            capture_output=True,
            encoding="utf-8",
            errors="replace",
        )
        if result.returncode == 0:
            # The viewer renders files and hunks, not raw patch text, so the
            # patch is parsed here. Both shapes are returned: the structured
            # one the UI needs, and the raw text for anyone reading the API
            # directly or copying the patch out.
            payload = parse_patch(result.stdout)
            payload["commit_hash"] = payload.get("commit_hash") or sha
            payload["record_id"] = record.id if record else None
            payload["diff"] = result.stdout
            payload["status"] = "OK"
            return payload
    return {"available": False, "status": "NO_MATCH", "diff": "", "files": [],
            "error": "No canonical Git record or resolvable commit found."}


def _galaxy():
    return {"nodes": [], "edges": [], "clusters": [],
            "stats": {"total_nodes": 0, "total_edges": 0, "anomaly_count": 0,
                      "cluster_count": 0, "dimensions": 0},
            "status": "DEGRADED", "warnings": ["VECTOR_LAYOUT_UNAVAILABLE"],
            "message": "The canonical vector projection has no spatial layout. Rebuild the vector index to enable this view."}


def main(argv=None):
    parser = argparse.ArgumentParser(description="Canonical PITMRY dashboard bridge")
    action = parser.add_mutually_exclusive_group()
    action.add_argument("--summary", action="store_true")
    action.add_argument("--feed", action="store_true")
    action.add_argument("--relations", action="store_true")
    action.add_argument("--graph", action="store_true")
    action.add_argument("--galaxy", action="store_true")
    action.add_argument("--journey", action="store_true")
    action.add_argument("--diff", action="store_true")
    action.add_argument("--health", action="store_true")
    action.add_argument("--deploys", action="store_true")
    action.add_argument("--activity", action="store_true")
    action.add_argument("--notifications", action="store_true")
    action.add_argument("--workspace", action="store_true")
    action.add_argument("--records", action="store_true")
    action.add_argument("--record", action="store_true")
    action.add_argument("--project-intelligence", action="store_true")
    parser.add_argument("--root", default=None)
    parser.add_argument("--project", default=None)
    parser.add_argument("--type", default=None)
    parser.add_argument("--tag", default=None)
    parser.add_argument("--query", default=None)
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--item-type", default=None)
    parser.add_argument("--item-id", default=None)
    parser.add_argument("--hops", type=int, default=2)
    parser.add_argument("--commit-hash", default=None)
    parser.add_argument("--state", default=None)
    parser.add_argument("--date-from", default=None)
    parser.add_argument("--date-to", default=None)
    parser.add_argument("--cursor", type=int, default=0)
    args = parser.parse_args(argv)
    if args.root:
        import os
        os.environ["PITMRY_ROOT"] = args.root

    if args.records:
        result = dashboard.records_page(args.project, args.type, args.tag, args.query,
                                        args.state, args.date_from, args.date_to,
                                        args.cursor, args.limit, args.root)
    elif args.record:
        result = dashboard.record_detail(args.item_id or "", args.root)
    elif args.workspace:
        result = {"status": "OK", **dashboard.workspace_summary(args.root)}
    elif args.project_intelligence:
        stores = [CanonicalStore(args.root)] if args.root else dashboard.project_roots()
        result = {"status": "OK", "projects": [project_context(store) for store in stores]}
    elif args.feed:
        result = dashboard.feed(args.project, args.type, args.tag, args.query, args.limit, args.root)
    elif args.relations:
        result = dashboard.relations(args.item_id or "", args.root)
    elif args.graph:
        result = dashboard.graph(args.root)
    elif args.galaxy:
        result = _galaxy()
    elif args.journey:
        result = dashboard.journey(args.item_id or "", args.hops, args.root)
    elif args.diff:
        result = _diff(args.project, args.commit_hash, args.item_id)
    elif args.health:
        result = doctor(args.root)
    elif args.deploys:
        result = {"status": "NO_MATCH", "deploys": [], "repos": [],
                  "warnings": ["DEPLOYMENT_RECORDS_UNAVAILABLE"]}
    elif args.activity:
        result = dashboard.activity(root=args.root, limit=args.limit)
    elif args.notifications:
        result = {"notifications": [], "unread_count": 0,
                  "status": "OK", "provenance": "canonical"}
    else:
        result = dashboard.summary(args.root)
    # This script is called through a Windows subprocess, where stdout may use
    # cp1252. Keep the JSON transport ASCII-safe so arbitrary record text cannot
    # fail before Node receives and decodes it.
    print(json.dumps(result, ensure_ascii=True))


if __name__ == "__main__":
    main()
