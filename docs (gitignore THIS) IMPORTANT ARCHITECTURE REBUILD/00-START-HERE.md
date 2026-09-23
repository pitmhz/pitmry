# PITMRY Backend Hardening — Agent Execution Runbook

Audience: coding agents with limited reasoning but strong instruction-following ability.
Target: current PITMRY backend architecture.
Primary goal: make PITMRY a trustworthy backend-first memory engine for AI agents.

This is an execution contract, not a brainstorming document. Do not redesign the architecture unless a step explicitly instructs you to.

## Non-negotiable architecture

PITMRY has one durable truth:

```text
Git-tracked .pitmry canonical records
        ↓
rebuildable projections
        ├── SQLite + FTS5
        ├── LanceDB
        ├── current-state projection
        ├── inferred association cache
        └── dashboard views
```

SQLite and LanceDB are indexes, not authoritative memory. Deleting `.pitmry-cache/` must not destroy project memory.

Never convert similarity into causality. Explicit relations such as `implements`, `supersedes`, `reverts`, `validated_by`, and `discussed_in` require evidence. Inferred relations such as `semantically_related`, `shared_files`, `temporal_neighbor`, `possible_origin`, and `possible_followup` must remain labeled as inference.

Allowed retrieval outcomes are `OK`, `NO_MATCH`, `CONFLICT`, `AMBIGUOUS`, and `DEGRADED`. No result is preferable to a false memory.

## Current files and required treatment

`server/cavemem_strategic.py`
- Preserve useful SQLite/FTS5 concepts and legacy data.
- Remove active dependence on Windows-specific default paths.
- Remove deterministic pseudo-random embedding fallback.
- Stop treating these strategic tables as permanent truth after migration.

`server/lancedb_strategic.py`
- Preserve LanceDB as a local vector index.
- Remove its duplicate embedding implementation.
- Remove pseudo-random fallback.
- Make it a compatibility wrapper or retire it after migration.

`server/scripts/memory_navigator.py`
- Preserve progressive disclosure and search/inspect/status ideas.
- Replace manual LIKE-based lexical scoring and fixed scores.
- Replace ad-hoc `0.7 semantic + 0.3 keyword` ranking.
- Parameterize project filters.
- Turn it into a wrapper over the new retrieval engine.
- Never surface inferred associations as causal history.

`server/memory_dashboard_api.py`
- Preserve dashboard compatibility and Git diff behavior.
- Remove ownership of memory truth/retrieval semantics.
- Replace heuristic causal `journey` behavior with truthful lineage data.

`server/scripts/export_session_to_memory.py`
- Preserve Git inspection and completion capture.
- Stop direct multi-write to Markdown + JSON + SQLite + LanceDB.
- Write canonical records first, then project them.
- Remove hardcoded Pieter paths.
- Never treat free-form agent rationale as human evidence.

`server/scripts/ingest_session_docs.py`
- Convert into a legacy importer.
- Remove hardcoded personal paths.
- Do not promote arbitrary docs into authoritative ADRs.
- Make repeated imports idempotent.

`app/api/memory/route.ts`
- Keep the current `execFile` bridge for the dashboard during migration.
- Demo fallback may remain UI-only and must stay visibly marked.
- New agent endpoints must never return demo records.

## New package

Create:

```text
server/pitmry/
  __init__.py
  __main__.py
  config.py
  enums.py
  models.py
  ids.py
  canonical_store.py
  capture.py
  sqlite_projection.py
  embeddings.py
  vector_projection.py
  relations.py
  state_resolver.py
  retrieval.py
  context_service.py
  rebuild.py
  doctor.py
  migration.py
  cli.py
```

Tests:

```text
server/tests/
  test_ids.py
  test_canonical_store.py
  test_projection_idempotency.py
  test_embeddings.py
  test_retrieval.py
  test_state_resolver.py
  test_relations.py
  test_rebuild.py
  test_migration.py
```

Do not put backend semantics into the Next.js route.

## Repository-local layout

After initialization:

```text
.pitmry/
  manifest.json
  schema-version
  records/
    YYYY/
      MM/
        <record-id>.json

.pitmry-cache/
  pitmry.db
  lancedb/
  state.json
  traces/
```

`.pitmry/` is Git-tracked.
`.pitmry-cache/` is ignored.

## Required record vocabulary

Record types:

```text
decision
constraint
git_change
discussion
observation
failure
checkpoint
session_summary
test_result
deployment
note
relation
```

Authority:

```text
human_direct
human_evidenced
code_verified
git_verified
runtime_verified
agent_observed
agent_reported
agent_inferred
imported_unverified
```

Truth domains:

```text
intent
implementation
runtime
history
constraint
inference
```

Do not encode `superseded`, `reverted`, or `conflicting` as arbitrary manually edited flags. The state resolver derives them from canonical relations/current records.

## Execution order

1. `01-CANONICAL-FOUNDATION.md`
2. `02-PROJECTIONS-AND-INGESTION.md`
3. `03-RETRIEVAL-AND-TRUST.md`
4. `04-AGENT-API-MIGRATION-AND-UI.md`
5. `05-TEST-AND-RELEASE-GATES.md`

Do not start retrieval work before canonical-store and rebuild tests pass.
Do not add MCP before retrieval evaluation passes.
Do not redesign the dashboard during backend phases.

## Agent prohibitions

Do not:
- delete the user's current Cavemem DB;
- mutate legacy DBs during initial migration;
- rewrite Git history;
- auto-push;
- add cloud dependencies;
- use an LLM as the default truth resolver or reranker;
- auto-download embedding models;
- turn timestamp order into causality;
- treat cosine similarity as factual confidence;
- allow an agent to self-declare `human_direct`;
- catch errors that would leave partially written canonical memory;
- return demo records from an agent-facing API.

## Completion definition

After hardening:

```bash
git clone <project>
python -m server.pitmry rebuild
python -m server.pitmry context "why was X chosen?"
```

must work from project-local canonical memory.

Deleting `.pitmry-cache/` must not lose memory.
Disabling embeddings must degrade to lexical/relational retrieval.
Superseded decisions must not be presented as current.
Semantically similar discussions must not be presented as causes without explicit relations.
Unsupported questions must be able to return `NO_MATCH`.
