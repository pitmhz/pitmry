#!/usr/bin/env python3
"""
export_session_to_memory.py - Unified Session, Commit & Memory Exporter
Automates Phase 7.2 of git-flow and general completion workflows:
1. Writes offline markdown session summary to docs/sessions/ (or project docs/)
2. Writes structured JSON to ~/.agents/skills/cavemem/memory/git-flow/
3. Ingests directly into Cavemem SQLite (~/.cavemem/data.db) as Git Semantic Digest or ADR
4. Embeds via local ONNX (all-MiniLM-L6-v2) in <5ms
5. Syncs directly to LanceDB columnar vector storage (~/.strategic_memory/lancedb)
"""

import os
import sys
import json
import time
import subprocess
import argparse
from datetime import datetime, timezone
from pathlib import Path

# Paths
SCRIPTS_DIR = Path(__file__).resolve().parent
SERVER_DIR = SCRIPTS_DIR.parent
CAVEMEM_GIT_FLOW_DIR = Path(os.path.expanduser(r"~\.agents\skills\cavemem\memory\git-flow"))
CAVEMEM_STRATEGIC_SCRIPT = SERVER_DIR / "cavemem_strategic.py" if (SERVER_DIR / "cavemem_strategic.py").exists() else SCRIPTS_DIR / "cavemem_strategic.py"
LANCEDB_STRATEGIC_SCRIPT = SERVER_DIR / "lancedb_strategic.py" if (SERVER_DIR / "lancedb_strategic.py").exists() else SCRIPTS_DIR / "lancedb_strategic.py"


def get_git_info(cwd=None):
    """Attempt to detect git metadata if inside a git repository."""
    info = {
        "is_git": False,
        "commit_hash": "",
        "short_hash": "",
        "branch": "",
        "files_changed": [],
        "commit_msg": ""
    }
    try:
        res = subprocess.run(["git", "rev-parse", "--is-inside-work-tree"], cwd=cwd, capture_output=True, text=True)
        if res.returncode != 0 or "true" not in res.stdout.lower():
            return info
        info["is_git"] = True
        
        # Commit hash
        h = subprocess.run(["git", "rev-parse", "HEAD"], cwd=cwd, capture_output=True, text=True).stdout.strip()
        info["commit_hash"] = h
        info["short_hash"] = h[:8] if h else "manual"
        
        # Branch
        b = subprocess.run(["git", "branch", "--show-current"], cwd=cwd, capture_output=True, text=True).stdout.strip()
        info["branch"] = b if b else "main"
        
        # Last commit msg
        msg = subprocess.run(["git", "log", "-1", "--pretty=%B"], cwd=cwd, capture_output=True, text=True).stdout.strip()
        info["commit_msg"] = msg
        
        # Changed files in last commit
        files = subprocess.run(["git", "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"], cwd=cwd, capture_output=True, text=True).stdout.strip().splitlines()
        info["files_changed"] = [f.strip() for f in files if f.strip()]
    except Exception:
        pass
    return info


