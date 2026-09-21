# LanceDB Retrieval Assessment

Date: 2026-09-20

## Result

LanceDB is operational and helps recover stored strategic context. It works well for the records that it indexes. It is not yet a complete semantic memory layer for the current database.

Ease of finding information: 6/10.

The command path is clear, the results identify their source, and record inspection gives usable detail. The score is reduced by incomplete LanceDB coverage, unclear score reporting in the direct LanceDB CLI, and fixed-score hybrid ranking.

## Database scan

The health scan found:

| Store | Data found |
| --- | --- |
| LanceDB | 51 vectors in 3 tables: 29 ADRs, 21 git digests, and 1 Grill-Me log |
| SQLite | 1,465 observations, 46 summaries, 29 ADRs, 21 git digests, 1 checkpoint, and 1 durable memory item |
| Embedder | Local `all-MiniLM-L6-v2`, 384 dimensions, available |

SQLite passed its integrity check. The memory navigator reported the overall topology as operational.

## Retrieval tests

| Query | Expected memory | Result | Assessment |
| --- | --- | --- | --- |
| `how do agents restore reliable context after conversation compaction` | Memory reliability decision | `adr-37`, rank 1, vector result | Pass. A paraphrased question recovered the relevant ADR. |
| `two-tier progressive skills architecture strict 50 KB limit` | Zed skill-budget decision | `grill-1`, only result, vector result | Pass. It recovered the exact decision and trade-off. |
| `Apache Arrow disk backed columnar semantic search offline Windows` | Strategic-memory architecture | `adr-13`, rank 1, vector result | Pass. It recovered the LanceDB architecture record. |
| `phase0 reliability smoke app api memory route` with the current project filter | Current project checkpoint | `memory-1` and `checkpoint-1`, keyword results | Partial pass. The information is easy to retrieve, but LanceDB did not index it. |

Record inspection confirmed useful details from `adr-37`, `grill-1`, and `checkpoint-1`. For example, `adr-37` states that SQLite is the canonical ledger and LanceDB is its semantic index. `grill-1` records the 50 KB Zed limit and the on-demand skill-routing choice.

## Findings

1. LanceDB semantic retrieval works for indexed strategic records. The first three tests returned the intended record at rank 1.
2. LanceDB indexes only ADRs, git digests, and Grill-Me logs. Checkpoints, durable memories, summaries, and observations remain SQLite-only for retrieval.
3. The direct `server/lancedb_strategic.py search` command prints `0.0000` for every returned score. Its ranking may be correct, but its displayed similarity values are not useful.
4. The hybrid navigator uses fixed scores for several SQLite result types. This can place a keyword checkpoint above a stronger semantic result without a calibrated relevance comparison.
5. The current corpus is small. It has 51 vectors, so these tests confirm function, not a statistically reliable recall rate.

## Improvement plan

### P0: Make relevance observable

Update `server/lancedb_strategic.py` to use an explicit cosine metric and report the raw LanceDB distance plus the same normalized score formula used by the memory navigator. Add a test that checks score ordering and rejects all-zero output.

Success condition: a direct search shows distinct, non-zero distances and normalized similarities for known records.

### P1: Index recovery records in LanceDB

Add a general vector table for checkpoints, durable memory items, and summaries. Include record type, stable ID, project, timestamp, title, content, tags, and the embedding. Extend the sync/export path so these records update incrementally after each write.

Success condition: a paraphrased project-resume query returns `checkpoint-1` as a vector or hybrid result, not keyword-only.

### P2: Improve hybrid ranking and duplicates

Replace hard-coded SQLite scores with normalized lexical scores. Combine semantic relevance, lexical relevance, record type, project match, and recency. Group a checkpoint and its promoted durable-memory copy as one result with related-record links.

Success condition: results explain their score and source, and duplicate recovery records do not take two top positions.

### P3: Add a repeatable benchmark

Create a versioned JSON benchmark with 15 to 30 queries across ADRs, commits, Grill-Me records, checkpoints, summaries, and no-result cases. Record expected IDs, target rank, source requirement, and latency. Run it from the CLI and emit JSON for CI or dashboard use.

Success condition: the benchmark reports recall at 1 and 3, mean reciprocal rank, source coverage, index freshness, and p95 latency.

### P4: Explain retrieval in the dashboard

Show each result's source, score components, indexed timestamp, and whether it was vector, keyword, or hybrid. Add a status warning when SQLite records are not represented in LanceDB.

Success condition: a user can tell whether a result came from semantic memory, exact text search, or both, and can see index lag.

## Recommended order

Do P0 and P3 first. They make later changes measurable. Then implement P1 because it closes the main memory-recovery gap. Do P2 and P4 after the expanded index produces real mixed-source results.
