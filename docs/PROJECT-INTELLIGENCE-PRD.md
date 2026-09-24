# PITMRY Project Intelligence & Implementation Continuity — Product Requirements Document

**Document ID:** PITMRY-PI-PRD-001  
**Status:** Proposed product target; partial implementation exists  
**Audience:** high-reasoning AI agents, architects, maintainers, product owners  
**Assumption:** PITMRY 1.0 backend hardening is complete. Canonical records, provenance, authority, explicit-vs-inferred relations, rebuildable projections, hybrid retrieval, current-state resolution, and abstention already exist.

> **Implementation note:** This PRD defines the intended product, not a claim that every requirement is complete. The current repository implements a growing subset of intake, planning, session, verification, incident, context, and release-readiness workflows. Check the source and tests for current behavior. The README describes the implemented product surface; this PRD remains the target specification.

## 1. Executive Summary

AI-assisted development creates more planning and implementation context than either a human or model can reliably retain. A project may start with 1–10 PRDs, UI briefs, architecture notes, Grill-Me sessions, implementation plans, acceptance criteria, security requirements, and migration notes. Development then adds agent sessions, commits, diffs, tests, bugs, fixes, regressions, refactors, superseding decisions, and unfinished work.

These artifacts exist, but they rarely stay connected.

A future agent usually sees only current code, some Git history, and perhaps one or two documents. It cannot reliably answer:

- Why does this feature exist?
- Which PRD required it?
- Was it fully implemented?
- Was it verified?
- Which commit implemented it?
- Did it break before?
- What fixed it?
- Was the original decision superseded?
- Which requirements remain unfinished?
- Is this code intentional or dead code?

PITMRY Project Intelligence exists to solve this continuity problem.

PITMRY shall transform planning artifacts, implementation work, verification evidence, incidents, and Git history into a durable project graph.

```text
INTENT
  ↓
RECONCILIATION
  ↓
PLANNING
  ↓
WORK
  ↓
IMPLEMENTATION
  ↓
VERIFICATION
  ↓
INCIDENTS
  ↓
FIXES
  ↓
CURRENT STATE
```

The core promise is:

> A new agent session should be able to understand what was supposed to happen, what actually happened, what broke, what changed later, and what remains true now—without access to previous agents' private reasoning or complete chat histories.

## 2. Product Thesis

PITMRY is not primarily a chat-memory system.

```text
PITMRY
=
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

Chats and agent sessions are evidence sources. They are not the primary semantic model.

The unit of value is not "remember this conversation."

The unit of value is:

```text
connect this project decision,
requirement,
implementation,
evidence,
bug,
fix,
and current state
```

## 3. Problems PITMRY Must Solve

### 3.1 PRDs become stale after implementation begins

PITMRY must continuously reconcile planning intent with actual implementation.

It must distinguish requirements that are:

```text
PROPOSED
ACCEPTED
PLANNED
IN_PROGRESS
IMPLEMENTED
VERIFIED
NEEDS_REVERIFICATION
BLOCKED
REGRESSED
SUPERSEDED
REJECTED
```

### 3.2 New sessions repeatedly reconstruct the same context

A new agent should not need to rediscover architecture, rejected approaches, known bugs, and old decisions by rereading the entire repository.

Prior project understanding must become durable.

### 3.3 "Done" is frequently unsupported

File changes are implementation evidence. They are not verification.

PITMRY must distinguish:

```text
IMPLEMENTED
```

from:

```text
VERIFIED
```

### 3.4 Large PRD sets do not form an execution graph

PITMRY must turn accepted project intent into dependency-aware phases, subphases, and bounded work units.

### 3.5 AI agents create duplicate or dead abstractions

Before creating major code, agents should understand whether an existing implementation should be:

```text
REUSE
EXTEND
REPLACE
CREATE
```

### 3.6 Bugs become detached from their feature history

A future agent should be able to retrieve the requirement, implementation, bug, fix, and verification as one historical chain.

### 3.7 Verification becomes stale

A requirement verified at commit A may no longer be verified after later changes to its implementation.

PITMRY must support:

```text
VERIFIED
→ NEEDS_REVERIFICATION
```

### 3.8 Multi-session and multi-agent workflows conflict

PITMRY must support bounded session contracts, dependency state, ownership/leases, branch/worktree metadata, and explicit handoffs.

## 4. Product Principles

1. Preserve original source artifacts.
2. AI decomposition is derived, not automatically authoritative.
3. Proposed understanding must be reviewed before becoming baseline intent.
4. Evidence is required before verification.
5. Explicit relationships outrank semantic similarity.
6. Sessions are ephemeral; project state is durable.
7. Current truth and historical truth must remain separately queryable.
8. Work becomes executable only when dependencies are ready.
9. Verification belongs to a code snapshot.
10. Significant later changes may invalidate prior verification.
11. No memory is better than false memory.
12. Agents cannot self-promote their own claims into human authority.

## 5. Core Product Model

```text
Project
├── Source Artifact
│   ├── PRD
│   ├── design brief
│   ├── architecture note
│   └── implementation plan
├── Requirement
│   ├── Acceptance Criterion
│   ├── Constraint
│   └── Decision
├── Phase
│   └── Work Unit
├── Session
│   ├── Implementation
│   ├── Commit
│   ├── Diff
│   ├── Test Run
│   └── Observation
├── Verification
├── Incident
│   ├── Bug
│   ├── Regression
│   └── Fix
└── Current State
```

## 6. New-Project Intake

A project may begin with one or many PRDs.

Example:

```text
PRD-01 Authentication
PRD-02 Products
PRD-03 CMS
PRD-04 Payments
PRD-05 Admin
PRD-06 Analytics
```

PITMRY must not immediately start implementation.

The required intake lifecycle is:

```text
RAW SOURCES
  ↓
