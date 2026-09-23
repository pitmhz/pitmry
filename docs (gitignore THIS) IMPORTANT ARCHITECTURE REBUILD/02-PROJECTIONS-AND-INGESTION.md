# Phase 2 — Rebuildable Projections and Deterministic Ingestion

## Goal

Project canonical records into fast local indexes. All databases created in this phase are disposable.

The only normal write order is:

```text
canonical record
      ↓
SQLite/FTS projection
      ↓
LanceDB vector projection if available
```

Never write a durable memory first to SQLite or LanceDB.

## 1. `server/pitmry/sqlite_projection.py`

Use `.pitmry-cache/pitmry.db`.

Create normalized tables:

```sql
CREATE TABLE records (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    record_type TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    authority TEXT NOT NULL,
    truth_domain TEXT NOT NULL,
    created_at TEXT NOT NULL,
    content_json TEXT NOT NULL,
    provenance_json TEXT NOT NULL,
    related_files_json TEXT NOT NULL,
    related_symbols_json TEXT NOT NULL,
    tags_json TEXT NOT NULL,
    content_hash TEXT NOT NULL
);

CREATE TABLE relations (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    relation TEXT NOT NULL,
    source_record_id TEXT NOT NULL,
    target_record_id TEXT NOT NULL,
    provenance TEXT NOT NULL,
    created_at TEXT NOT NULL,
    evidence_json TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    content_hash TEXT NOT NULL
);

CREATE TABLE projection_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

Add indexes for project, type, date, relation source/target/type.

## 2. FTS5

Create one FTS table:

```sql
CREATE VIRTUAL TABLE records_fts USING fts5(
    id UNINDEXED,
    title,
    summary,
    searchable_content,
    tags,
    related_files,
    tokenize='porter unicode61'
);
```

Projection code explicitly inserts FTS rows. Do not use old table-specific search logic.

Build `searchable_content` by type:
- decision: context + decision + rationale + trade-offs;
- git_change: commit subject + semantic summary + changed files + evidenced rationale;
- discussion: topic + takeaways + human answers;
- failure: symptom + cause + resolution;
- checkpoint/session summary: summary + open work.

Do not put vector data or arbitrary metadata into FTS.

## 3. Idempotency

Projection uses canonical IDs as primary keys.

Repeated projection of the same record must not create another row.

Use upsert only when content hash changed.

## 4. `server/pitmry/embeddings.py`

There must be exactly one embedding implementation.

Define `EmbeddingUnavailable` and `LocalEmbedder`.

Required behavior:
- no deterministic random fallback;
- no pseudo-vector;
- no network model download;
- missing model -> `EmbeddingUnavailable`;
- runtime failure -> `EmbeddingUnavailable`;
- expose model name and dimensions;
- validate output dimension.

If a local SentenceTransformer fallback is retained, it may only load an explicit local path with network disabled.

Do not call `SentenceTransformer("all-MiniLM-L6-v2")` in a way that can fetch from the internet.

## 5. `server/pitmry/vector_projection.py`

Use one LanceDB table:

```text
records
```

Columns:

```text
id
project_id
record_type
title
summary
authority
truth_domain
created_at
content_hash
embedding_model
vector
```

Use canonical record IDs.

LanceDB never owns unique content that does not exist in canonical records.

## 6. Embedding text builder

Implement one deterministic:

```python
build_embedding_text(record)
```

Do not embed raw JSON.

Use stable labeled text, e.g.:

```text
Decision: ...
Summary: ...
Context: ...
Rationale: ...
Files: ...
Tags: ...
```

Write tests for deterministic output.

## 7. Projection metadata

Store:
- schema version;
- canonical snapshot/hash;
- embedding model;
- dimensions;
- projection timestamp.

If embedding model/dimensions change, rebuild vector projection.

Do not mix incompatible embeddings.

## 8. `server/pitmry/rebuild.py`

Implement:

```bash
python -m server.pitmry rebuild
python -m server.pitmry rebuild --no-vectors
```

Safe rebuild algorithm:

```text
validate all canonical records
        ↓
if invalid: abort without touching active cache
        ↓
create temporary cache directory
        ↓
build SQLite + FTS
        ↓
build vectors if available
        ↓
run integrity checks
        ↓
atomically replace active cache
```

Never delete the working cache before a replacement passes validation.

Missing embedding support is degraded mode, not rebuild failure.

## 9. `server/pitmry/capture.py`

Add canonical capture functions:

```text
capture_git_change
capture_decision
capture_discussion
capture_session_summary
capture_checkpoint
capture_failure
capture_relation
```

These functions write canonical records only.

A caller may incrementally project after canonical success.

If projection fails, preserve canonical data and report cache stale/degraded.

## 10. Git capture

Capture objective Git data:
- full SHA;
- parent SHAs;
- branch at capture time;
- author;
- timestamps;
- subject;
- changed files;
- insertion/deletion counts when available;
- stable patch-id when available.

Use:
- authority `git_verified`;
- truth domain `history`;
- source type `git_commit`;
- source ID full SHA.

Never truncate the canonical commit identity.

Do not infer that a commit implements a decision. Create an explicit `implements` relation only when a specific decision ID is provided and validated.

## 11. Stable patch identity

Attempt to compute stable patch ID from Git. Store it as metadata.

Failure is non-fatal.

Patch ID helps recognize cherry-pick/rebase equivalents but does not replace canonical record identity.

## 12. Refactor `export_session_to_memory.py`

Keep its CLI temporarily.

New flow:

```text
parse legacy args
resolve repo/project
capture session_summary
capture current git commit if available
capture decision only if explicitly supplied
create only validated explicit links
project new canonical records
optionally emit human Markdown
```

Remove:
- direct call to legacy strategic DB writer;
- direct LanceDB sync;
- global git-flow JSON as primary machine truth;
- hardcoded `C:\Users\Pieter` fallback.

Agent-supplied rationale defaults to `agent_reported` unless evidence establishes stronger authority.

## 13. Refactor `ingest_session_docs.py`

Convert to legacy importer.

Required:
- paths from CLI/config only;
- no hardcoded personal doc list;
- deterministic source IDs;
- `--dry-run`;
- imported docs default `imported_unverified`;
- repeated import is no-op;
- arbitrary architecture Markdown is not automatically a decision.

## 14. Legacy migration

Create `migration.py` with:

```bash
python -m server.pitmry migrate-legacy --db <path> --dry-run
python -m server.pitmry migrate-legacy --db <path>
```

Legacy ADR -> `decision`, `imported_unverified`, domain `intent`.

Legacy Grill -> `discussion`, `imported_unverified`.

Legacy Git digest -> `git_change`.
Use `git_verified` only when the referenced commit can actually be resolved; otherwise `imported_unverified`.

Do not convert current heuristic journey links into explicit relationships.

## 15. Tests

Prove:
- repeated projection does not duplicate;
- cache deletion + rebuild restores equivalent IDs;
- missing embeddings still produce valid lexical cache;
- no fake vector can be created;
- migration repeated twice creates same canonical set;
- full Git SHA retained;
- no active ingestion code contains Pieter-specific absolute paths.

## Acceptance

Run all tests, then delete `.pitmry-cache/`, rebuild with `--no-vectors`, and verify search-ready SQLite/FTS projection is recreated without changing `.pitmry/`.
