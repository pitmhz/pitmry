---
name: cavemem
description: Persistent memory support. Use when the user asks to remember, store, or retrieve context across sessions.
---

# Cavemem Persistent Memory

Use the Cavemem memory tools when available to store or retrieve persistent memory.

## Rules
- Preserve user-specific context and preferences across turns.
- Store noteworthy facts, constraints, and project details when relevant.
- Retrieve prior memory before answering if the context may depend on earlier sessions.
- Do not invent memory entries; only store facts the user provided or confirmed.
- Before work that depends on history, run `python server/scripts/memory_navigator.py search` with distilled technical keywords. It searches observations, summaries, checkpoints, promoted memories, ADRs, and git digests.
- After context compaction, prefer the latest project-scoped checkpoint, then inspect related summaries or raw observations only as needed.
- Treat `<private>...</private>` content and credential-shaped values as non-memory; Cavemem redacts them before storage.