def export_session(
    project: str,
    title: str,
    summary: str,
    rationale: str = "",
    session_type: str = "feat",
    files: str = "",
    tags: str = "",
    decision: str = "",
    context: str = "",
    cwd: str = None
):
    now = datetime.now(timezone.utc)
    ts_iso = now.isoformat()
    ts_file = now.strftime("%Y-%m-%d-%H%M%S")
    cwd_path = Path(cwd) if cwd else Path.cwd()

    git_info = get_git_info(cwd=cwd_path)
    commit_hash = git_info["short_hash"] if git_info["is_git"] else "manual"
    branch = git_info["branch"] if git_info["is_git"] else "main"
    
    files_list = [f.strip() for f in files.split(",") if f.strip()] if files else git_info["files_changed"]
    files_str = ", ".join(files_list) if files_list else "None specified"

    if not project or project == ".":
        project = cwd_path.name if cwd_path.name != "Pieter" else "workspace"

    tag_list = [t.strip() for t in tags.split(",") if t.strip()]
    for default_tag in [session_type, project, "session-history"]:
        if default_tag not in tag_list:
            tag_list.append(default_tag)

    print(f"\n========================================================")
    print(f" Exporting Session to Offline Memory & Vector Databases")
    print(f" Project: {project} | Type: {session_type} | Commit: {commit_hash}")
    print(f"========================================================")

    # 1. Target A: Write Offline Markdown Session Doc
    docs_session_dir = cwd_path / "docs" / "sessions"
    try:
        docs_session_dir.mkdir(parents=True, exist_ok=True)
        md_file = docs_session_dir / f"{ts_file}-{session_type}.md"
    except Exception:
        docs_session_dir = Path(r"C:\Users\Pieter\docs\sessions")
        docs_session_dir.mkdir(parents=True, exist_ok=True)
        md_file = docs_session_dir / f"{ts_file}-{project}-{session_type}.md"

    md_content = f"""# Session Summary: {title}

- **Project**: `{project}`
- **Date**: {now.strftime('%Y-%m-%d %H:%M:%S UTC')}
- **Type**: `{session_type}`
- **Branch**: `{branch}`
- **Commit**: `{commit_hash}`
- **Tags**: {", ".join(f"`{t}`" for t in tag_list)}

## Summary & Impact
{summary}

## Architectural Rationale / Thought Process
{rationale if rationale else "Documented as part of task execution."}
"""
    if decision:
        md_content += f"\n## Key Decisions\n{decision}\n"
    if context:
        md_content += f"\n## Context & Constraints\n{context}\n"

    md_content += f"\n## Changed Files\n"
    for f in files_list:
        md_content += f"- `{f}`\n"
    if not files_list:
        md_content += "- (No file list specified)\n"

    with open(md_file, "w", encoding="utf-8") as f:
        f.write(md_content)
    print(f"✓ Target A: Written offline docs: {md_file}")

    # 2. Target B: Write Cavemem Git-Flow JSON File
    CAVEMEM_GIT_FLOW_DIR.mkdir(parents=True, exist_ok=True)
    json_filename = f"{now.strftime('%Y-%m-%d')}-{commit_hash}.json"
    json_path = CAVEMEM_GIT_FLOW_DIR / json_filename
    
    json_payload = {
        "id": f"git-flow:{ts_iso}",
        "timestamp": ts_iso,
        "project": project,
        "branch": branch,
        "commit": {
            "hash": commit_hash,
            "type": session_type,
            "message": title
        },
        "summary": summary,
        "rationale": rationale,
        "decision": decision,
        "context": context,
        "files": files_list,
        "tags": tag_list
    }

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(json_payload, f, indent=2)
    print(f"✓ Target B: Written Cavemem JSON log: {json_path}")

    # 3. Target C: Insert into Cavemem SQLite Strategic Tables with Vector Embeddings
    # If it represents an architectural decision, record as ADR; also record as Git Digest
    cmd_git = [
        sys.executable, str(CAVEMEM_STRATEGIC_SCRIPT), "git", "record",
        "--project", project,
        "--commit-hash", commit_hash,
        "--branch", branch,
        "--summary", f"{title}: {summary}",
        "--files-changed", files_str,
        "--rationale", rationale if rationale else summary
    ]
    subprocess.run(cmd_git, check=True)

    if decision or session_type in ["adr", "refactor", "arch"]:
        cmd_adr = [
            sys.executable, str(CAVEMEM_STRATEGIC_SCRIPT), "adr", "record",
            "--project", project,
            "--title", title,
            "--context", context if context else summary,
            "--decision", decision if decision else summary,
            "--rationale", rationale if rationale else "Standard engineering pattern",
            "--tags", ", ".join(tag_list)
        ]
        subprocess.run(cmd_adr, check=True)

    # 4. Target D: Sync to LanceDB Columnar Vector Store
    cmd_sync = [sys.executable, str(LANCEDB_STRATEGIC_SCRIPT), "sync"]
    subprocess.run(cmd_sync, check=True)

    print(f"✓ Target D: Synced and embedded in LanceDB (~/.strategic_memory/lancedb)")
    print(f"========================================================")
    print(f"Session memory pipeline successfully completed!")
    print(f"========================================================\n")


def main():
    parser = argparse.ArgumentParser(description="Export session, commit, or milestone to offline docs & vector DBs")
    parser.add_argument("--project", "-p", default="", help="Project name (defaults to current dir)")
    parser.add_argument("--title", "-t", required=True, help="Title or commit message of the session/work")
    parser.add_argument("--summary", "-s", required=True, help="Detailed summary of what was accomplished")
    parser.add_argument("--rationale", "-r", default="", help="Thought process / why this design/code was chosen")
    parser.add_argument("--decision", "-d", default="", help="Key architectural decision made (if applicable)")
    parser.add_argument("--context", "-c", default="", help="Context and constraints behind the work")
    parser.add_argument("--type", default="feat", help="Type: feat, fix, refactor, adr, session")
    parser.add_argument("--files", "-f", default="", help="Comma-separated changed files (or auto-detect from git)")
    parser.add_argument("--tags", default="", help="Comma-separated tags")
    parser.add_argument("--cwd", default=None, help="Working directory to detect git repo")

    args = parser.parse_args()
    export_session(
        project=args.project,
        title=args.title,
        summary=args.summary,
        rationale=args.rationale,
        session_type=args.type,
        files=args.files,
        tags=args.tags,
        decision=args.decision,
        context=args.context,
        cwd=args.cwd
    )


if __name__ == "__main__":
    main()
