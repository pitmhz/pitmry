#!/usr/bin/env python3
"""Capture session history in the project-local PITMRY canonical store."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from server.pitmry.canonical_store import CanonicalStore
from server.pitmry.capture import capture_decision, capture_git_change, capture_session_summary
from server.pitmry.enums import Authority
from server.pitmry.rebuild import rebuild


def export_session(*, title, summary, rationale="", decision="", context="",
                   session_type="feat", files=(), tags=(), cwd=None, root=None,
                   source_id=None, decision_id=None, markdown=None, no_vectors=False):
    project_root = Path(root or cwd or Path.cwd()).resolve()
    store = CanonicalStore(project_root)
    store.require_manifest()
    manifest = store.read_manifest()
    if tags and isinstance(tags, str):
        tags = [item.strip() for item in tags.split(",") if item.strip()]
    if files and isinstance(files, str):
        files = [item.strip() for item in files.split(",") if item.strip()]
    try:
        commit_sha = __import__("subprocess").run(
            ["git", "-C", str(project_root), "rev-parse", "--verify", "HEAD^{commit}"],
            capture_output=True, text=True, check=True).stdout.strip()
    except Exception:
        commit_sha = ""
    seed = "\0".join((commit_sha, title, summary, session_type))
    stable_source_id = source_id or "export:" + hashlib.sha256(seed.encode("utf-8")).hexdigest()
    captured = []
    git_record = None
    captured_at = None
    if commit_sha:
        git_record, relation = capture_git_change(store, commit_sha, root=project_root,
                                                  decision_id=decision_id or None)
        captured_at = git_record.content["committed_at"]
        captured.append(git_record.id)
        if relation:
            captured.append(relation.id)
    if decision.strip():
        decision_record = capture_decision(store, title, decision,
                                           context=context or summary, rationale=rationale,
                                           source_id=stable_source_id + ":decision",
                                           authority=Authority.agent_reported, tags=tags,
                                           created_at=captured_at)
        captured.append(decision_record.id)
    session = capture_session_summary(
        store, title, summary, source_id=stable_source_id,
        authority=Authority.agent_reported, tags=tuple(tags) + (session_type,),
        created_at=captured_at, related_files=files,
        content={"context": context, "rationale": rationale, "decision": decision},
        source_commit=commit_sha or None)
    captured.append(session.id)
    projection = rebuild(project_root, no_vectors=no_vectors)
    if markdown:
        destination = Path(markdown).resolve()
        destination.parent.mkdir(parents=True, exist_ok=True)
        file_list = "\n".join(f"- `{path}`" for path in files) or "Not recorded."
        tag_list = ", ".join(tags) or "None."
        destination.write_text(
            f"# Session Summary: {title}\n\n"
            f"Project: {manifest['name']}\n\n"
            f"## Summary\n{summary}\n\n"
            f"## Context\n{context or 'Not supplied.'}\n\n"
            f"## Rationale\n{rationale or 'Not supplied.'}\n\n"
            f"## Decision\n{decision or 'No separate ADR decision recorded.'}\n\n"
            f"## Captured Git Base\n`{commit_sha or 'unavailable'}`. Session changes may be uncommitted; this is the source revision, not a claim that the session work is committed.\n\n"
            f"## Related Files\n{file_list}\n\n"
            f"## Tags\n{tag_list}\n\n"
            f"## Projection Rebuild\nSQLite/FTS and vector projection were rebuilt from canonical records. Result: `{json.dumps(projection, sort_keys=True, default=str)}`.\n",
            encoding="utf-8")
    return {"project": manifest["name"], "records": captured,
            "git_commit": commit_sha or None, "projection": projection}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", "-p", default="")
    parser.add_argument("--title", "-t", required=True)
    parser.add_argument("--summary", "-s", required=True)
    parser.add_argument("--rationale", "-r", default="")
    parser.add_argument("--decision", "-d", default="")
    parser.add_argument("--decision-id", default="")
    parser.add_argument("--context", "-c", default="")
    parser.add_argument("--type", default="feat")
    parser.add_argument("--files", "-f", default="")
    parser.add_argument("--tags", default="")
    parser.add_argument("--cwd", default=None)
    parser.add_argument("--root", default=None)
    parser.add_argument("--source-id", default=None,
                        help="stable source id to make a retry idempotent")
    parser.add_argument("--markdown", default=None,
                        help="optional path for a human-readable Markdown summary")
    parser.add_argument("--no-vectors", action="store_true")
    args = parser.parse_args(argv)
    try:
        result = export_session(title=args.title, summary=args.summary,
                                rationale=args.rationale, decision=args.decision,
                                decision_id=args.decision_id, context=args.context,
                                session_type=args.type, files=args.files, tags=args.tags,
                                cwd=args.cwd, root=args.root, source_id=args.source_id,
                                markdown=args.markdown, no_vectors=args.no_vectors)
    except (ValueError, OSError, RuntimeError) as exc:
        print(f"session export failed: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
