---
name: memory-navigator
description: Universal guide for finding memories, architectural rationale, and git commit history in offline vector and relational databases (LanceDB + Cavemem SQLite). Teaches AI agents what to search, WHERE to look on disk, how to distill queries, and how to adaptively inspect schemas as databases expand.
---

# Memory Navigator Skill

Universal guide for AI agents to locate, search, and extract persistent developer memory.

When users switch between AI models, start fresh sessions, or ask about past decisions, incoming agents have no conversation memory. This skill teaches any agent—regardless of model size—how to retrieve past architectural decisions, commit rationales, and design trade-offs from local databases without guessing or flooding context.

---

## 1. Storage Topology

All memory runs 100% offline. No cloud service is queried.

| Storage System | Path | Purpose | What It Contains |
|---|---|---|---|
| **LanceDB Vector DB** | `~/.strategic_memory/lancedb` | Fast columnar vector search | 384-dim dense embeddings for `adrs`, `git_digests`, `grill_me_logs` |
| **SQLite Cavemem DB** | `~/.cavemem/data.db` | ACID relational storage | Raw observations, summaries, compaction checkpoints, durable memories, ADRs, commits, aliases, and FTS5 indexes |
| **Git-Flow JSON Logs** | `~/.agents/skills/cavemem/memory/git-flow/` | Machine-readable session logs | JSON records tagged by date and commit hash |
| **Markdown Session Docs** | `docs/sessions/` and `<project>/docs/sessions/` | Human-readable audit trails | Detailed Markdown summaries with architecture rationale |

---

## 2. The 4-Step Memory Retrieval Protocol

Follow these phases sequentially. Do not guess past decisions without checking memory first.

### Phase 1: Introspect & Discover (Zero Hardcoding)

Before searching, discover what tables, dimensions, and records currently exist:

```bash
python server/scripts/memory_navigator.py status
```

To see the exact columns and data types:

```bash
python server/scripts/memory_navigator.py schema
```

> [!TIP]
> Always run `schema` if you are unsure which table contains the information you need. As new tables are added, the script automatically detects and reports them.

---

### Phase 2: Distill User Questions into Search Queries

**Rule: Never pass conversational filler to vector search.** 
Phrases like *"Can you remind me why we decided to..."* pollute embedding vectors and reduce semantic similarity scores.

Strip conversational noise and identify the core technical concepts:

| User Question | Conversational Noise | High-Signal Distilled Query | Target Record Type |
|---|---|---|---|
| *"Why did we change the sidebar layout to a single wrapper?"* | *"Why did we change the... to a"* | `sidebar layout single wrapper container` | `adr` |
| *"What did we commit when fixing the base ui tooltip delay bug?"* | *"What did we commit when fixing the... bug?"* | `base ui tooltip delay delayDuration` | `commit` |
| *"What was I doing before context compacted?"* | *"What was I doing before..."* | `latest requirements progress resume` | `checkpoint` |

---

### Phase 3: Execute Hybrid Retrieval

Run hybrid search using the companion CLI tool:

```bash
# Standard search (searches all tables across LanceDB + SQLite)
python server/scripts/memory_navigator.py search "<distilled query>"

# Filter by project (e.g. pitmry, portfolio)
python server/scripts/memory_navigator.py search "<distilled query>" --project pitmry

# Filter by record type (adr, commit, grill)
python server/scripts/memory_navigator.py search "<distilled query>" --type adr

# Increase result limit (default is 5)
python server/scripts/memory_navigator.py search "<distilled query>" --limit 8
```

The search tool automatically:
1. Strips conversational filler.
2. Computes a 384-dimensional dense vector via local ONNX in <5ms.
3. Queries LanceDB tables using cosine distance.
4. Queries SQLite FTS5 for exact keyword matches.
5. Merges and ranks hits by relevance (`[vector]`, `[keyword]`, or `[hybrid]`).

---

### Phase 4: Progressive Disclosure & Inspection

The search command returns a dense summary table (~15 tokens per hit).

When you identify the top matching record:

```bash
# Inspect the complete record (context, decision, rationale, trade-offs, changed files)
python server/scripts/memory_navigator.py inspect <record-id>

# Examples:
python server/scripts/memory_navigator.py inspect adr-24
python server/scripts/memory_navigator.py inspect commit-16
```

If you need to trace why a decision was made and what consequences followed:

```bash
# Trace multi-hop causality (origin discussion -> decision -> commits)
python server/scripts/memory_navigator.py journey <record-id>
```

---

## 3. Formulating Your Final Answer

When presenting information from memory to the user:
1. **Be Direct & Concise**: State the answer first using clear language.
2. **Cite Exact Records**: Always include the record citation so the user can verify.
3. **Distinguish Facts from Inferences**: Quote the recorded rationale directly. Never invent constraints that do not exist in the record.
