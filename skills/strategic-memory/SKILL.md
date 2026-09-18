---
name: strategic-memory
description: Offline episodic & semantic vector memory engine. Search past architectural decisions, grill-me histories, and git digests before starting tasks. Export session summaries, ADRs, and commits to offline docs, Cavemem SQLite, and LanceDB after completing work.
---

# Strategic Memory & Knowledge Base Skill

Cross-project persistent memory and vector database running 100% offline. Combines **Cavemem SQLite** (`~/.cavemem/data.db`) and **LanceDB** (`~/.strategic_memory/lancedb`) with local ONNX embeddings (`Xenova/all-MiniLM-L6-v2`).

---

## 1. When to Use

### At the Start of a Task (Recall Past Context)
Before starting complex feature work, bug fixes, or architecture redesigns, search strategic memory to avoid repeating past mistakes or violating past decisions.
Use the dedicated **`memory-navigator`** skill protocol and companion CLI:

```bash
# Unified hybrid retrieval (LanceDB 384d vector + SQLite FTS5)
python server/scripts/memory_navigator.py search "<distilled task or question>"

# Inspect full details of a specific record
python server/scripts/memory_navigator.py inspect <record-id>

# Check active database topology and dynamic schema
python server/scripts/memory_navigator.py status
python server/scripts/memory_navigator.py schema
```

*Examples:*
- `python server/scripts/cavemem_strategic.py search --semantic "Next.js typegen route corruption"`
- `python server/scripts/cavemem_strategic.py search --semantic "skills catalog budget in zed"`
- `python server/scripts/cavemem_strategic.py search --semantic "claude environment isolation"`

---

## 2. When Finishing a Feature, Commit, or Milestone (Export & Store)

Whenever you finish a task, commit, push, or milestone, invoke the automated export pipeline. This automatically:
1. Writes the offline session markdown to `docs/sessions/{timestamp}-{type}.md`.
2. Writes the structured JSON log to `~/.agents/skills/cavemem/memory/git-flow/`.
3. Stores the record in `~/.cavemem/data.db` with local 384d ONNX vector embeddings.
4. Synchronizes with LanceDB columnar tables.

```bash
python server/scripts/export_session_to_memory.py \
  --project "<project-name>" \
  --type "<feat|fix|refactor|adr>" \
  --title "<commit or feature title>" \
  --summary "<what was implemented or fixed>" \
  --rationale "<why this approach was chosen, root cause, or trade-offs>" \
  --decision "<key architectural choice, if applicable>" \
  --tags "tag1, tag2"
```

---

## 3. After Design Interviews or `/grill-me` Sessions

When you finish an alignment interview or planning session with the user, preserve the agreed direction so future agent turns respect it:

```bash
python server/scripts/cavemem_strategic.py grill record \
  --project "<project-name>" \
  --topic "<interview topic>" \
  --questions "<questions explored>" \
  --answers "<user choices and answers>" \
  --key-takeaways "<core constraints established>" \
  --resolved-direction "<final agreed path>"
```

---

## 4. Backfilling / Ingesting Existing Workspace Docs

To scan and re-index all offline markdown session files, PRD reports, and git-flow history across projects into both vector databases:

```bash
python server/scripts/ingest_session_docs.py
```
