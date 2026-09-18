#!/usr/bin/env python3
"""
cavemem_search.py - Quick search wrapper for Strategic Memory
Usage:
  python cavemem_search.py <query>            # keyword + semantic search
  python cavemem_search.py --semantic <query> # semantic only
  python cavemem_search.py --keyword <query>  # keyword/FTS5 only
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from cavemem_strategic import StrategicMemoryDB, sanitize_fts_query, LocalEmbedder


def main():
    args = sys.argv[1:]
    if not args:
        print("Usage: python cavemem_search.py [--semantic|--keyword] <query>")
        sys.exit(1)

    mode = "unified"
    if args[0] == "--semantic":
        mode = "semantic"
        args = args[1:]
    elif args[0] == "--keyword":
        mode = "keyword"
        args = args[1:]

    query = " ".join(args)
    db = StrategicMemoryDB()
    results = db.unified_search(query, limit=5)
    
    print(f"\nSearch ({mode}): '{query}'")
    print("-" * 50)
    
    TABLE_KEYS = {"adrs", "grill_me_logs", "git_semantic_digests"}
    for table, rows in results.items():
        if table not in TABLE_KEYS or not isinstance(rows, list) or not rows:
            continue
        print(f"\n{table} ({len(rows)}):")
        for r in rows:
            if not isinstance(r, dict):
                continue
            score = r.get('score', 0)
            title = r.get('title', r.get('topic', r.get('message', str(r))))
            project = r.get('project', '')
            snippet = str(r.get('summary', r.get('rationale', r.get('key_takeaways', ''))))[:100]
            print(f"  \u2022 [{project}] {title} [score: {score:.4f}]")
            if snippet:
                print(f"    {snippet}...")


if __name__ == "__main__":
    main()