DRAFT DECOMPOSITION
  ↓
CROSS-PRD RECONCILIATION
  ↓
GRILL-ME / REVIEW
  ↓
USER CONFIRMATION
  ↓
ACCEPTED BASELINE
  ↓
EXECUTION JOURNEY
```

## 7. Source Artifact Preservation

For each source artifact PITMRY preserves:

- source identity;
- original content or stable reference;
- content hash;
- import timestamp;
- source type;
- provenance.

AI processing produces derived records rather than rewriting the original source.

## 8. Requirement Decomposition

A high-reasoning agent may extract:

- product requirements;
- backend requirements;
- UI requirements;
- data requirements;
- security requirements;
- operational requirements;
- performance requirements;
- accessibility requirements;
- acceptance criteria;
- constraints;
- open questions;
- decisions required.

Every extracted item is initially proposed.

## 9. Cross-PRD Reconciliation

PITMRY should identify:

```text
duplicate
overlap
dependency
contradiction
missing prerequisite
ambiguous responsibility
inconsistent terminology
scope collision
```

Example:

```text
PRD-03:
Guest checkout is required.

PRD-05:
Users must authenticate before checkout.
```

PITMRY must not silently choose a winner. It creates an unresolved conflict for review.

## 10. Project Grill-Me

The high-reasoning agent should interrogate unresolved requirements before implementation.

Areas include:

- permissions;
- lifecycle states;
- data ownership;
- deletion semantics;
- publishing;
- concurrency;
- validation;
- failure handling;
- privacy;
- integrations;
- performance;
- accessibility;
- responsive behavior;
- migrations.

Grill-Me output should be normalized into durable records:

```text
decision
constraint
new requirement
rejected alternative
clarification
open question
```

Do not retain only a long chat transcript.

## 11. Baseline Project Intent

After review, accepted requirements become current baseline intent.

Baseline means "currently accepted", not immutable.

Later records may supersede earlier intent while preserving history.

## 12. Execution Journey

PITMRY transforms accepted intent into phases and work units.

Example:

```text
PHASE 1 — FOUNDATION
  1.1 Repository architecture
  1.2 Data layer
  1.3 Authentication
  1.4 Test harness

PHASE 2 — CORE DOMAIN
  2.1 Product schema
  2.2 Product service
  2.3 Product APIs

PHASE 3 — UI
  3.1 Product list
  3.2 Product detail
  3.3 Admin editor

