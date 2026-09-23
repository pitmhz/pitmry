# Phase 3 — Retrieval, Trust, Supersession, and Abstention

## Goal

Replace heuristic retrieval with deterministic hybrid retrieval. The backend must resolve historical/current state before a model sees context.

## 1. `relations.py`

Expose explicit and inferred edges separately:

```python
{
    "explicit": [...],
    "inferred": [...]
}
```

Canonical relation records are the only source of explicit relations.

Semantic similarity, time ordering, and shared files are inference only.

## 2. `state_resolver.py`

Resolve:

```text
CURRENT
HISTORICAL
SUPERSEDED
REVERTED
CONFLICTING
UNKNOWN
```

Rules:
- `new --supersedes--> old` makes old `SUPERSEDED`.
- explicit `reverts` makes target `REVERTED`.
- timestamps alone never supersede.
- vector similarity never changes state.
- newer does not automatically mean authoritative.

For deterministic conflict detection, decision/constraint records may carry `subject_key` in content.

Example:

```json
{"subject_key":"cms.primary","decision":"Use Sanity"}
```

Two active decisions with same `subject_key`, no supersession between them -> `CONFLICTING`.

Do not use an LLM to infer contradictions in v1.

## 3. Real FTS5 lexical retrieval

In `retrieval.py`, implement FTS5 `MATCH` + `bm25()`.

Use parameterized SQL.

Project filter must use `?`, never string interpolation.

Do not assign every keyword match score `0.65`.

Keep query sanitizer logic, moved to the new engine.

## 4. Vector retrieval

If embedding unavailable:
- return no vector candidates;
- add degraded warning;
- continue lexical retrieval.

Filter by project.

Vector similarity is a retrieval signal, never factual confidence.

## 5. Candidate model

Track separate signals:

```text
record_id
lexical_rank
vector_rank
vector_similarity
rrf_score
reasons
```

Do not collapse early into one opaque score.

## 6. Reciprocal Rank Fusion

Use RRF, default `k=60`.

For each candidate:

```text
score += 1 / (k + rank)
```

Use independent lexical and vector ranks.

Delete active use of `semantic * 0.7 + keyword * 0.3`.

Do not normalize BM25 into cosine similarity.

## 7. Query mode

Use deterministic rules, not an LLM:

```text
CURRENT
HISTORICAL
EXACT
GENERAL
```

Current signals: `current`, `currently`, `now`, `what are we using`, `active`.

Historical signals: `original`, `previous`, `before`, `why did we`, `history`.

Exact mode: canonical ID, Git SHA, strong path-like lookup.

Keep query distillation conservative.

## 8. Metadata/state handling

After fusion:
- require project match;
- exact ID/SHA matches outrank fuzzy retrieval;
- explicit relations can expand context;
- current queries demote superseded/reverted records;
- historical queries may rank them normally;
- do not globally boost newest records.

Authority influences how a result is described, not whether its text is relevant.

## 9. Graph expansion

Normal context:
- start with top retrieval candidates;
- expand explicit relations by one hop;
- deduplicate.

Lineage:
- allow up to two explicit hops.

Do not include semantic neighbors as authoritative lineage.

If requested, inferred associations appear only under `possibly_related`.

## 10. Abstention

Return `NO_MATCH` when:
- no lexical match;
- no exact match;
- no explicit related match;
- best vector match is below configured floor.

The vector floor remains configurable and must later be calibrated by evaluation.

A missing vector engine can coexist with `NO_MATCH` plus warning.

`DEGRADED` describes component health; it does not authorize weak results.

## 11. `context_service.py`

This is the default interface for weak models.

Input:

```text
query
project_id
max_records
character/token budget
```

Pipeline:

```text
classify
→ lexical
→ vector if available
→ RRF
→ resolve current state
→ explicit graph expansion
→ conflict handling
→ abstention
→ dedupe
→ budgeted serialization
```

Output separates:
- current;
- historical;
- evidence;
- conflicts;
- warnings.

## 12. Context record contract

Expose:
- id;
- type;
- title;
- summary;
- authority;
- truth domain;
- resolved state;
- created time;
- short provenance;
- retrieval reasons.

Do not return raw vectors.

Do not dump full Grill-Me question/answer history by default.

## 13. Trust rendering

Do not flatten these:

```text
human_evidenced
git_verified
agent_inferred
```

Example:
- human evidence can establish intent;
- Git can establish commit history;
- agent inference remains an inference.

Never rewrite an inferred rationale into authoritative prose.

## 14. Refactor `memory_navigator.py`

Make it a compatibility CLI over the new backend.

`search` -> new retriever.
`inspect` -> canonical store.
`status` -> doctor/status.
`schema` -> canonical + projection schema.
`journey` -> alias to truthful `lineage`.

Add `--explain`.

Do not retain active table-specific ADR/Git/Grill search code.

## 15. Replace heuristic causal journey

Current heuristic relationships must be mapped to inference labels only:

```text
originated_from -> possible_origin
authorized_by -> semantically_related
implemented_by -> possible_followup unless explicit relation exists
hotfixed_by -> shared_files or possible_followup
followed_by -> temporal_neighbor
```

Never show inferred `ADR Authorized`.

## 16. Explain traces

Optional explain output should include:
- lexical rank;
- vector rank;
- RRF score;
- exact match;
- state;
- graph expansion source;
- reasons.

Normal context output should remain compact.

## 17. Mandatory scenarios

Test:
1. Payload decision superseded by Sanity -> Sanity current.
2. Historical query can retrieve Payload.
3. Cassandra absent -> `NO_MATCH`.
4. Embedder unavailable + FTS match -> correct result with warning.
5. Vector paraphrase works when vector engine available.
6. Similar Grill + commit without relation -> no causal edge.
7. Explicit `implements` -> lineage returns it.
8. Two active same-subject decisions -> `CONFLICT`.

## Acceptance

Do not continue until:
- active lexical retrieval uses FTS5/BM25;
- no fixed keyword score remains;
- no 70/30 score mixing remains;
- project SQL is parameterized;
- inferred edges cannot become causal;
- `NO_MATCH` is tested;
- vector support can be completely disabled.
