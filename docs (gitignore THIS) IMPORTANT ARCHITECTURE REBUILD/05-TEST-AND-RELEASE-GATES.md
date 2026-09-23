# Phase 5 — Tests, Evaluation, and Release Gates

## Goal

Prove PITMRY does not manufacture memory.

Use standard-library unit tests unless the project deliberately adopts another runner:

```bash
python -m unittest discover -s server/tests -v
```

All tests use temporary data.

## 1. Required unit coverage

Canonical layer:
- deterministic IDs;
- identical retry;
- conflicting rewrite rejected;
- hash stability;
- malformed relation rejected;
- atomic writes.

Projection:
- one canonical record -> one row;
- repeated projection -> one row;
- FTS row produced;
- cache rebuild from scratch.

Embeddings:
- correct dimensions;
- unavailable model raises `EmbeddingUnavailable`;
- no pseudo-random fallback;
- vector projection can be skipped;
- tests do not download a model.

State:
- supersession;
- reversion;
- conflict;
- timestamp alone does not supersede;
- inferred relation cannot change state.

Retrieval:
- FTS-only;
- vector-only mocked/fixture;
- RRF ordering;
- exact ID;
- exact SHA;
- project isolation;
- `NO_MATCH`;
- degraded vector mode;
- current vs historical handling.

## 2. Security tests

SQL injection-like project string must not leak other projects.

Path traversal such as `../../outside` must be rejected by source/path APIs.

A memory record containing text like "ignore prior instructions" remains passive data and causes no backend action.

Agent writes cannot spoof human authority.

## 3. Migration fixture

Create a synthetic legacy DB with:
- 2 ADRs;
- 2 Grill logs;
- 3 Git digests.

Run migration twice.

Expected:
- same canonical IDs/count;
- no causal relations invented;
- unresolved Git references remain `imported_unverified`;
- verifiable commits may become `git_verified`.

## 4. Rebuild test

1. create canonical records;
2. rebuild;
3. query and save result IDs;
4. delete `.pitmry-cache`;
5. rebuild again;
6. query again.

Expected identical canonical identities and equivalent state resolution.

## 5. Gold evaluation corpus

Create:

```text
.pitmry/eval/gold.jsonl
```

Positive example:

```json
{
  "id": "cms-current",
  "query": "what CMS are we using now?",
  "mode": "CURRENT",
  "expected_any": ["dec_sanity"],
  "forbidden_current": ["dec_payload"],
  "should_abstain": false
}
```

Negative example:

```json
{
  "id": "cassandra-none",
  "query": "why did we choose Cassandra?",
  "expected_any": [],
  "forbidden_current": [],
  "should_abstain": true
}
```

At least 25% of early evaluation questions should test abstention.

## 6. Metrics

Report:
- Recall@1;
- Recall@5;
- MRR;
- abstention accuracy;
- false-memory rate;
- supersession accuracy;
- conflict accuracy;
- cross-project leakage;
- p50/p95 latency.

False-memory means PITMRY presents a record as current/authoritative when the gold data says it is irrelevant, forbidden, superseded, reverted, from another project, or unsupported.

False-memory rate matters more than raw recall.

## 7. Initial release gates

Target:

```text
false-memory rate <= 2%
abstention accuracy >= 95%
supersession accuracy = 100% on deterministic fixtures
conflict accuracy = 100% on deterministic fixtures
cross-project leakage = 0
```

Always print raw counts as well as percentages.

## 8. Performance targets

Warm local targets:

```text
FTS p95 <= 150 ms
hybrid p95 <= 750 ms
context p95 <= 1200 ms
```

Measure embedding cold start separately.

Correctness wins over small latency improvements.

## 9. Regression report

Every retrieval algorithm change should produce before/after:

```text
Recall@5
MRR
Abstention
False-memory
p95 latency
```

Do not merge a change that materially worsens false-memory merely because recall rises.

## 10. `pitmry doctor`

Doctor should report components independently:

```json
{
  "status": "degraded",
  "canonical": "healthy",
  "sqlite": "healthy",
  "fts": "healthy",
  "vectors": "unavailable",
  "warnings": ["VECTOR_RETRIEVAL_UNAVAILABLE"]
}
```

Missing vectors do not mean canonical memory is corrupt.

Check:
- manifest;
- canonical validation;
- duplicate IDs;
- broken explicit relation targets;
- cache schema;
- stale hashes;
- embedding metadata;
- vector dimension;
- SQLite integrity;
- Git availability.

## 11. Forbidden-pattern grep

Before release search active code for:

```text
C:\Users\Pieter
RandomState(seed)
score = 0.65
semantic_score * 0.7
project = '{project}'
```

These strings may exist in migration fixtures/docs but not active engine behavior.

Also search for duplicate active `class LocalEmbedder`.

Only one canonical write path and one active embedder implementation should remain.

## 12. Manual acceptance

Run:

```bash
python -m server.pitmry doctor
python -m server.pitmry validate
python -m server.pitmry rebuild
python -m server.pitmry context "What is the current backend memory architecture?"
python -m server.pitmry context "What did we use before it?"
python -m server.pitmry context "Why did we adopt Cassandra?"
```

The unsupported Cassandra query should return `NO_MATCH` unless real evidence exists.

Disable embeddings and repeat a lexically answerable query:
- result should still work;
- warning should report vector degradation;
- no random semantic result appears.

## Final release checklist

Backend:
- one canonical truth;
- cache fully rebuildable;
- no fake embeddings;
- no automatic model download;
- real FTS5 lexical search;
- RRF;
- idempotent ingestion;
- project isolation;
- explicit/inferred separation;
- supersession/conflict/no-match tested;
- provenance present;
- agent authority cannot be spoofed;
- legacy migration non-destructive.

Agent:
- `context` sufficient for normal memory;
- `search/get/lineage` provide progressive disclosure;
- weak model needs no DB knowledge;
- context clearly distinguishes current/history/inference.

UI:
- dashboard still loads;
- explicit/inferred edges distinguishable;
- state badges truthful;
- demo data remains UI-only.

Portability:
- no active personal paths;
- `.pitmry-cache` ignored;
- `.pitmry` Git-portable;
- platform path behavior tested.