PHASE 4 — INTEGRATION
PHASE 5 — HARDENING
PHASE 6 — RELEASE
```

PITMRY does not require this exact sequence. Dependencies determine readiness.

## 13. Work Units

A work unit is the smallest bounded implementation assignment PITMRY gives to an agent.

A work unit defines:

- goal;
- related requirements;
- dependencies;
- code scope;
- expected outputs;
- acceptance criteria;
- verification requirements;
- blocking decisions;
- constraints.

Example:

```text
WORK-042
Implement product update API

Requirements:
REQ-21
REQ-22

Dependencies:
WORK-017 Product schema
DEC-008 Permission model

Acceptance:
- invalid data rejected
- unauthorized users denied
- valid update persists
```

## 14. Work Readiness

Work states:

```text
NOT_READY
READY
IN_PROGRESS
IMPLEMENTED
VERIFYING
VERIFIED
BLOCKED
FAILED
REGRESSED
SUPERSEDED
```

A work unit becomes `READY` only when:

- required dependencies are satisfied;
- blocking decisions are resolved;
- acceptance criteria exist;
- required contracts exist;
- no unresolved conflict blocks it.

## 15. Anti-Dead-Code Behavior

Before substantial new code is created, the agent should retrieve relevant implementation context.

The agent should explicitly prefer:

```text
REUSE
EXTEND
REPLACE
CREATE
```

For substantial `CREATE` actions, PITMRY should be able to preserve why an existing implementation was insufficient and which requirement justifies the new object.

This requirement does not apply to trivial implementation details.

## 16. Session Contracts

Every significant coding session begins from a durable session contract.

A session contract should contain:

```text
work unit
goal
allowed scope
dependencies
current decisions
known historical bugs
previous failed attempts
acceptance criteria
verification requirements
base commit
branch/worktree
```

This contract is the primary handoff format between independent model sessions.

## 17. Session Completion

At completion PITMRY captures:

- files changed;
- symbols changed when available;
- commits;
- tests;
- build results;
- implementation summary;
- newly discovered limitations;
- bugs encountered;
- decisions made;
- unresolved work;
- relationship to work unit.

Session records describe observable outcomes, not hidden chain-of-thought.

## 18. Implementation Evidence

Implementation evidence may include:

- commits;
- patches;
- files;
- symbols;
- generated artifacts;
- successful build/typecheck.

An agent may establish that implementation work happened.

That does not establish that requirements were satisfied.

## 19. Verification

Verification compares implementation against acceptance criteria.

Evidence may include:

```text
unit tests
integration tests
end-to-end tests
build
lint
typecheck
runtime checks
manual review
human confirmation
```

A verification record identifies:

- requirement/work unit;
- evidence;
- verifier type;
- code snapshot/commit;
- timestamp.

## 20. Verification Types

PITMRY should distinguish:

```text
automated
agent_reviewed
human_confirmed
runtime_observed
```

These types support different claims and should remain visible.

## 21. Verification Staleness

Relevant later code changes may transition:

```text
VERIFIED
→ NEEDS_REVERIFICATION
```

Potential triggers include:

- tracked file changes;
- tracked symbol changes;
- reversion;
- superseding implementation;
- regression.

Unrelated repository changes must not invalidate everything.

## 22. Incident History

PITMRY attaches incidents to feature history.

```text
REQ-42
  ↓ implemented by
IMP-20
  ↓ affected by
BUG-14
  ↓ fixed by
FIX-15
  ↓ verified by
