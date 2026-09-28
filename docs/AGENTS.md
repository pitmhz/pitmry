# PITMRY Codebase Audit, Case Study, and SEO Landing-Page Copy

**Repository audited:** [gitlab.com/pitmhs/pitmry](https://gitlab.com/pitmhs/pitmry)  
**Audit date:** 2026-09-27  
**Deliverable scope:** repository audit, product interpretation, case-study narrative, schema-versus-PRD argument, single-page website structure, finished landing-page copy, and SEO recommendations.

---

## Executive verdict

PITMRY is not simply a memory dashboard and it is not merely a vector database for old AI conversations.

Its central product thesis is:

> AI-assisted software development needs a durable, evidence-aware project state that survives individual chats, context windows, branches, worktrees, and agents.

The repository implements a local-first foundation for that thesis:

- immutable-style canonical records stored under `.pitmry/`;
- deterministic identities and content hashes;
- Git-portable project memory;
- disposable, rebuildable SQLite/FTS5 and optional LanceDB projections;
- explicit separation between evidence-backed and inferred relations;
- trust-aware retrieval that can return `NO_MATCH`, `CONFLICT`, `DEGRADED`, or `AMBIGUOUS`;
- authority and truth-domain metadata;
- state resolution through explicit supersession and reversion;
- a CLI, local dashboard, HTTP bridge, optional MCP server, and opt-in Git hooks;
- a substantial, partially implemented Project Intelligence workflow connecting source artifacts, requirements, work, sessions, implementation, verification, and incidents.

The repository tells its audience that the bottleneck in serious AI coding is no longer only code generation. It is continuity, provenance, coordination, and knowing what is actually true.

The strongest positioning is therefore:

> **PITMRY is local-first project intelligence for AI-assisted development: durable project memory, evidence-linked execution, and compact context agents can trust.**

The repository also contains an important product caveat. Its canonical-memory and retrieval foundation is concrete and implemented. The broader Project Intelligence vision is explicitly documented as a proposed product target with partial implementation. The code contains meaningful intake, planning, session, verification, incident, context, and readiness services, but the current canonical dataset does not yet contain Project Intelligence requirements, phases, work units, sessions, implementations, verifications, bugs, fixes, or regressions.

That distinction should remain visible in any public case study or landing page.

---

# Part I — Repository audit

## 1. Audit coverage

The review covered:

- the root folder and tracked-file tree;
- repository state and recent Git history;
- root setup and configuration files;
- all Markdown documentation;
- the architecture-rebuild archive;
- documented session histories;
- repository skills and agent instructions;
- the Next.js application and API routes;
- the Python backend;
- canonical record models and storage;
- SQLite/FTS5 and LanceDB projections;
- retrieval, context construction, state resolution, and relation handling;
- Project Intelligence services;
- the CLI and MCP interface;
- the compatibility dashboard adapter;
- scripts, hooks, launchers, and tests;
- the repository’s own `.pitmry` manifest and canonical records.

No repository files were modified. The worktree was clean at the end of the audit.

## 2. Repository profile

At audit time, the repository contained:

- **216 tracked files**;
- approximately **39,290 tracked lines**;
- **36 tracked Markdown files**;
- **49 tracked Python files**;
- **76 tracked TypeScript/TSX files**;
- **42 tracked JSON files**;
- **28 canonical `.pitmry` records**.

The canonical records currently comprise:

- 11 decisions;
- 16 Git changes;
- 1 session summary.

The repository includes no pre-commit configuration and no CI configuration was found in the tracked tree.

Recent history shows a deliberate architecture progression:

1. establish the canonical store;
2. harden canonical memory;
3. close retrieval and trust work;
4. close agent API, migration, UI, tests, and release-gate phases;
5. add Project Intelligence workflows;
6. document the Project Intelligence release and architecture status.

## 3. Technology stack

### Frontend

- Next.js 16.3.6;
- React 19.2.4;
- TypeScript;
- Tailwind CSS 4;
- Base UI and reusable local primitives;
- Hugeicons and Lucide;
- Three.js for the legacy spatial/vector view;
- Prism React Renderer for code diffs;
- Motion and utility-class tooling.

### Backend

- Python 3.10+;
- standard-library dataclasses for canonical schemas;
- SQLite and FTS5;
- optional LanceDB;
- local ONNX Runtime and tokenizer support for embeddings;
- NumPy and scikit-learn;
- optional MCP support.

### Interfaces

- Python CLI;
- Next.js dashboard;
- Next.js HTTP routes that invoke the local Python backend;
- optional MCP tools for coding agents;
- opt-in, fail-open Git post-commit integration.

## 4. Operational verification

The canonical store and local projection path were operationally checked.

The following rebuild completed successfully:

```bash
python -m server.pitmry rebuild --no-vectors
```

It rebuilt a disposable SQLite/FTS projection from the 28 canonical records.

Canonical validation reported:

```json
{
  "valid": true,
  "problems": []
}
```

The doctor command reported:

```json
{
  "status": "degraded",
  "canonical": "healthy",
  "sqlite": "healthy",
  "fts": "healthy",
  "vectors": "unavailable",
  "git": "healthy",
  "project_intelligence_projection": "healthy",
  "project_intelligence": "healthy",
  "warnings": [
    "VECTOR_RETRIEVAL_UNAVAILABLE"
  ]
}
```

This result illustrates an intentional design property: unavailable vector search degrades retrieval but does not make canonical memory unhealthy.

The full automated test suite was not run as part of this content audit.

---

# Part II — What the repository tells its audience

## 5. The product story encoded in the repository

The repository communicates five linked ideas.

### 5.1 Project context is a data problem, not a prompt-length problem

Software intent and history are distributed across PRDs, architecture notes, decisions, discussions, commits, tests, failures, branches, worktrees, and deployment evidence.

Putting more documents into a prompt may increase the amount of text available to a model, but it does not answer:

- which statement is current;
- which source is authoritative;
- which requirement a commit implements;
- whether a test verifies a requirement or merely ran nearby;
- whether verification still applies to the current code;
- whether two documents conflict;
- which decision superseded another;
- what work is ready;
- what remains blocked;
- what previously failed.

PITMRY treats these as project-modeling questions rather than context-window questions.

### 5.2 Durable truth should not live inside a derived database

The canonical records under `.pitmry/` are the durable source of truth. SQLite, FTS5, and LanceDB are projections.

This is a meaningful architectural statement:

- indexes can be deleted;
- vector models can change;
- retrieval algorithms can improve;
- local caches can become corrupt;
- the project’s memory remains reconstructable from Git-tracked records.

The design turns “the database” from irreplaceable state into a replaceable view.

### 5.3 Retrieval must expose uncertainty

PITMRY does not force every query into a confident answer.

The vocabulary includes:

- `OK`;
- `NO_MATCH`;
- `CONFLICT`;
- `DEGRADED`;
- `AMBIGUOUS`;
- `UNKNOWN`.

This matters because the most dangerous project memory is not missing memory. It is plausible but incorrect memory delivered without qualification.

The architecture archive states the priority clearly:

> Correct memory > no memory > possibly useful memory > confidently wrong memory.

### 5.4 Similarity is useful for discovery, not proof

PITMRY separates:

- **explicit relations**, which are evidence-backed canonical claims; and
- **inferred relations**, which are search hints generated from vector neighbors, shared files, or temporal proximity.

An inferred association cannot silently:

- supersede a decision;
- prove that a commit implements a requirement;
- establish causality;
- explain why a change happened;
- promote agent output to human authority.

This is one of the repository’s clearest differentiators from generic retrieval-augmented chat systems.

### 5.5 Implementation and verification are different facts

The Project Intelligence model records implementation separately from verification.

A session may produce:

- changed files;
- changed symbols;
- a commit;
- test records;
- a build result;
- limitations;
- unresolved work;
- linked decisions and bugs.

That evidence can move work to `IMPLEMENTED`.

It does not automatically move work to `VERIFIED`.

Verification requires:

- a resolvable full commit SHA;
- a recorded implementation included in that commit;
- required passing build/test evidence when the completion policy requires it;
- all mandatory acceptance criteria;
- canonical evidence for each criterion;
- an allowed verification authority;
- consistent result values.

This distinction prevents “code exists” from being misrepresented as “the intended behavior is proven.”

---

# Part III — Why the authors cared to solve this problem

## 6. Evidence-based interpretation of motivation

The repository does not provide a personal founder interview, so individual motivation should not be invented. The architecture and implementation do, however, reveal the problems the author considered important.

### 6.1 Repeated context reconstruction is waste

The documentation repeatedly describes sessions having to rediscover:

- architecture;
- previous decisions;
- rejected approaches;
- current requirements;
- old failures;
- implementation lineage;
- unfinished work.

The agent instructions themselves require querying PITMRY before revisiting architecture, bugs, rejected approaches, or user decisions. This makes the repository its own case study: the project uses a memory protocol to reduce repeated reconstruction of the project that implements the memory protocol.

### 6.2 Long documents decay after implementation starts

A PRD is strongest when it captures initial intent. After work begins, reality spreads across:

- clarification decisions;
- changed requirements;
- code;
- commits;
- test outcomes;
- bugs;
- fixes;
- regressions;
- release gates.

Without a structured continuity layer, the original document becomes either stale or overloaded with manually maintained status.

### 6.3 AI agents need bounded contracts, not an entire archive

The Project Intelligence services create a session contract containing:

- the work objective;
- scoped paths and symbols;
- linked requirements;
- mandatory acceptance criteria;
- dependencies;
- active decisions;
- known incidents;
- previous failed attempts;
- readiness.

This is a more useful execution input than asking an agent to read every document and infer the assignment again.

### 6.4 The system should remain private and portable

The architecture is local-first and does not require a cloud service to store or query canonical records.

That choice serves projects that need:

- private source context;
- offline access;
- project-local history;
- Git reviewability;
- tool independence;
- reproducible state.

### 6.5 Agent autonomy needs guardrails

The repository assumes agents can help decompose, retrieve, plan, implement, and verify work, but it does not assume their conclusions are automatically authoritative.

Examples include:

- imported decomposition remains `PROPOSED`;
- baseline approval requires interactive human confirmation;
- critical reconciliation conflicts block approval unless resolved or explicitly waived;
- CLI-created decisions remain `agent_reported`;
- human verification requires human evidence and interactive confirmation;
- bug closure requires explicit confirmation;
- MCP cannot record human-confirmed verification;
- unknown history can return `NO_MATCH`;
- conflict is preserved instead of silently resolved.

The design is therefore pro-agent but anti-unearned certainty.

---

# Part IV — The case study

## 7. Case-study title

### From Prompt Context to Project Intelligence: How PITMRY Builds Durable Memory for AI-Assisted Software Development

## 8. Case-study summary

As AI coding tools become capable of implementing larger changes, software teams encounter a continuity problem. An agent can often understand the current task, but it does not naturally retain the project’s evolving intent, decisions, failed attempts, implementation evidence, verification history, and incident lineage across sessions.

PITMRY addresses that problem by turning project knowledge into Git-tracked canonical records and explicit relations. It preserves source artifacts, separates human-confirmed intent from agent inference, creates dependency-aware work units, records implementation independently from verification, and supplies coding agents with bounded context rather than indiscriminate document dumps.

The result is an architecture for project continuity: local, rebuildable, evidence-aware, and designed to abstain when the project record cannot support an answer.

## 9. The situation

AI-assisted development introduces a paradox.

The agent can generate code quickly, but every new session may begin with partial awareness:

- a PRD without the later clarifications;
- current code without the original rationale;
- Git history without the user intent behind it;
- tests without a direct link to the acceptance criteria;
- a bug fix without the incident context;
- a branch without awareness of parallel work;
- a summary that compresses away provenance.

Teams attempt to solve this by pasting more context into prompts. They attach multiple PRDs, architecture documents, ticket exports, session summaries, and diffs, then ask the model to “understand the project.”

That approach can help, but it makes the model perform project reconstruction during every execution session. It also gives the model an ambiguous mix of old and new claims and asks it to infer authority, causality, and current state.

## 10. The core challenge

The challenge is not merely storing information. It is preserving the relationships and trust boundaries that make information actionable.

A useful project-continuity system must answer:

1. What was requested?
2. Where did the request come from?
3. Has a human accepted that interpretation?
4. What other work must happen first?
5. Which session owns the work?
6. What changed?
7. Which commit contains the change?
8. What evidence shows the acceptance criteria passed?
9. Is that evidence still valid for the current code?
10. What failed, what fixed it, and what remains open?

Generic document retrieval does not inherently answer these questions.

## 11. The approach

PITMRY models project continuity as:

```text
source intent
    ↓
requirement
    ↓
work unit
    ↓
session
    ↓
implementation
    ↓
verification
    ├── current state
    └── incident
          ↓
         fix
          ↓
    reverification
```

The broader product model is:

```text
project intent graph
+
implementation ledger
+
verification ledger
+
incident history
+
retrieval engine
```

### 11.1 Preserve the source

Markdown source intake records:

- the original text;
- repository-relative path;
- content hash;
- title;
- ingestion status.

The source is not replaced by an AI summary. It remains the origin against which proposed requirements can be reviewed.

### 11.2 Make decomposition reviewable

Externally prepared requirement decompositions must include:

- a temporary key;
- a requirement kind;
- a statement;
- a source locator;
- optional priority and subject identity;
- acceptance criteria.

The importer validates duplicate identities, allowed kinds, source locators, and criterion structure. Imported records begin as `PROPOSED`.

This treats AI decomposition as a proposal, not as project truth.

### 11.3 Reconcile contradictions before baselining

PITMRY can record:

- duplicates;
- overlaps;
- dependencies;
- conflicts;
- missing prerequisites;
- terminology mismatches.

Critical reconciliation records block baseline approval until resolved or explicitly waived with a human reason.

Baseline approval requires typing the project name in an interactive terminal. Accepted requirements and their criteria receive explicit lifecycle events rather than silent field edits.

### 11.4 Convert intent into bounded work

Accepted requirements can be organized into phases and work units.

Each work unit contains:

- an objective;
- linked requirements;
- scoped paths and symbols;
- a completion policy;
- risk;
- optional release-gate status.

Dependencies are explicit and checked for cycles.

Readiness reports explain why work is blocked, including:

- unverified dependencies;
- inactive blocking decisions;
- absent linked requirements;
- unaccepted requirements;
- missing or unaccepted mandatory criteria;
- dependency cycles;
- unresolved critical reconciliations;
- superseded or already completed work;
- an active lease owned by another session.

### 11.5 Give agents an execution contract

When ready work is claimed, PITMRY creates a session and lease.

The agent receives a bounded contract with the information relevant to that work:

- objective;
- scope;
- requirements;
- acceptance criteria;
- dependencies;
- active decisions;
- known incidents;
- previous failed attempts;
- readiness.

The lease prevents two sessions from silently owning the same work unit. Cross-process checkout locking and expiration handling provide local coordination.

### 11.6 Record implementation without overstating completion

Finishing a session can record:

- changed files;
- changed symbols;
- full commit SHA;
- structured tests;
- build result;
- reuse/extend/replace/create analysis;
- limitations;
- linked decisions;
- linked bugs;
- unresolved work.

This produces an implementation record and closes the session lease.

The state becomes `IMPLEMENTED`, not `VERIFIED`.

### 11.7 Verify against criteria and a code snapshot

Verification binds evidence to:

- a work unit;
- mandatory acceptance criteria;
- canonical evidence records;
- a full Git commit;
- a verification type and authority.

The system checks that the verification commit contains a recorded implementation commit.

Possible verification authorities include:

- automated/code-verified;
- agent-reviewed;
- human-confirmed;
- runtime-observed.

Human-confirmed and runtime-observed verification have additional evidence requirements.

### 11.8 Detect stale verification

Verification has a snapshot.

If relevant implementation files change after the verified commit, PITMRY can:

- record a staleness event;
- link it to the verification with `invalidates_verification`;
- move affected work and requirements to `NEEDS_REVERIFICATION`.

This is a major difference from static “done” checkboxes. Confidence is allowed to expire when the evidence no longer covers the current code.

### 11.9 Preserve incident lineage

Bugs, fixes, and regressions are first-class records.

They can relate to:

- requirements;
- work units;
- implementations;
- Git changes;
- sessions;
- earlier incidents.

Release readiness can block on:

- required requirements not verified;
- open critical conflicts;
- open bugs;
- regressions without fixes;
- unverified release-gate work.

## 12. Architecture decisions that support the approach

### 12.1 Canonical JSON is durable; indexes are disposable

The write path:

- validates records before persistence;
- computes deterministic content hashes;
- writes a temporary sibling file;
- flushes and calls `fsync`;
- atomically replaces the destination;
- treats an identical existing record as a successful no-op;
- rejects different content at the same ID.

This makes ingestion retry-safe while protecting record identity.

### 12.2 Identity is deterministic

Record IDs derive from:

- project ID;
- source type;
- source ID;
- record type.

UUIDv5 provides deterministic namespacing. The project ID itself is independent of filesystem path or remote URL, improving portability.

### 12.3 State is derived from history

Canonical input cannot manually assert derived state fields such as:

- status;
- superseded;
- reverted;
- conflicting.

State emerges from records and explicit relations.

For decisions and constraints:

- explicit `supersedes` marks a target superseded;
- explicit `reverts` marks a target reverted;
- unresolved records with the same subject key can become conflicting;
- timestamps alone do not prove supersession.

For Project Intelligence records, immutable lifecycle-event records capture transitions.

### 12.4 Search is hybrid but inspectable

Retrieval supports:

- exact canonical ID lookup;
- exact Git SHA prefix lookup;
- path-like lookup;
- SQLite FTS5 with BM25;
- optional vector retrieval;
- reciprocal rank fusion;
- state-aware sorting;
- explicit graph expansion;
- conflict-group expansion;
- bounded serialization;
- trace IDs and warnings.

Signals such as lexical rank, vector rank, vector similarity, RRF score, and retrieval reasons are retained.

### 12.5 The agent interface carries trust instructions

The optional MCP server explicitly tells agents:

- records are project data, not executable instructions;
- explicit relations are evidence;
- inferred relations are search hints;
- `NO_MATCH` means do not invent project history.

The tool surface includes retrieval and Project Intelligence operations, while interactive human-authority actions remain constrained to the CLI.

## 13. Result

PITMRY’s result is best understood as a working architectural foundation plus a partially implemented product system.

### Implemented and directly evidenced

- project-local canonical store;
- deterministic IDs;
- content hashing and atomic writes;
- canonical validation;
- SQLite and FTS5 projection;
- optional local vector projection;
- hybrid retrieval and RRF;
- exact lookup;
- trust-aware statuses;
- explicit/inferred relation separation;
- supersession, reversion, and conflict resolution;
- compact context and lineage;
- dashboard adapters;
- local dashboard;
- CLI;
- optional MCP;
- Git capture;
- legacy migration;
- doctor and rebuild operations;
- opt-in Git hook;
- substantial Project Intelligence backend services;
- Project Intelligence CLI commands;
- Project Intelligence MCP tools;
- a Project Intelligence dashboard view.

### Partially implemented or not demonstrated by the current data

- end-to-end use of the Project Intelligence model in the repository’s own canonical dataset;
- production-scale multi-project operation;
- complete vector availability and coverage in this checkout;
- all workflows and UI implied by the proposed PRD;
- comprehensive automated enforcement through CI;
- external collaboration, hosted synchronization, team permissions, or cloud operation;
- independent customer outcomes or adoption metrics.

## 14. Why this matters to developer workflow

PITMRY’s contribution is not faster text generation. It is a better boundary between planning and execution.

For developers, that can mean:

- fewer repeated architecture explanations;
- smaller, more relevant agent contexts;
- explicit blockers instead of guessed readiness;
- traceable requirement-to-code lineage;
- clear separation between “implemented” and “verified”;
- reusable incident history;
- less dependence on one chat transcript or vendor memory;
- project state that travels with Git;
- the ability to rebuild indexes locally;
- safer handoffs between humans and agents.

For AI agents, it can mean:

- a bounded objective;
- accepted requirements;
- mandatory criteria;
- current decisions;
- known failure history;
- clear ownership;
- explicit evidence;
- permission to abstain.

For maintainers, it can mean:

- inspectable provenance;
- no silent rewriting of history;
- deterministic reconstruction;
- reviewable project-state changes;
- clearer release blockers.

---

# Part V — Why structured schemas are stronger than multiple large PRDs

## 15. The balanced argument

PITMRY does not make PRDs unnecessary.

PRDs remain valuable source artifacts. They explain goals, users, constraints, and desired behavior.

The repository’s stronger argument is:

> A PRD is an input to project intelligence, not a complete execution and verification system.

Teams should prefer a structured, evidence-linked project schema whenever they need reliable multi-session AI work, auditability, coordination, or release confidence.

## 16. Failure modes of “attach every PRD and hope”

### 16.1 No stable identity

A paragraph in a document may be reworded, duplicated, or moved. Without a stable requirement identity, it is difficult to link:

- a work unit;
- a commit;
- an acceptance criterion;
- a verification result;
- an incident.

### 16.2 No authority boundary

A document dump may mix:

- approved requirements;
- brainstorms;
- generated summaries;
- rejected alternatives;
- stale constraints;
- inferred relationships.

The model must guess which claims have authority.

PITMRY labels authority and truth domain.

### 16.3 No lifecycle

Text does not inherently communicate:

- proposed;
- accepted;
- planned;
- in progress;
- implemented;
- verified;
- stale;
- blocked;
- regressed;
- superseded;
- rejected.

PITMRY records lifecycle events.

### 16.4 No contradiction protocol

Two PRDs can conflict. A later date does not always mean one supersedes the other.

PITMRY can preserve a conflict, require reconciliation, or record explicit supersession.

### 16.5 No dependency graph

Document order is not execution order.

Requirements may depend on:

- other work;
- decisions;
- migrations;
- security constraints;
- data availability;
- release checks.

PITMRY models dependencies and explains blockers.

### 16.6 No execution ownership

A document does not prevent two agents from implementing the same work in parallel.

PITMRY sessions and leases provide local ownership semantics.

### 16.7 No proof of implementation

A PRD cannot prove which commit implemented a requirement.

Git proves code history, but Git alone does not prove user intent.

PITMRY connects these truth domains through explicit records and relations.

### 16.8 No proof of verification

A test log in a prompt may not establish:

- which criterion it covers;
- which commit it tested;
- who or what observed the result;
- whether the evidence still applies.

PITMRY binds criterion results to canonical evidence and a code snapshot.

### 16.9 No staleness handling

Even valid verification can become stale after relevant code changes.

A static PRD checkbox remains checked. PITMRY can move the work to `NEEDS_REVERIFICATION`.

### 16.10 Poor token economics

Large repeated context:

- consumes tokens;
- increases latency;
- introduces irrelevant details;
- makes contradictions harder to detect;
- encourages broad summarization;
- must be reconstructed in every session.

A bounded contract retrieves only what the current work needs.

## 17. Side-by-side comparison

| Concern | Multiple large PRDs in a prompt | PITMRY-style structured project state |
|---|---|---|
| Source preservation | Documents are attached, often summarized | Original source snapshot and hash retained |
| Requirement identity | Paragraph or heading | Stable canonical record ID |
| Authority | Usually implicit | Explicit authority class |
| Truth domain | Mixed | Intent, implementation, runtime, history, constraint, inference |
| Current state | Model infers from wording/date | Derived from explicit records and events |
| Contradictions | Model may silently choose | `CONFLICT` or reconciliation record |
| Dependencies | Buried in prose | Explicit graph edges and cycle checks |
| Agent assignment | Broad prompt | Bounded session contract |
| Ownership | External coordination required | Session lease |
| Implementation evidence | Often a summary or diff | Implementation and Git records |
| Verification | Frequently conflated with implementation | Separate criterion-linked verification |
| Staleness | Manual | Code-snapshot and file-change checks |
| Incidents | Tickets or chat history | Bugs, fixes, regressions linked to work |
| Retrieval | Entire documents or opaque semantic search | Exact, lexical, optional vector, explicit graph expansion |
| Uncertainty | Answer pressure | `NO_MATCH`, `CONFLICT`, `DEGRADED`, `AMBIGUOUS` |
| Portability | Tool- or chat-dependent | Project-local, Git-tracked canonical records |
| Rebuildability | Varies by vendor | Projections rebuilt from canonical records |

## 18. Concrete example

Imagine three documents:

- Product PRD: “Users must be able to export reports.”
- Security PRD: “Exports must not include secrets.”
- Platform PRD: “All exports must be asynchronous.”

An agent receiving all three still has to infer:

- whether these statements refer to the same export feature;
- whether all are accepted;
- whether “asynchronous” is a hard requirement or a future goal;
- whether another decision superseded it;
- which acceptance criteria apply;
- whether secret redaction must precede async job work;
- which tests prove compliance;
- whether the current implementation has been reverified after export code changed.

A structured model can represent:

```text
source_artifact: Product PRD
  └── requirement: Export reports

source_artifact: Security PRD
  └── requirement: Exports exclude secrets

source_artifact: Platform PRD
  └── requirement: Exports execute asynchronously

work_unit: Implement redaction
  └── implements: Exports exclude secrets

work_unit: Implement export worker
  ├── implements: Export reports
  ├── implements: Exports execute asynchronously
  └── depends_on: Implement redaction

verification:
  ├── verifies: Implement export worker
  ├── target_snapshot: <commit>
  └── criteria:
      ├── export completes
      ├── secret fixture absent
      └── request returns before worker finishes
```

The documents remain the source. The schema makes their implications executable, inspectable, and retrievable.

## 19. When a schema is essential

A structured project-intelligence layer becomes especially valuable when:

- work spans multiple agent sessions;
- several PRDs or specifications overlap;
- requirements change during implementation;
- multiple branches or worktrees are active;
- decisions need auditability;
- tests must map to acceptance criteria;
- regulated or security-sensitive work needs provenance;
- regressions must be traced to requirements and fixes;
- release readiness must be explainable;
- the project will outlive the current model, chat, or vendor.

For a one-off script, a detailed prompt may be sufficient. For sustained engineering, durable structure becomes part of the development infrastructure.

---

# Part VI — Audience and positioning

## 20. Primary audiences

### 20.1 Developers who use coding agents across many sessions

Their problem:

- every session starts with context reconstruction;
- old decisions and failed attempts are repeatedly rediscovered;
- prompts become larger while confidence remains low.

Message:

> Give every coding session the project context it needs without replaying the entire project.

### 20.2 Maintainers of long-lived repositories

Their problem:

- the “why” behind code disappears;
- decisions and implementation drift apart;
- tests prove behavior without preserving intent.

Message:

> Keep intent, code, verification, and incident history connected as the repository evolves.

### 20.3 Technical leads coordinating humans and agents

Their problem:

- unclear work readiness;
- duplicate implementation;
- dependencies hidden in prose;
- no reliable execution handoff.

Message:

> Turn accepted intent into dependency-aware, claimable work with explicit blockers.

### 20.4 Privacy-conscious or local-first teams

Their problem:

- project knowledge is sensitive;
- hosted memory can create lock-in;
- opaque indexes are difficult to audit.

Message:

> Keep durable project memory in the repository and rebuild search locally.

### 20.5 Builders of agentic developer tools

Their problem:

- raw RAG does not provide authority, lifecycle, or causality;
- tool output needs trust boundaries;
- long context is expensive and unreliable.

Message:

> Use a project graph designed for evidence-aware agent retrieval, not just semantic similarity.

## 21. Positioning statement

For developers and teams using AI coding agents on long-lived software projects, PITMRY is a local-first project intelligence engine that turns source requirements, decisions, Git history, implementation evidence, verification, and incidents into durable, retrievable project state.

Unlike chat history, generic vector memory, or repeated PRD dumps, PITMRY preserves provenance, separates evidence from inference, exposes uncertainty, and gives each session bounded context linked to the code.

## 22. Category options

Recommended primary category:

- **Local-first project intelligence for AI-assisted development**

Supporting category language:

- durable project memory;
- AI coding-agent context engine;
- evidence-aware software project graph;
- Git-native engineering memory;
- project continuity infrastructure.

Avoid leading with:

- “AI memory dashboard” — too generic and undersells the execution model;
- “vector database” — inaccurate because vectors are optional projections;
- “PRD generator” — the product preserves and operationalizes source intent;
- “agent framework” — PITMRY provides memory, context, and project-state services rather than a full agent runtime;
- “fully autonomous development” — contradicted by the human review and authority model.

## 23. Messaging pillars

### Pillar 1 — Durable

Project memory lives in Git-tracked canonical records, not a transient chat or irreplaceable index.

### Pillar 2 — Evidence-aware

Explicit relations carry evidence. Similarity remains a discovery signal.

### Pillar 3 — Bounded

Agents receive task-relevant contracts rather than the entire project archive.

### Pillar 4 — Verifiable

Implementation and verification are separate, and verification is tied to criteria and a commit.

### Pillar 5 — Honest

The system can report no match, conflict, ambiguity, or degraded retrieval.

### Pillar 6 — Local-first

Canonical state remains project-local and rebuildable without a required cloud service.

---

# Part VII — Single-page website hierarchy

## 24. Recommended page structure

1. **Header**
   - Logo/wordmark
   - How it works
   - Architecture
   - Project Intelligence
   - GitLab
   - Primary CTA

2. **Hero**
   - Product category
   - Primary outcome
   - One-sentence explanation
   - Primary and secondary CTA
   - Product-state note

3. **Problem**
   - “Your project has memory. Your agent gets fragments.”
   - Four failure modes

4. **Core transformation**
   - “From document dumps to durable project state”
   - Before/after comparison

5. **Workflow**
   - Source → requirements → work → session → implementation → verification → incidents/reverification

6. **Canonical memory architecture**
   - Git-tracked `.pitmry`
   - Rebuildable SQLite/FTS5
   - Optional vectors
   - Dashboard/CLI/MCP

7. **Trust and retrieval**
   - evidence versus inference;
   - authority and truth domains;
   - conflict and abstention;
   - exact + lexical + vector retrieval.

8. **Project Intelligence**
   - requirement intake;
   - reconciliation and baseline;
   - phases and work readiness;
   - session contracts and leases;
   - implementation evidence;
   - criterion-linked verification;
   - staleness and incidents.

9. **Why not just paste every PRD?**
   - side-by-side comparison;
   - concise schema argument.

10. **Developer workflow benefits**
    - developers;
    - leads;
    - agents;
    - maintainers.

11. **Local-first and private**
    - project-local durable state;
    - no required cloud;
    - Git portability;
    - disposable indexes.

12. **What exists today**
    - implemented foundation;
    - partial Project Intelligence status;
    - honest roadmap framing.

13. **Repository evidence**
    - technologies;
    - architecture principles;
    - interfaces;
    - open-source repository CTA.

14. **FAQ**

15. **Final CTA**

16. **Footer**
    - GitLab;
    - GitHub mirror if desired;
    - documentation;
    - status wording.

---

# Part VIII — Finished landing-page copy

## 25. Header

**Wordmark:** PITMRY

**Navigation:**

- How it works
- Architecture
- Project Intelligence
- Why schemas
- FAQ
- GitLab

**Header CTA:** Explore the repository

## 26. Hero

**Eyebrow**

Local-first project intelligence for AI-assisted development

**H1**

Stop making every AI coding session rediscover your project.

**Supporting copy**

PITMRY turns PRDs, decisions, Git history, implementation evidence, tests, bugs, and fixes into durable project context that agents can retrieve across sessions.

Keep the source. Preserve the evidence. Give each agent only the context its work requires.

**Primary CTA**

Explore PITMRY on GitLab

**Primary CTA URL**

`https://gitlab.com/pitmhs/pitmry`

**Secondary CTA**

See how project memory works

**Hero trust line**

Git-tracked canonical records · Rebuildable local indexes · Optional vector search · CLI, dashboard, and MCP

**Product-state note**

The canonical-memory and retrieval foundation is implemented. The broader Project Intelligence model is actively evolving and partially implemented.

## 27. Problem section

**Section eyebrow**

The continuity gap

**H2**

Your project has memory. Your agent gets fragments.

**Body**

The reason behind a feature may live in a PRD. A later clarification may live in chat. The implementation lives in Git. The proof lives in test output. The failure lives in an incident. The fix lives on another branch.

The information exists, but the connections disappear.

So every new AI session starts reconstructing the same project:

**Problem card 1**

### Intent goes stale

PRDs describe the starting point, not every decision made after implementation begins.

**Problem card 2**

### Similarity looks like truth

Semantic search can find related text, but related does not mean authoritative, current, or causal.

**Problem card 3**

### “Implemented” becomes “verified”

A code change is evidence that work happened. It is not proof that every acceptance criterion passed.

**Problem card 4**

### Context gets larger, not clearer

Adding more documents increases tokens without resolving conflicts, dependencies, ownership, or current state.

**Closing line**

PITMRY replaces repeated project reconstruction with durable, evidence-linked project state.

## 28. Transformation section

**Section eyebrow**

From prompts to project state

**H2**

Do not ask an agent to infer the whole project every time.

**Intro**

Keep PRDs as source artifacts. Then turn their accepted meaning into stable requirements, acceptance criteria, explicit dependencies, bounded work, implementation evidence, and verification tied to code.

**Before column heading**

### Document-dump workflow

- Attach several large PRDs.
- Add architecture notes and old summaries.
- Ask the model to determine what is current.
- Hope it notices contradictions.
- Let it infer dependencies.
- Repeat in the next session.

**After column heading**

### PITMRY workflow

- Preserve the original source and hash.
- Import proposed requirements with source locators.
- Review conflicts before accepting a baseline.
- Plan dependency-aware work units.
- Start sessions with bounded execution contracts.
- Record implementation and verification separately.
- Reverify when relevant code changes.

**Pull quote**

The PRD remains the source. The schema makes it operational.

## 29. Workflow section

**Section eyebrow**

End-to-end continuity

**H2**

Follow intent from source to verified software.

**Step 1**

### 1. Preserve source intent

Ingest repository-local Markdown without replacing the original text. Record its path, title, and content hash.

**Step 2**

### 2. Propose structured requirements

Decompose the source into stable requirements and acceptance criteria with exact source locators. Proposals remain proposals.

**Step 3**

### 3. Reconcile and approve

Surface duplicates, overlaps, dependencies, conflicts, missing prerequisites, and terminology mismatches before accepting a baseline.

**Step 4**

### 4. Plan executable work

Connect accepted requirements to phases and bounded work units. Validate dependencies, mandatory criteria, release gates, and blockers.

**Step 5**

### 5. Give the agent a contract

Start a session with the objective, scope, requirements, acceptance criteria, decisions, incidents, dependencies, and failed attempts relevant to that work.

**Step 6**

### 6. Capture implementation evidence

Record changed files, symbols, commits, tests, builds, limitations, unresolved work, and linked decisions without pretending implementation equals verification.

**Step 7**

### 7. Verify at a code snapshot

Evaluate every mandatory criterion using canonical evidence at a resolvable Git commit.

**Step 8**

### 8. Detect drift and incidents

Mark verification stale when relevant implementation files change. Link bugs, fixes, and regressions back to the work they affect.

## 30. Canonical architecture section

**Section eyebrow**

Durable by design

**H2**

Your project memory should survive its index.

**Body**

PITMRY stores durable records inside the project:

```text
.pitmry canonical records
        ↓
rebuildable projections
        ├── SQLite + FTS5
        ├── optional LanceDB vectors
        ├── current-state views
        └── dashboard data
```

Delete the cache and rebuild it. Change the retrieval model and reindex it. The canonical project history remains in Git.

**Feature point**

### Deterministic identity

Stable project-local IDs make repeated ingestion safe and give requirements, decisions, commits, and evidence durable references.

**Feature point**

### Immutable-style history

New evidence creates a new record or relation. Earlier claims are not silently rewritten.

**Feature point**

### Atomic local writes

Validation, content hashing, temporary files, `fsync`, and atomic replacement protect canonical records.

**Feature point**

### Rebuildable search

SQLite, full-text search, and vectors are useful projections—not the only copy of project memory.

## 31. Trust section

**Section eyebrow**

Context agents can question

**H2**

Useful memory must know when it does not know.

**Body**

PITMRY does not turn every search result into a project fact.

**Trust card**

### Evidence is explicit

Relations such as `implements`, `supersedes`, `verifies`, and `fixes` require canonical evidence.

**Trust card**

### Inference stays labeled

Semantic similarity, shared files, and temporal proximity can suggest where to look. They cannot establish causality or authority.

**Trust card**

### Authority travels with the record

Human intent, Git facts, runtime evidence, agent observations, and agent inferences are distinct classes.

**Trust card**

### Conflict is a valid answer

When active claims disagree, PITMRY can return `CONFLICT` instead of choosing the most convenient text.

**Trust card**

### Missing memory stays missing

`NO_MATCH` means the project record does not support an answer. The agent should not invent one.

**Trust card**

### Degraded search is visible

If vector retrieval is unavailable, lexical retrieval can continue with an explicit warning.

## 32. Retrieval section

**Section eyebrow**

Hybrid retrieval, bounded output

**H2**

Retrieve the evidence. Do not replay the archive.

**Body**

PITMRY combines exact lookup, SQLite FTS5, optional local vectors, reciprocal-rank fusion, current-state resolution, explicit graph expansion, and conflict handling.

The result is compact context organized into:

- current records;
- historical records;
- evidence;
- conflicts;
- optional inferred associations;
- warnings and trace information.

**Closing line**

The goal is not maximum context. It is sufficient, inspectable context for the current decision.

## 33. Project Intelligence section

**Section eyebrow**

Beyond memory retrieval

**H2**

Turn project knowledge into executable continuity.

**Intro**

PITMRY’s Project Intelligence model connects what the project asked for to what agents changed, how the work was checked, and what happened afterward.

**Feature**

### Requirement intake

Preserve source documents and import proposed requirements with locators and acceptance criteria.

**Feature**

### Human-reviewed baselines

Resolve critical contradictions before proposed interpretation becomes accepted project intent.

**Feature**

### Dependency-aware readiness

See exactly why work is ready or blocked before an agent starts.

**Feature**

### Session contracts and leases

Give agents bounded assignments and prevent silent duplicate ownership of the same work.

**Feature**

### Implementation ledger

Capture commits, changed files, tests, builds, limitations, and unresolved work.

**Feature**

### Verification ledger

Verify mandatory criteria using canonical evidence at a specific code snapshot.

**Feature**

### Staleness detection

Move verified work back to `NEEDS_REVERIFICATION` when relevant code changes.

**Feature**

### Incident history

Connect bugs, fixes, and regressions to requirements, work, sessions, implementations, and Git changes.

**Status note**

Project Intelligence is a proposed product target with partial implementation. The repository includes substantial backend, CLI, MCP, projection, and dashboard support, while the full documented product model remains in development.

## 34. Schema-versus-PRD section

**Section eyebrow**

Why structured project state

**H2**

Large PRDs explain the project. They do not run it.

**Body**

Multiple documents can preserve rich intent, but they do not automatically provide stable identity, authority, lifecycle, dependencies, ownership, implementation lineage, verification, or staleness.

PITMRY keeps the documents and adds the structure required for reliable execution.

**Comparison row**

**PRD:** “Build export.”  
**Structured state:** Requirement ID, source locator, acceptance criteria, dependency graph, work owner, implementation record, verification commit, incident lineage.

**Comparison row**

**PRD:** “This decision changed.”  
**Structured state:** New decision with an explicit, evidenced `supersedes` relation.

**Comparison row**

**PRD:** “Tests passed.”  
**Structured state:** Criterion-level results, canonical evidence, verification authority, and target snapshot.

**Comparison row**

**PRD:** “Done.”  
**Structured state:** Implemented, verified, stale, blocked, regressed, superseded, or rejected—with reasons.

**Closing statement**

Use documents to express intent. Use schemas to preserve identity, evidence, and state.

## 35. Benefits section

**Section eyebrow**

Built for the whole development loop

**H2**

One project record. Better handoffs for humans and agents.

**Audience card**

### For developers

Stop re-explaining architecture and rediscovering old failures. Start with the decisions and evidence relevant to the work.

**Audience card**

### For technical leads

See accepted intent, dependency blockers, active work, verification coverage, incidents, and release gates.

**Audience card**

### For AI coding agents

Receive a bounded contract with objective, scope, requirements, criteria, decisions, and known risks.

**Audience card**

### For maintainers

Trace why code exists, what it implements, how it was verified, and when that verification became stale.

## 36. Local-first section

**Section eyebrow**

Private, portable, inspectable

**H2**

Keep durable project intelligence with the project.

**Body**

Canonical records live in `.pitmry/` and can be reviewed, versioned, branched, and transported with Git. No cloud service is required to store or query them.

**Point**

### Offline-first

Core storage, validation, lexical search, state resolution, and context construction run locally.

**Point**

### Vendor-independent memory

The durable record is not trapped inside one model’s chat history or one vector database.

**Point**

### Reproducible projections

Rebuild local indexes from canonical records whenever models, algorithms, or machines change.

**Point**

### Security-aware boundaries

Retrieved documents are treated as passive project data, not as instructions with higher authority.

## 37. Evidence section

**Section eyebrow**

Grounded in implementation

**H2**

An architecture you can inspect.

**Body**

The repository includes:

- canonical schemas and atomic storage;
- SQLite/FTS5 and optional LanceDB projections;
- trust-aware retrieval and context services;
- explicit state and conflict resolution;
- Git capture and migration tooling;
- Project Intelligence lifecycle services;
- CLI and optional MCP interfaces;
- a local Next.js dashboard;
- tests for canonical behavior, projections, migration, retrieval, and trust boundaries.

**CTA**

Read the source on GitLab

**CTA URL**

`https://gitlab.com/pitmhs/pitmry`

## 38. Current-state section

**Section eyebrow**

What exists today

**H2**

Implemented foundation. Expanding product surface.

**Implemented column**

### Available in the repository

- Git-tracked canonical records;
- deterministic IDs and hashes;
- validation and rebuild;
- SQLite/FTS5 search;
- optional local vector search;
- trust-aware context and lineage;
- explicit/inferred relation separation;
- state, conflict, supersession, and reversion handling;
- CLI, dashboard, HTTP bridge, and optional MCP;
- intake, planning, session, verification, incident, and readiness services.

**Evolving column**

### Still evolving

- full end-to-end Project Intelligence adoption;
- complete workflow coverage across the dashboard;
- production-scale retrieval evaluation;
- complete local vector availability in every setup;
- broader multi-user and operational workflows;
- the complete proposed PRD.

**Closing line**

PITMRY is an implementation-backed exploration of how durable project intelligence can make AI-assisted development more reliable.

## 39. FAQ copy

### What is PITMRY?

PITMRY is a local-first project memory and project intelligence engine for AI-assisted software development. It stores durable project records in Git and builds local search and dashboard projections from them.

### Is PITMRY a vector database?

No. Vector search is optional. The durable source of truth is the canonical `.pitmry` record store. SQLite, FTS5, and LanceDB are rebuildable projections.

### Does PITMRY replace PRDs?

No. PITMRY preserves source documents and turns their reviewed meaning into stable requirements, acceptance criteria, dependencies, work units, evidence, and lifecycle state.

### Why not give an AI agent every project document?

Large document sets provide text, but they do not automatically identify what is current, authoritative, implemented, verified, stale, blocked, or in conflict. PITMRY adds that structure and retrieves only the context relevant to the current work.

### How does PITMRY prevent hallucinated project history?

It distinguishes explicit evidence from inferred associations, carries authority and provenance, and allows `NO_MATCH`, `CONFLICT`, `AMBIGUOUS`, and `DEGRADED` outcomes.

### What is a canonical record?

A canonical record is a durable project-local JSON statement with stable identity, type, authority, truth domain, provenance, content hash, and optional relations to other records.

### What happens if the search index is deleted?

The local projections can be rebuilt from the canonical records. Deleting `.pitmry-cache/` should not delete project memory.

### Is PITMRY cloud-based?

No cloud service is required for canonical storage or local querying. Optional integrations may have separate requirements.

### How does PITMRY know whether work is ready?

Readiness checks linked requirements, mandatory acceptance criteria, dependency state, blocking decisions, open critical reconciliations, dependency cycles, completion state, and active work leases.

### Does finishing implementation mark work complete?

It marks work implemented. Verification is separate and requires criterion-level evidence tied to a Git commit.

### Can verification become stale?

Yes. PITMRY can compare the verification snapshot with later code changes and mark affected work as needing reverification.

### Can AI agents change human-approved project truth?

Agents can submit observations, proposals, implementation evidence, and supported verification. Human-authority operations such as baseline approval and human-confirmed verification require explicit interactive confirmation.

### Is Project Intelligence fully complete?

No. The repository describes it as a proposed product target with partial implementation. A substantial subset exists in backend services, CLI commands, MCP tools, projections, and the local dashboard.

## 40. Final CTA

**H2**

Give your next AI coding session a project record—not another document dump.

**Body**

Explore PITMRY’s local-first architecture for durable project memory, evidence-aware retrieval, and verifiable AI-assisted development.

**Primary CTA**

Explore the GitLab repository

**Primary URL**

`https://gitlab.com/pitmhs/pitmry`

**Secondary CTA**

Read the architecture

## 41. Footer copy

**Short description**

PITMRY is a local-first project memory and Project Intelligence engine for AI-assisted software development.

**Footer links**

- GitLab
- GitHub
- Architecture
- Project Intelligence PRD
- Backend specification

**Status line**

Canonical-memory foundation implemented. Project Intelligence partially implemented and evolving.

---

# Part IX — SEO package

## 42. Recommended SEO title

**PITMRY — Local-First Project Intelligence for AI Agents**

Alternative:

**PITMRY — Durable Project Memory for AI Coding Agents**

## 43. Meta description

Turn PRDs, decisions, Git history, tests, bugs, and fixes into durable, evidence-linked project context for AI-assisted development.

Alternative:

PITMRY gives AI coding agents local-first project memory, trust-aware retrieval, bounded work context, and verification linked to Git.

## 44. Recommended URL

For a dedicated marketing page:

`/project-intelligence-for-ai-agents`

For the primary product homepage:

`/`

## 45. Primary keyword targets

- project intelligence for AI agents;
- AI coding agent memory;
- project memory for developers;
- local-first AI developer tools;
- durable context for AI coding;
- Git-native project memory;
- AI-assisted software development workflow;
- context engine for coding agents.

## 46. Secondary keyword targets

- persistent memory for AI agents;
- developer knowledge graph;
- PRD to implementation workflow;
- requirement traceability for AI development;
- AI agent context management;
- evidence-aware RAG for code;
- local vector search for code projects;
- software decision history;
- implementation verification ledger;
- AI coding workflow orchestration;
- project continuity for software agents;
- Git-tracked engineering knowledge.

## 47. Semantic keyword clusters

### Cluster A — Memory and context

- persistent project context;
- long-term memory for coding agents;
- cross-session agent memory;
- bounded context retrieval;
- software project knowledge base;
- project history retrieval.

### Cluster B — Requirements and planning

- structured PRD workflow;
- requirements decomposition;
- acceptance criteria tracking;
- dependency-aware planning;
- work readiness;
- requirement-to-code traceability.

### Cluster C — Evidence and trust

- provenance;
- authority;
- evidence-backed relations;
- conflict detection;
- abstention;
- retrieval confidence;
- explicit versus inferred relationships.

### Cluster D — Verification

- implementation evidence;
- verification evidence;
- code snapshot verification;
- stale verification;
- reverification;
- regression tracking;
- release readiness.

### Cluster E — Local-first architecture

- offline developer tools;
- local-first project memory;
- Git-portable data;
- rebuildable indexes;
- SQLite FTS5;
- local vector database;
- private AI developer workflow.

## 48. Search intent

The page should target users who are:

- looking for persistent memory for coding agents;
- comparing long-context prompting with structured agent memory;
- trying to operationalize PRDs for AI development;
- seeking local/private alternatives to hosted AI memory;
- building requirement-to-code traceability;
- investigating trustworthy RAG for software engineering;
- coordinating multiple agents, sessions, branches, or worktrees.

## 49. Recommended H1 and heading map

```text
H1: Stop making every AI coding session rediscover your project

H2: Your project has memory. Your agent gets fragments
H2: Do not ask an agent to infer the whole project every time
H2: Follow intent from source to verified software
H2: Your project memory should survive its index
H2: Useful memory must know when it does not know
H2: Retrieve the evidence. Do not replay the archive
H2: Turn project knowledge into executable continuity
H2: Large PRDs explain the project. They do not run it
H2: One project record. Better handoffs for humans and agents
H2: Keep durable project intelligence with the project
H2: An architecture you can inspect
H2: Implemented foundation. Expanding product surface
H2: Frequently asked questions
H2: Give your next AI coding session a project record
```

## 50. Suggested structured data

Use:

- `SoftwareApplication`;
- `FAQPage`;
- `BreadcrumbList` if the page is not the homepage.

Suggested `SoftwareApplication` fields:

- name: PITMRY;
- applicationCategory: DeveloperApplication;
- operatingSystem: local cross-platform development environment;
- description: use the primary meta description;
- codeRepository: GitLab URL;
- softwareHelp: architecture or README URL;
- offers: omit unless a real offer exists;
- aggregateRating: omit;
- review: omit.

Do not add:

- invented ratings;
- customer counts;
- fabricated testimonials;
- performance metrics not measured in the repository;
- “enterprise-ready,” “production-proven,” or similar unsupported claims.

## 51. Internal-link suggestions

If documentation pages are published, link the landing page to:

- architecture overview;
- canonical record model;
- retrieval and trust;
- Project Intelligence PRD;
- backend specification;
- setup guide;
- CLI reference;
- MCP reference;
- verification and staleness guide.

## 52. Open Graph copy

**OG title**

PITMRY — Durable Project Intelligence for AI Coding Agents

**OG description**

Connect PRDs, decisions, Git history, implementation, verification, bugs, and fixes in a local-first project graph agents can retrieve across sessions.

**Suggested image concept**

A clean left-to-right graph:

```text
PRD → Requirement → Work → Session → Commit → Verification
                                      ↘ Bug → Fix → Reverification
```

Use visual labels for:

- canonical evidence;
- explicit relations;
- local Git storage;
- bounded agent context.

---

# Part X — Design and conversion guidance

## 53. Recommended visual language

The product’s strongest visual metaphor is not a generic AI sparkle. It is a traceable project graph.

Use:

- a restrained engineering aesthetic;
- monospace details for IDs, commits, states, and paths;
- clear state chips;
- explicit line styles:
  - solid for evidence-backed relations;
  - dotted for inferred/search-hint relations;
- timeline and lineage views;
- a local architecture diagram;
- examples of `NO_MATCH`, `CONFLICT`, and `NEEDS_REVERIFICATION`;
- a compact session-contract panel.

Avoid:

- anthropomorphic “AI brain” graphics;
- unqualified claims of total memory;
- decorative network graphs without labels;
- presenting vector similarity as certainty;
- making the product look cloud-dependent.

## 54. Recommended hero visual

Split view:

### Left: fragmented context

- PRD;
- chat;
- commit;
- test log;
- bug;
- “Which one is current?”

### Right: PITMRY graph

- stable records;
- authority labels;
- explicit relations;
- current state;
- bounded session contract.

Caption:

> Preserve every source. Retrieve only the evidence the current work needs.

## 55. Recommended interactive product demo

A lightweight landing-page demo could let the visitor select:

- “Why does this file exist?”
- “What work is ready?”
- “Was this requirement verified?”
- “What changed after verification?”

Then show a structured answer with:

- status;
- current records;
- evidence;
- conflicts;
- warning;
- trace.

This would demonstrate the product’s differentiator better than a generic dashboard screenshot.

## 56. CTA strategy

Because the repository reads as an open, evolving developer project, the most credible CTA is:

1. **Explore the repository**
2. **Read the architecture**
3. **Try it locally**

Avoid a high-pressure “Start for free” CTA unless a real hosted product and onboarding path exist.

## 57. Proof strategy without invented social proof

Use implementation proof:

- canonical records in Git;
- deterministic hashes and IDs;
- local rebuild command;
- doctor output;
- explicit relation vocabulary;
- CLI command surface;
- dashboard views;
- MCP tool surface;
- repository tests;
- architecture documentation.

Phrase the proof as:

> Inspect the design, schemas, retrieval policy, and implementation in the open repository.

Do not fabricate:

- customer logos;
- usage statistics;
- time-saved claims;
- benchmark wins;
- testimonials;
- production deployments.

---

# Part XI — Product and documentation recommendations

These are recommendations derived from the audit, not claims about current behavior.

## 58. Clarify one canonical product description

The repository currently uses several overlapping descriptions:

- offline project-memory backend;
- local dashboard;
- local-first continuity engine;
- project intelligence;
- external memory for coding agents.

Recommended canonical description:

> PITMRY is a local-first project intelligence engine that gives AI coding agents durable, evidence-linked context across software-development sessions.

Then use:

- “project memory” for the storage/retrieval capability;
- “Project Intelligence” for intake-to-verification workflows;
- “dashboard” for the local visual interface.

## 59. Align documentation status with the current commit

Some documentation says Project Intelligence implementation exists only in an uncommitted working tree, while recent commits and current source include those workflows.

Update the status language to distinguish:

- committed implementation currently available;
- features covered by tests;
- features present but not yet comprehensively tested;
- proposed PRD requirements not yet implemented;
- workflow behavior not yet exercised by the repository’s own canonical dataset.

## 60. Add an explicit capability matrix

Publish a table with:

| Capability | Implemented | CLI | MCP | Dashboard | Tested | Notes |
|---|---:|---:|---:|---:|---:|---|

This would prevent readers from treating the PRD as a release statement.

## 61. Add one end-to-end example project

The current canonical dataset contains decisions, Git changes, and a session summary, but no Project Intelligence records.

A small checked-in example should demonstrate:

1. source artifact;
2. requirement;
3. acceptance criterion;
4. phase;
5. work unit;
6. session;
7. implementation;
8. verification;
9. stale verification;
10. bug and fix.

That example would make the system easier to understand than isolated command documentation.

## 62. Add dedicated Project Intelligence tests

The current test inventory covers the canonical store, IDs, CLI, migration, projections, retrieval, dashboard integration, docs import, export, and benchmarks.

The Project Intelligence module is large and domain-heavy. Dedicated tests should cover:

- lifecycle-event chains;
- baseline approval;
- reconciliation resolution and waivers;
- dependency cycles;
- readiness reasons;
- concurrent session leases;
- lease expiry;
- implementation capture;
- verification policy;
- human and runtime evidence;
- staleness transitions;
- bug closure;
- release readiness;
- doctor integrity checks.

## 63. Clarify dashboard legacy versus current surfaces

The dashboard still contains legacy terminology and compatibility mappings:

- ADR;
- commit;
- grill/discussion;
- galaxy;
- Cavemem references;
- demo fallback for older views.

The landing page should lead with canonical memory and Project Intelligence, while the product UI progressively removes or clearly labels legacy compatibility surfaces.

## 64. Improve first-run narrative

The ideal first-run journey is:

1. initialize `.pitmry`;
2. show canonical memory health;
3. ingest one source document;
4. import or create one proposed requirement;
5. approve a baseline;
6. create one work unit;
7. display its session contract;
8. record implementation;
9. verify one criterion;
10. change a scoped file and show staleness.

This sequence tells the product story through action.

## 65. Publish retrieval explanations

The source retains lexical rank, vector rank, similarity, RRF score, and retrieval reasons.

Expose those signals in an optional dashboard explanation panel. It would reinforce the trust-aware positioning and make retrieval quality debuggable.

---

# Part XII — Claims guide

## 66. Safe claims supported by the repository

You can say:

- local-first;
- offline project-memory backend;
- Git-tracked canonical records;
- rebuildable SQLite/FTS5 indexes;
- optional LanceDB vector projection;
- deterministic record IDs;
- content hashing;
- explicit evidence-backed relations;
- inferred relations remain search hints;
- trust-aware retrieval;
- conflict and no-match outcomes;
- authority and truth domains;
- CLI, dashboard, and optional MCP;
- implementation and verification are distinct;
- verification can be tied to a commit;
- relevant changes can trigger reverification;
- Project Intelligence is partially implemented.

## 67. Claims that need qualification

Qualify:

- “Project Intelligence is available”  
  Use: “A substantial partial implementation exists.”

- “Works across every platform”  
  Use: “The code contains Windows and Unix path/process handling,” unless platform testing is performed.

- “Secure”  
  Use specific controls: local binding, mutation auth, path validation, passive-data treatment, authority boundaries.

- “Fast”  
  Avoid without benchmarks.

- “Production-ready”  
  Avoid without release evidence, CI, full tests, and operational use.

- “Complete semantic memory”  
  Avoid; the retrieval assessment explicitly identified incomplete vector coverage.

## 68. Claims to avoid

Do not say:

- zero hallucinations;
- perfect memory;
- fully autonomous development;
- complete Project Intelligence platform;
- enterprise-grade;
- battle-tested;
- used by thousands of developers;
- replaces project management;
- replaces PRDs;
- vectors prove relationships;
- every feature is verified.

---

# Part XIII — Source map

The following repository files were the primary evidence for this deliverable.

## 69. Product and setup

- `README.md`
- `AGENTS.md`
- `GIT_HISTORY.md`
- `package.json`
- `.env.example`
- `pitmry.config.example.json`
- `scripts/setup.mjs`
- `scripts/doctor.mjs`

## 70. Architecture and product specifications

- `docs/ARCHITECTURE.md`
- `docs/PROJECT-INTELLIGENCE-PRD.md`
- `docs/PROJECT-INTELLIGENCE-BACKEND-SPEC.md`
- `docs/lancedb-retrieval-assessment-2026-09-20.md`
- `docs/offline/session-history.md`
- `docs/sessions/*.md`
- `docs (gitignore THIS) IMPORTANT ARCHITECTURE REBUILD/README.md`
- `docs (gitignore THIS) IMPORTANT ARCHITECTURE REBUILD/00-START-HERE.md`
- `docs (gitignore THIS) IMPORTANT ARCHITECTURE REBUILD/01-CANONICAL-FOUNDATION.md`
- `docs (gitignore THIS) IMPORTANT ARCHITECTURE REBUILD/02-PROJECTIONS-AND-INGESTION.md`
- `docs (gitignore THIS) IMPORTANT ARCHITECTURE REBUILD/03-RETRIEVAL-AND-TRUST.md`
- `docs (gitignore THIS) IMPORTANT ARCHITECTURE REBUILD/04-AGENT-API-MIGRATION-AND-UI.md`
- `docs (gitignore THIS) IMPORTANT ARCHITECTURE REBUILD/05-TEST-AND-RELEASE-GATES.md`
- `docs (gitignore THIS) IMPORTANT ARCHITECTURE REBUILD/LONG-CONTEXT-MAY-INCREASE-TOKEN-USAGE.md`

## 71. Canonical memory and retrieval

- `server/pitmry/enums.py`
- `server/pitmry/models.py`
- `server/pitmry/ids.py`
- `server/pitmry/config.py`
- `server/pitmry/canonical_store.py`
- `server/pitmry/capture.py`
- `server/pitmry/sqlite_projection.py`
- `server/pitmry/embeddings.py`
- `server/pitmry/vector_projection.py`
- `server/pitmry/rebuild.py`
- `server/pitmry/retrieval.py`
- `server/pitmry/context_service.py`
- `server/pitmry/relations.py`
- `server/pitmry/state_resolver.py`
- `server/pitmry/doctor.py`

## 72. Project Intelligence and interfaces

- `server/pitmry/project_intelligence.py`
- `server/pitmry/cli.py`
- `server/pitmry/mcp_server.py`
- `server/pitmry/git_hooks.py`
- `server/pitmry/dashboard.py`
- `server/memory_dashboard_api.py`
- `components/project-intelligence-view.tsx`
- `components/app-shell.tsx`
- `components/relational-inspector.tsx`
- `components/decision-journey.tsx`
- `components/timelines-status-page.tsx`
- `app/api/memory/route.ts`
- `app/api/v1/memory/context/route.ts`

## 73. Tests and skills

- `server/tests/test_canonical_store.py`
- `server/tests/test_cli.py`
- `server/tests/test_ids.py`
- `server/tests/test_pitmry_docs_import.py`
- `server/tests/test_pitmry_exporter.py`
- `server/tests/test_pitmry_migration.py`
- `server/tests/test_pitmry_phase4.py`
- `server/tests/test_pitmry_projections.py`
- `server/tests/test_pitmry_retrieval.py`
- `server/tests/test_retrieval_benchmark.py`
- `skills/cavemem/SKILL.md`
- `skills/memory-navigator/SKILL.md`
- `skills/strategic-memory/SKILL.md`
- `skills/desktop-dashboard-ui/SKILL.md`
- `skills/simple-english/SKILL.md`
- `skills/skill-router/SKILL.md`

## 74. Canonical repository state

- `.pitmry/manifest.json`
- `.pitmry/records/YYYY/MM/*.json`

---

# Final recommended one-sentence pitch

> PITMRY turns scattered project intent, decisions, Git history, implementation evidence, verification, and incidents into durable, local-first project intelligence that AI coding agents can retrieve across sessions.

# Final recommended short pitch

> AI coding agents are good at the task in front of them and bad at preserving the project behind it. PITMRY gives each repository a durable, Git-tracked memory layer: source requirements, decisions, work, commits, verification, bugs, and fixes connected by explicit evidence. Agents retrieve bounded context, indexes remain rebuildable, and the system can say “no match,” “conflict,” or “needs reverification” instead of pretending certainty.
