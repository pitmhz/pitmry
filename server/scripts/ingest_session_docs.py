#!/usr/bin/env python3
"""
ingest_session_docs.py - Scans, parses, and ingests existing session docs,
git-flow logs, and architecture documentation into the offline vector databases
(Cavemem SQLite + LanceDB).
"""

import os
import sys
import json
import glob
import re
import sqlite3
import subprocess
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
CAVEMEM_STRATEGIC_SCRIPT = SCRIPTS_DIR / "cavemem_strategic.py"
LANCEDB_STRATEGIC_SCRIPT = SCRIPTS_DIR / "lancedb_strategic.py"


def ingest_git_flow_json_files():
    """Ingest existing Cavemem git-flow JSON files."""
    json_dir = Path(r"C:\Users\Pieter\.agents\skills\cavemem\memory\git-flow")
    if not json_dir.exists():
        print("No git-flow directory found.")
        return 0

    json_files = list(json_dir.glob("*.json"))
    print(f"\n--- Ingesting {len(json_files)} Git-Flow JSON files ---")
    count = 0
    for jf in json_files:
        try:
            with open(jf, "r", encoding="utf-8", errors="ignore") as f:
                data = json.load(f)
            
            project = data.get("project", "workspace")
            commit = data.get("commit", {})
            commit_hash = commit.get("hash", "") or commit.get("short", "") or jf.stem.split("-")[-1]
            branch = data.get("branch", "main")
            message = commit.get("message", "")
            
            summary = data.get("summary", "") or message
            impact = data.get("impact", "")
            root_cause = data.get("root_cause", "")
            fix = data.get("fix", "")
            
            rationale_parts = []
            if root_cause: rationale_parts.append(f"Root Cause: {root_cause}")
            if fix: rationale_parts.append(f"Fix: {fix}")
            if impact: rationale_parts.append(f"Impact: {impact}")
            if data.get("rationale"): rationale_parts.append(f"Rationale: {data['rationale']}")
            rationale = " | ".join(rationale_parts) if rationale_parts else message

            files_data = data.get("files", {})
            if isinstance(files_data, dict):
                files_list = files_data.get("list", [])
            elif isinstance(files_data, list):
                files_list = files_data
            else:
                files_list = []
            files_str = ", ".join(files_list) if files_list else f"{files_data.get('changed', 1)} files changed" if isinstance(files_data, dict) else "Unknown"

            # Ingest as git digest
            cmd_git = [
                sys.executable, str(CAVEMEM_STRATEGIC_SCRIPT), "git", "record",
                "--project", project,
                "--commit-hash", commit_hash[:12],
                "--branch", branch,
                "--summary", f"[{commit.get('type', 'commit')}] {summary}",
                "--files-changed", files_str[:300],
                "--rationale", rationale[:500]
            ]
            res = subprocess.run(cmd_git, capture_output=True, text=True)
            if res.returncode == 0:
                print(f"  ✓ Ingested git-flow log: {jf.name} ({project} / {commit_hash[:8]})")
                count += 1
            else:
                print(f"  ✗ Failed to ingest {jf.name}: {res.stderr}")

            # Also if there's significant architectural impact or root cause, ingest as ADR
            if root_cause or impact or data.get("split_summary"):
                tags_str = ", ".join(data.get("tags", ["git-flow", project]))
                cmd_adr = [
                    sys.executable, str(CAVEMEM_STRATEGIC_SCRIPT), "adr", "record",
                    "--project", project,
                    "--title", message if message else summary,
                    "--context", f"Issue identified in {project}. {root_cause if root_cause else ''}".strip(),
                    "--decision", fix if fix else summary,
                    "--rationale", impact if impact else rationale,
                    "--tags", tags_str
                ]
                subprocess.run(cmd_adr, capture_output=True, text=True)

        except Exception as e:
            print(f"Error parsing {jf}: {e}")
    return count


def ingest_key_markdown_docs():
    """Ingest key architectural, isolation, and audit docs."""
    docs_to_scan = [
        (r"C:\Users\Pieter\docs\claude-isolation.md", "workspace-agents", "Claude Provider & Environment Isolation Architecture"),
        (r"C:\Users\Pieter\docs\codex-isolation.md", "workspace-agents", "Codex Provider Isolation Architecture (OpenAI vs ByNara)"),
        (r"C:\Users\Pieter\daschool\SECURITY_ARCHITECTURE.md", "daschool", "Daschool Security Architecture & Access Control"),
        (r"C:\Users\Pieter\daschool\PHASE5_AUDIT_LOGGING_COMPLETE.md", "daschool", "Phase 5 Audit Logging Architecture"),
        (r"C:\Users\Pieter\daschool\PHASE6_SESSION_REVOCATION_COMPLETE.md", "daschool", "Phase 6 Session Revocation & Invalidation"),
        (r"C:\Users\Pieter\daschool\docs\advanced_prd_sec_audit_v2_reports.md", "daschool", "Advanced PRD Security Audit & Access Control"),
        (r"C:\Users\Pieter\daschool\docs\cloudflare-integration-dashboard-guide.md", "daschool", "Cloudflare Integration Dashboard Guide & Runbook"),
        (r"C:\Users\Pieter\daschool\docs\luma-style-migration-summary.md", "daschool", "Luma-Style Component Architecture Migration"),
        (r"C:\Users\Pieter\daschool\docs\dashboard-revamp-offline-execution-plan.md", "daschool", "Dashboard Revamp Architecture & Execution Plan"),
    ]

    print(f"\n--- Ingesting Key Markdown Architecture & Session Docs ---")
    count = 0
    for file_path, project, default_title in docs_to_scan:
        p = Path(file_path)
        if not p.exists():
            continue
        try:
            with open(p, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

            title = default_title
            # Find first h1
            h1_match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
            if h1_match:
                title = f"{default_title}: {h1_match.group(1)}"

            # Extract first 500 chars as context/summary
            clean_text = re.sub(r"[#*`]", "", content[:1000]).strip().replace("\n", " ")
            summary = clean_text[:400]

            # Ingest as ADR
            cmd_adr = [
                sys.executable, str(CAVEMEM_STRATEGIC_SCRIPT), "adr", "record",
                "--project", project,
                "--title", title[:150],
                "--context", f"Documented in {p.name}. {summary[:250]}",
                "--decision", f"Architecture established in {p.name}: {clean_text[250:500]}",
                "--rationale", f"Reference doc at {file_path}",
                "--tags", f"docs, architecture, {project}, {p.stem}"
            ]
            res = subprocess.run(cmd_adr, capture_output=True, text=True)
            if res.returncode == 0:
                print(f"  ✓ Ingested document: {p.name} ({project})")
                count += 1
            else:
                print(f"  ✗ Failed to ingest {p.name}: {res.stderr}")
        except Exception as e:
            print(f"Error reading {file_path}: {e}")

    return count


def main():
    print("=========================================================")
    print(" Ingesting Offline Session Docs & Logs into Vector DBs")
    print("=========================================================")
    
    c1 = ingest_git_flow_json_files()
    c2 = ingest_key_markdown_docs()

    # Sync all newly embedded records into LanceDB
    print("\n--- Synchronizing all records to LanceDB ---")
    res = subprocess.run([sys.executable, str(LANCEDB_STRATEGIC_SCRIPT), "sync"], capture_output=True, text=True)
    print(res.stdout)

    print("=========================================================")
    print(f"Ingestion complete: {c1} git-flow logs, {c2} markdown docs.")
    print("All records embedded and indexed across SQLite + LanceDB.")
    print("=========================================================")


if __name__ == "__main__":
    main()