VER-22
```

Future agents can retrieve known failure modes before modifying related code.

## 23. Proactive Context

PITMRY should support pull and trigger-based retrieval.

Triggers may include:

```text
session start
work unit claim
editing historically sensitive file
commit
test failure
session finish
verification invalidation
```

Example:

```text
Historical warning:
This component previously failed when specification groups were empty.
The fix intentionally skips empty groups.
See BUG-14 / FIX-15.
```

## 24. Retrieval Entry Points

PITMRY should support:

```text
retrieval by question
retrieval by work unit
retrieval by code location
retrieval by active session
retrieval by hook/event
```

All should converge on the same trusted project graph.

## 25. Multi-Session Compatibility

Every new session may use:

- a different model;
- a different context window;
- a different coding tool;
- no prior conversation access.

Therefore important project state must exist outside model memory.

This is a hard requirement.

## 26. Multi-Agent Compatibility

Parallel agents require task ownership.

A work unit may have a lease:

```text
owner_session
claimed_at
expires_at
```

Other agents must not receive that unit as available while the lease is valid.

Expired/abandoned leases may return to `READY` after consistency checks.

## 27. Branch and Worktree Awareness

Session history should capture:

- branch;
- worktree;
- base commit;
- head commit;
- merge result.

PITMRY must distinguish an implementation attempt from code actually merged into the main project history.

## 28. Agent Roles

High-reasoning agents are preferred for:

```text
PRD decomposition
cross-PRD reconciliation
Grill-Me
architecture analysis
dependency planning
hardening review
conflict-resolution proposals
```

Fast coding agents are preferred for:

```text
bounded work units
tests
small fixes
evidence capture
migration execution
```

PITMRY is the durable coordination layer between them.

## 29. Project Status

PITMRY should produce objective project status derived from records.

Example:

```text
127 requirements

83 VERIFIED
11 IMPLEMENTED / NOT VERIFIED
9 IN_PROGRESS
8 READY
7 BLOCKED
5 SUPERSEDED
4 UNPLANNED
```

PRD-level status should similarly be derivable.

## 30. Project Completion

A project is not complete because every work unit has a commit.

Configured completion should require at minimum:

- mandatory requirements verified;
- blocking incidents resolved;
- no unresolved critical conflict;
- required release checks complete.

## 31. Hardening Is First-Class Work

PITMRY should allow dedicated hardening work units for:

- security;
- accessibility;
- performance;
- error handling;
- migration safety;
- backup/restore;
- concurrency;
- regression testing;
- failure recovery.

Hardening is not an optional paragraph added after feature development.

## 32. Non-Goals

PITMRY does not:

- replace Git;
- replace every issue tracker;
- store private chain-of-thought;
- autonomously resolve ambiguous product choices without confirmation;
- claim implementation correctness from static analysis alone;
- require one universal phase structure;
- require cloud services;
- depend on one model vendor.

## 33. Success Measures

Useful outcomes include:

- fewer repeated architecture mistakes;
- fewer duplicate implementations;
- fewer reopened resolved questions;
- higher requirement-to-code traceability;
- higher verification coverage;
- faster session onboarding;
- fewer regressions of known fixes;
- lower false historical memory.

Candidate metrics:

- % accepted requirements linked to implementation;
- % accepted requirements linked to verification;
- % incidents linked to affected requirements;
- work units started while dependencies were unresolved;
- stale verifications detected;
- average context size required to start a new session.

## 34. Target User Journey

A new project:

```text
pitmry init
pitmry ingest-prd docs/*.md
```

A high-reasoning agent performs:

```text
analyze
reconcile
grill
baseline
plan
```

After baseline:

```text
pitmry next
```

returns valid work.

A coding agent receives a bounded session contract.

At completion PITMRY captures evidence.

A future agent can query a feature and retrieve:

```text
original requirement
accepted decision
implementation
verification
known bug
fix
current status
```

## 35. Strategic Invariants

1. Original source artifacts are preserved.
2. AI decomposition is derived.
3. Human-confirmed intent outranks agent inference.
4. Work cannot become ready with unresolved required dependencies.
5. Implementation is not verification.
6. Verification belongs to a code snapshot.
7. Later relevant changes can stale verification.
8. Incidents remain attached to feature history.
9. Session continuity does not depend on conversation continuity.
10. Explicit relationships are evidence; similarity is discovery.
11. PITMRY does not invent historical causality.
12. Current state and project history remain separately queryable.
13. Agents cannot self-promote claims into human authority.
14. No-match and conflict are valid outputs.
15. Project state is reconstructable from durable canonical records.

## 36. Product Identity

> PITMRY Project Intelligence is a local-first continuity engine for AI-assisted software development that turns PRDs, decisions, implementation work, verification, bugs, fixes, and Git history into a durable project graph that coding agents can retrieve across sessions.

```text
PITMRY
=
trusted memory foundation
+
project intent graph
+
dependency-aware execution ledger
+
verification ledger
+
incident history
+
multi-session agent coordination
```
