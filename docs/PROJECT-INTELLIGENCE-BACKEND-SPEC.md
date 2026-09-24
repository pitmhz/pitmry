# PITMRY Project Intelligence Engine — Backend Technical Specification

**Document ID:** PITMRY-PI-BE-001  
**Status:** Proposed  
**Audience:** backend architects, high-reasoning implementation planners, coding agents  
**Depends on:** PITMRY 1.0 hardened memory backend  
**Companion:** [Project Intelligence PRD](PROJECT-INTELLIGENCE-PRD.md)

---

# 1. Purpose

This specification translates the PITMRY Project Intelligence product model into a backend architecture.

It assumes PITMRY 1.0 already provides:

```text
canonical Git-tracked records
stable project identity
provenance
authority
truth domains
explicit vs inferred relations
SQLite + FTS5 projection
LanceDB vector projection
hybrid retrieval
RRF/ranking
current-state resolution
NO_MATCH / CONFLICT / DEGRADED behavior
context service
rebuild
doctor
CLI foundation
```

Do not create a second storage system for Project Intelligence.

Project Intelligence extends the PITMRY canonical record graph.

---

# 2. Architecture

```text
                       AI AGENTS
                           │
               ┌───────────┴────────────┐
               │                        │
          High reasoning           Coding agents
               │                        │
               └───────────┬────────────┘
                           │
                    PITMRY Agent API
                           │
                           ▼
          ┌─────────────────────────────────┐
          │ PROJECT INTELLIGENCE SERVICES   │
          │                                 │
          │ Intake / reconciliation         │
          │ Planning / dependency graph     │
          │ Work readiness / leasing        │
          │ Session orchestration           │
          │ Implementation evidence         │
          │ Verification / staleness        │
          │ Incident lifecycle              │
          │ Context assembly                │
          └───────────────┬─────────────────┘
                          │
                          ▼
               PITMRY 1.0 CORE ENGINE
          ┌─────────────────────────────────┐
          │ canonical store                 │
          │ relation store                  │
          │ state resolver                  │
          │ retrieval/context engine        │
          │ projections                     │
          └───────────────┬─────────────────┘
                          │
                          ▼
                     .pitmry/
```

Project Intelligence must use PITMRY's existing canonical-write path.

No service writes directly to SQLite or LanceDB.

---

# 3. Recommended Module Tree

Adapt names only when necessary to match the final PITMRY 1.0 package.

```text
server/
  pitmry/
    project_intelligence/
      __init__.py

      models.py
      enums.py
      records.py

      intake/
        __init__.py
        source_artifacts.py
        prd_ingestor.py
        decomposition.py
        reconciliation.py
        baseline.py

      planning/
        __init__.py
        phases.py
        work_units.py
        dependency_graph.py
        readiness.py

      sessions/
        __init__.py
        session_contracts.py
        leases.py
        lifecycle.py
        handoff.py

      implementation/
        __init__.py
        evidence.py
        git_linker.py
        code_scope.py
        reuse_analysis.py

      verification/
        __init__.py
        criteria.py
        verifier.py
        staleness.py

      incidents/
        __init__.py
        bugs.py
        regressions.py
        fixes.py

      orchestration/
        __init__.py
        hooks.py
        transitions.py
        event_router.py

      context/
        __init__.py
        project_context.py
        work_context.py
        code_context.py
        session_context.py

      services/
        __init__.py
        intake_service.py
        planning_service.py
        work_service.py
        session_service.py
        verification_service.py
        incident_service.py
```

Tests:

```text
server/tests/project_intelligence/
  test_prd_ingestion.py
  test_reconciliation.py
  test_baseline.py
  test_dependency_graph.py
  test_readiness.py
  test_work_leases.py
  test_session_lifecycle.py
  test_implementation_evidence.py
  test_verification.py
  test_verification_staleness.py
  test_incident_history.py
  test_context_packets.py
  test_multi_session.py
  test_multi_agent.py
```

Avoid a monolithic `project_manager.py`.

---

# 4. Canonical Record Extensions

Extend PITMRY v1 record types with:

```text
source_artifact
requirement
acceptance_criterion
phase
work_unit
session
implementation
verification
bug
fix
regression
```

Existing types remain valid:

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

Do not duplicate existing concepts under new names.

---

# 5. Explicit Relationship Extensions

Add explicit relation types:

```text
contains
derived_from
clarifies
depends_on
blocks
implements
verifies
invalidates_verification
affects
fixes
regressed_by
created_during
produced_commit
targets
scoped_to
supersedes
reverts
```

All these are explicit relations.

They require known source and target records.

Do not infer these from vector similarity.

Existing inferred relationships remain discovery-only:

```text
semantically_related
shared_files
temporal_neighbor
possible_origin
possible_followup
```

---

# 6. Source Artifact Record

Record type:

```text
source_artifact
```

Suggested `content`:

```json
{
  "artifact_kind": "prd",
  "source_path": "docs/PRD-products.md",
  "source_hash": "sha256:...",
  "title": "Products PRD",
  "version_label": null,
  "ingestion_status": "INGESTED",
  "original_text_ref": "docs/PRD-products.md"
}
```

Authority:

```text
human_direct
```

when the source was supplied by the user/project.

Truth domain:

```text
intent
```

The source artifact proves what the source says.

It does not prove the implementation exists.

---

# 7. Requirement Record

Record type:

```text
requirement
```

Suggested content:

```json
{
  "requirement_kind": "backend",
  "statement": "Products must support CMS-driven specification groups.",
  "status": "PROPOSED",
  "priority": "required",
  "subject_key": "product.specifications",
  "source_locator": {
    "artifact_id": "src_...",
    "section": "Product details",
    "ordinal": 4
  }
}
```

Required requirement kinds:

```text
product
backend
frontend
data
security
performance
accessibility
operational
integration
migration
```

Do not treat `requirement_kind` as authority.

---

# 8. Acceptance Criterion Record

Type:

```text
acceptance_criterion
```

Content:

```json
{
  "statement": "An administrator can add multiple specification groups.",
  "verification_method": "integration_test",
  "mandatory": true,
  "status": "PROPOSED"
}
```

Relate with:

```text
requirement --contains--> acceptance_criterion
```

---

# 9. Requirement Lifecycle

Allowed states:

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

Do not allow arbitrary transitions.

Recommended transition graph:

```text
PROPOSED
 ├──> ACCEPTED
 └──> REJECTED

ACCEPTED
 ├──> PLANNED
 ├──> SUPERSEDED
 └──> BLOCKED

PLANNED
 ├──> IN_PROGRESS
 └──> BLOCKED

IN_PROGRESS
 ├──> IMPLEMENTED
 ├──> BLOCKED
 └──> REGRESSED

IMPLEMENTED
 ├──> VERIFIED
 ├──> NEEDS_REVERIFICATION
 └──> REGRESSED

VERIFIED
 ├──> NEEDS_REVERIFICATION
 ├──> REGRESSED
 └──> SUPERSEDED

NEEDS_REVERIFICATION
 ├──> VERIFIED
 └──> REGRESSED
```

The state service controls transitions.

Do not let agents directly write arbitrary `status` values into canonical records.

Represent lifecycle changes as new canonical event/state records or an existing PITMRY state-transition mechanism if v1 already defines one.

---

# 10. Requirement Identity

A derived requirement must have stable identity across repeated PRD ingestion.

Use a deterministic source key derived from:

```text
source artifact ID
+ source section/locator
+ normalized statement identity
```

Do not use list position alone if headings/anchors are available.

If source text materially changes, create a new revision/superseding requirement rather than silently mutating the historical requirement.

---

# 11. Decomposition Output

A high-reasoning decomposition agent must output machine-validated structured data.

Example:

```json
{
  "artifact_id": "src_...",
  "requirements": [
    {
      "temporary_key": "R1",
      "kind": "backend",
      "statement": "...",
      "source_locator": {...},
      "acceptance_criteria": [...],
      "open_questions": [...]
    }
  ]
}
```

The decomposition importer validates:
- source artifact exists;
- locators are valid enough for the source type;
- duplicate temporary keys do not exist;
- enum values are valid.

Imported decompositions remain `PROPOSED`.

---

# 12. Reconciliation Model

The reconciliation stage must not rely on one generic "conflict score."

Produce explicit reconciliation proposals:

```text
DUPLICATE
OVERLAP
DEPENDENCY
CONFLICT
MISSING_PREREQUISITE
TERMINOLOGY_MISMATCH
```

Suggested record:

```json
{
  "type": "observation",
  "content": {
    "observation_kind": "reconciliation",
    "classification": "CONFLICT",
    "records": ["req_a", "req_b"],
    "summary": "...",
    "proposed_resolution": null,
    "status": "OPEN"
  }
}
```

Authority should normally be:

```text
agent_observed
```

until resolved.

A high-reasoning model may propose a resolution.

It cannot silently accept it.

---

# 13. Grill-Me Resolution

Grill-Me should consume open reconciliation observations and unresolved questions.

A resolved answer may create:

- decision;
- constraint;
- accepted requirement;
- rejected requirement;
- supersession relation;
- clarification relation.

The durable object should be the resolved project state, not only the transcript.

The raw discussion may be stored as `discussion` evidence.

---

# 14. Baseline Operation

Introduce service operation:

```text
baseline_project()
```

Preconditions:

- source artifacts ingested;
- required decomposition exists;
- critical reconciliation conflicts resolved or explicitly waived;
- required open questions resolved.

Output:
- accepted requirements;
- accepted acceptance criteria;
- active decisions;
- constraints;
- baseline marker/checkpoint.

Baseline should be idempotent for the same accepted input set.

A new baseline after material changes creates a new checkpoint rather than overwriting history.

---

# 15. Phase Record

Type:

```text
phase
```

Content:

```json
{
  "name": "Core backend",
  "ordinal": 2,
  "objective": "Establish domain services and APIs.",
  "status": "PLANNED"
}
```

Relations:

```text
project/checkpoint --contains--> phase
phase --contains--> work_unit
```

If PITMRY does not represent project as a record, baseline/checkpoint may be the parent graph node.

---

# 16. Work Unit Record

Type:

```text
work_unit
```

Suggested content:

```json
{
  "title": "Implement product update API",
  "objective": "Provide authenticated product updates.",
  "state": "NOT_READY",
  "scope": {
    "paths": [
      "server/products/**",
      "tests/products/**"
    ],
    "symbols": []
  },
  "completion_policy": {
    "require_tests": true,
    "require_build": true,
    "require_verification": true
  },
  "risk": "medium"
}
```

Relations:

```text
phase --contains--> work_unit
work_unit --implements--> requirement
work_unit --depends_on--> work_unit
work_unit --depends_on--> decision
```

---

# 17. Dependency Graph

Implement dependency graph operations:

```python
get_dependencies(work_unit_id)
get_dependents(work_unit_id)
topological_order(...)
detect_cycles(...)
explain_not_ready(work_unit_id)
```

Cycle detection is mandatory.

Planning must fail closed on dependency cycles.

Do not silently break cycles.

Example diagnostic:

```text
WORK-12 depends on WORK-19
WORK-19 depends on WORK-12
```

Return structured `DEPENDENCY_CYCLE`.

---

# 18. Work Readiness Service

A work unit can become `READY` only when all mandatory conditions pass.

Readiness checks:

```text
all dependency work units satisfy required state
all blocking decisions exist and are active
all linked requirements are accepted/planned
mandatory acceptance criteria exist
no critical unresolved reconciliation conflict applies
work unit not superseded
no active valid lease exists
```

Implement:

```python
evaluate_readiness(work_unit_id) -> ReadinessResult
```

Result:

```json
{
  "ready": false,
  "blocking_reasons": [
    {
      "code": "DEPENDENCY_NOT_VERIFIED",
      "record_id": "work_17"
    }
  ]
}
```

Never return only `False`.

Agents need the reason.

---

# 19. Work Selection

Implement:

```text
pitmry next
```

or equivalent service:

```python
get_next_work(...)
```

Default selection:
- only `READY`;
- exclude valid leases;
- honor phase/dependency order;
- allow optional tag/domain filtering.

Do not use an LLM to arbitrarily pick a blocked unit.

High-reasoning planning agents may propose priority changes, but state constraints still apply.

---

# 20. Work Lease

A lease prevents duplicate parallel execution.

Lease record may be represented by session/work relationship or dedicated content.

Required fields:

```text
work_unit_id
session_id
claimed_at
expires_at
base_commit
branch
worktree
```

Rules:
- one active lease per work unit by default;
- lease acquisition is atomic;
- expired lease is not automatically considered successful;
- release on successful session close;
- abandoned lease may expire;
- renewal allowed by owner.

Use SQLite transactional projection or canonical optimistic locking for acquisition, but the durable claim event must remain reconstructable.

---

# 21. Session Record

Type:

```text
session
```

Content:

```json
{
  "session_kind": "implementation",
  "agent": {
    "tool": "codex",
    "model": null
  },
  "work_unit_id": "work_...",
  "branch": "feature/product-api",
  "worktree": "/path/...",
  "base_commit": "fullsha",
  "head_commit": null,
  "state": "ACTIVE",
  "started_at": "...",
  "finished_at": null
}
```

Do not require model identity for correctness.

Tool/model metadata is observational.

---

# 22. Session State Machine

States:

```text
CREATED
ACTIVE
BLOCKED
FINISHING
COMPLETED
ABANDONED
FAILED
```

Allowed:

```text
CREATED -> ACTIVE
ACTIVE -> BLOCKED
BLOCKED -> ACTIVE
ACTIVE -> FINISHING
FINISHING -> COMPLETED
ACTIVE -> FAILED
BLOCKED -> ABANDONED
ACTIVE -> ABANDONED
```

A completed session does not automatically mean its work unit is verified.

---

# 23. Session Contract

`start_session(work_unit_id)` produces a context contract.

Contract fields:

```text
session ID
work unit
objective
allowed/recommended scope
dependencies and their state
active decisions
constraints
acceptance criteria
known bugs/regressions
previous failed attempts
current code snapshot/base commit
verification requirements
```

This contract may be materialized as JSON for agent tools.

It should be compact enough for weaker models.

---

# 24. Context Snapshot

Record which PITMRY records were used to create a session contract.

Store IDs/hash, not a giant duplicated context blob where possible.

Example:

```json
{
  "context_record_ids": [
    "req_...",
    "dec_...",
    "bug_...",
    "work_..."
  ],
  "context_snapshot_hash": "sha256:..."
}
```

This makes later debugging possible:

```text
What did the agent know when it started?
```

---

# 25. Session Finish

`finish_session()` performs:

1. resolve repository/worktree;
2. capture final HEAD;
3. compute commits since base when applicable;
4. capture file changes;
5. capture tests supplied/run;
6. accept structured implementation summary;
7. create implementation record;
8. create explicit relations;
9. release work lease;
10. transition work state to `IMPLEMENTED` only when implementation evidence is sufficient;
11. enqueue/evaluate verification.

Do not mark `VERIFIED`.

---

# 26. Implementation Record

Type:

```text
implementation
```

Content:

```json
{
  "summary": "Added update endpoint and validation.",
  "base_commit": "...",
  "head_commit": "...",
  "changed_files": [...],
  "changed_symbols": [...],
  "known_limitations": [...],
  "reuse_decision": {
    "mode": "EXTEND",
    "target": "existing-product-service",
    "reason": "..."
  }
}
```

Relations:

```text
implementation --implements--> requirement
implementation --created_during--> session
implementation --produced_commit--> git_change
work_unit --produces/contains--> implementation
```

If `produces` is not added as a relation, use `created_during` + work-unit linkage consistently.

---

# 27. Git Evidence

Use PITMRY v1 `git_change` records.

Do not duplicate raw Git metadata inside multiple systems unnecessarily.

Implementation may reference Git records explicitly.

Example:

```text
implementation --produced_commit--> git_abc
```

The canonical Git record remains the objective history.

---

# 28. Code Scope

`code_scope.py` should normalize:

```text
paths
symbols
packages/modules
```

Path patterns must be repository-relative.

Never store user-machine absolute paths as canonical code scope.

Worktree absolute path belongs to session runtime metadata, not portable requirement/work-unit identity.

---

# 29. Reuse Analysis

Before substantial `CREATE`, an agent may submit:

```json
{
  "mode": "CREATE",
  "searched": [
    "product service",
    "attribute model"
  ],
  "considered": [
    "existing_record_or_symbol"
  ],
  "reason": "Existing flat attribute model cannot represent grouped sections."
}
```

This is optional for trivial code.

For major domain objects, services, schemas, or UI components, it should be encouraged.

Do not block development solely because the agent omitted a prose reuse analysis unless project policy requires it.

---

# 30. Verification Record

Type:

```text
verification
```

Content:

```json
{
  "verification_type": "automated",
  "target_snapshot": {
    "commit": "fullsha"
  },
  "criteria": [
    {
      "criterion_id": "ac_...",
      "result": "PASS",
      "evidence": [
        "test_..."
      ]
    }
  ],
  "overall": "PASS"
}
```

Relation:

```text
verification --verifies--> requirement
verification --verifies--> work_unit
```

Use whichever target(s) are actually supported.

---

# 31. Verification Eligibility

A requirement/work unit becomes `VERIFIED` only when:

- implementation exists;
- mandatory acceptance criteria exist;
- every mandatory criterion has acceptable verification evidence;
- verification applies to current implementation snapshot;
- no blocking regression is active;
- no explicit conflicting state exists.

Do not accept an agent's plain `"verified": true`.

---

# 32. Test Result Integration

Use existing PITMRY `test_result` records where possible.

A verification criterion may reference:

```text
test_result
build observation
runtime observation
human confirmation
```

Do not duplicate test logs in the verification record.

Verification references evidence records.

---

# 33. Verification Staleness Engine

Create `verification/staleness.py`.

Purpose:

```text
determine whether a previous verification still covers current implementation
```

Input:
- verification target commit;
- linked implementation;
- linked files/symbols;
- later Git changes;
- incident/reversion history.

Initial deterministic staleness rules:

Mark `NEEDS_REVERIFICATION` when:
- linked implementation is explicitly superseded;
- linked implementation commit is reverted;
- a later change touches tracked symbols;
- a later change touches tracked files and no finer symbol scope exists;
- an active regression affects the requirement.

Do not invalidate on every repository commit.

Return reasons.

---

# 34. Staleness Record

Prefer representing staleness as an event/relationship rather than rewriting historical verification.

Example explicit relation:

```text
git_change --invalidates_verification--> verification
```

or an observation/state transition linked to both.

Historical verification remains true:

```text
"It passed at commit A."
```

Current state becomes:

```text
"Needs reverification after commit B."
```

---

# 35. Bug Record

Type:

```text
bug
```

Content:

```json
{
  "title": "Empty specification group crashes renderer",
  "symptom": "...",
  "severity": "medium",
  "reproduction": "...",
  "status": "OPEN"
}
```

Relations may include:

```text
bug --affects--> requirement
bug --affects--> implementation
bug --created_during--> session
```

Do not require every bug to be linked to a requirement if unknown.

---

# 36. Fix Record

Type:

```text
fix
```

Content:

```json
{
  "summary": "Skip empty specification groups.",
  "status": "IMPLEMENTED"
}
```

Relations:

```text
fix --fixes--> bug
fix --created_during--> session
fix --produced_commit--> git_change
```

Verification of the fix should create verification evidence.

---

# 37. Regression Record

Type:

```text
regression
```

Use when previously working/verified behavior breaks again.

Relations:

```text
regression --affects--> requirement
regression --regressed_by--> implementation/git_change
```

A regression should transition relevant requirement/work state to `REGRESSED` or `NEEDS_REVERIFICATION` according to policy.

---

# 38. Incident Retrieval

When agents request context for a requirement or code location, the context service should prioritize active/relevant:

- bugs;
- regressions;
- fixes;
- reversion history.

Do not hide historical incidents merely because they are closed.

Closed incidents should be compressed into historical warnings when relevant.

---

# 39. Hook/Event Architecture

Create a small internal event bus abstraction.

Do not make hook code directly implement domain logic.

Suggested events:

```text
PROJECT_INITIALIZED
SOURCE_ARTIFACT_INGESTED
DECOMPOSITION_IMPORTED
BASELINE_CREATED
WORK_BECAME_READY
WORK_CLAIMED
SESSION_STARTED
SESSION_FINISH_REQUESTED
IMPLEMENTATION_RECORDED
COMMIT_CAPTURED
TEST_RECORDED
VERIFICATION_RECORDED
VERIFICATION_STALE
BUG_RECORDED
FIX_RECORDED
REGRESSION_RECORDED
WORK_VERIFIED
```

Event handlers call domain services.

---

# 40. Git Hook Integration

Git hooks are optional adapters.

They may trigger:

```text
capture commit
associate commit with active session
evaluate verification staleness
```

Git hooks must not:
- invent rationale;
- infer implementation relations from time alone;
- mark work verified;
- fail the user's Git commit because optional PITMRY vector indexing is unavailable.

Critical canonical-write failures may be surfaced, but PITMRY should avoid making normal Git unusable.

---

# 41. Agent Hooks

Agent integrations may call:

```text
session start
context for active task
checkpoint
session finish
record bug
record decision
```

Every integration should use the same service layer.

Do not maintain Codex-specific and Claude-specific semantic behavior.

Adapters translate tool protocols only.

---

# 42. Project Intake Service

`intake_service.py` should provide:

```python
ingest_source_artifact(...)
import_decomposition(...)
list_open_reconciliation(...)
record_grill_resolution(...)
create_baseline(...)
```

It should never call an LLM internally as a hidden side effect.

Reasoning agents operate outside the deterministic backend and submit structured results.

This keeps PITMRY vendor/model agnostic.

---

# 43. Planning Service

`planning_service.py`:

```python
create_phase(...)
create_work_unit(...)
link_requirement(...)
add_dependency(...)
validate_plan(...)
list_ready_work(...)
```

`validate_plan()` checks:
- cycles;
- orphan required requirements;
- work units with no goal;
- missing mandatory acceptance criteria;
- dependencies on superseded records.

---

# 44. Work Service

`work_service.py`:

```python
evaluate_readiness(...)
claim_work(...)
renew_lease(...)
release_work(...)
get_next_work(...)
block_work(...)
```

Lease operations must be transactional.

---

# 45. Session Service

`session_service.py`:

```python
start_session(...)
get_session_contract(...)
checkpoint_session(...)
finish_session(...)
abandon_session(...)
```

Starting a session should claim work unless explicitly running a read/review session.

---

# 46. Verification Service

`verification_service.py`:

```python
begin_verification(...)
record_criterion_result(...)
finalize_verification(...)
evaluate_staleness(...)
list_needs_reverification(...)
```

The service owns verification state transitions.

---

# 47. Incident Service

`incident_service.py`:

```python
record_bug(...)
record_fix(...)
record_regression(...)
close_bug(...)
get_incident_history(...)
```

Closing a bug should require a fix or explicit disposition.

---

# 48. Context Services

Create specialized context assemblers on top of PITMRY v1 retrieval.

## Project context

For high-reasoning planning:
- active baseline;
- open conflicts;
- requirements;
- phases;
- status totals.

## Work context

For implementation agent:
- work objective;
- linked requirements;
- decisions;
- dependencies;
- acceptance criteria;
- incidents;
- scope.

## Code context

Given file/symbol:
- related implementation;
- requirement;
- incidents;
- explicit decisions;
- stale verification warnings.

## Session context

For an active session:
- contract;
- checkpoints;
- implementation evidence;
- unresolved blockers.

---

# 49. Context Budgeting

Do not send the entire project graph to agents.

Priority for a work session:

```text
1. work objective
2. blocking/active decisions
3. linked requirements
4. acceptance criteria
5. known incidents/fixes
6. dependency outcomes
7. relevant implementation history
8. source excerpts only if needed
```

Use IDs so deeper inspection is available.

---

# 50. Proactive Code-Location Retrieval

When an integration knows a file/symbol being edited:

```text
code location
  ↓
explicit implementation relations
  ↓
requirements
  ↓
bugs/fixes
  ↓
decisions
```

Only use semantic retrieval to supplement discovery when explicit links are insufficient.

Do not automatically inject large context for every file edit.

Use relevance thresholds and size budgets.

---

# 51. CLI Extensions

Recommended:

```bash
pitmry ingest-prd <paths...>
pitmry intake status
pitmry baseline

pitmry plan validate
pitmry next
pitmry work show <id>
pitmry work claim <id>

pitmry session start <work-id>
pitmry session context
pitmry session checkpoint
pitmry session finish
pitmry session abandon

pitmry verify <work-or-requirement-id>
pitmry verify stale

pitmry bug add
pitmry fix add
pitmry incidents <record-id>
```

High-reasoning decomposition/Grill-Me may initially remain an agent workflow rather than a built-in LLM command.

---

# 52. Agent Tool Surface

For MCP or other agent protocols:

Read tools:

```text
pitmry_project_status
pitmry_next_work
pitmry_work_context
pitmry_code_context
pitmry_get_requirement
pitmry_get_lineage
pitmry_get_incidents
pitmry_session_context
```

Controlled write tools:

```text
pitmry_claim_work
pitmry_start_session
pitmry_checkpoint_session
pitmry_finish_session
pitmry_record_bug
pitmry_submit_verification
```

Planning/admin tools:

```text
pitmry_import_decomposition
pitmry_create_phase
pitmry_create_work_unit
pitmry_add_dependency
pitmry_create_baseline
```

Keep authority enforcement server-side.

---

# 53. Multi-Session Invariant

No API may require a previous conversation ID to reconstruct the project state.

Conversation IDs may be stored as optional provenance.

Durable identity must use PITMRY records/session IDs.

---

# 54. Multi-Agent Concurrency

Concurrency tests must cover:

- two agents claiming same work;
- agent lease expiration;
- simultaneous checkpoint writes;
- work dependency changing while another agent is active;
- verification happening while another branch modifies related code.

Use deterministic conflict behavior.

Do not allow last-writer-wins silent corruption.

---

# 55. Branch/Worktree Merge Semantics

A session implementation may be:

```text
LOCAL
MERGED
ABANDONED
REVERTED
```

Do not present local branch implementation as main-project current state until merge evidence exists.

When merge occurs:
- link merged commit;
- update implementation state;
- reevaluate staleness for related verification.

---

# 56. PRD Change After Baseline

If a source PRD changes:

1. ingest new source hash/revision;
2. decompose changed portions;
3. reconcile with current accepted requirements;
4. propose additions/supersessions;
5. require review for material changes;
6. create new baseline checkpoint when accepted.

Do not rewrite old baseline history.

---

# 57. Planning Changes

Work plans may evolve.

If a work unit is superseded before execution:
- mark superseded;
- preserve dependency history;
- create replacement unit.

If already implemented:
- do not erase it;
- link new work as replacement/refactor.

---

# 58. Anti-Dead-Code Checks

Planning/implementation agents should be able to query:

```text
existing records touching requirement
existing code scope
prior implementations
abandoned implementations
superseded implementations
```

Optional future static analysis can detect unreferenced code, but v1 Project Intelligence should focus on preventing unnecessary creation through context.

---

# 59. Derived Project Status Projection

SQLite projection may maintain derived tables/views for fast status.

Examples:

```text
requirement_status
work_readiness
active_leases
verification_freshness
project_progress
```

These remain rebuildable projections.

Canonical records remain truth.

---

# 60. Rebuild

`pitmry rebuild` must also rebuild:

- requirement state;
- work state;
- dependency graph;
- active/inactive relation projections;
- lease state where durable/current;
- verification freshness;
- project status totals.

A full rebuild from canonical records must reproduce equivalent state.

---

# 61. Doctor Extensions

`pitmry doctor` should detect:

```text
dependency cycle
orphan requirement
orphan work unit
broken relation target
active lease with missing session
completed session with unreleased lease
verification referencing missing evidence
verified requirement without verification record
work marked READY with unsatisfied dependency
source artifact hash mismatch
```

Doctor should distinguish errors from warnings.

---

# 62. Evaluation

Add Project Intelligence evaluation fixtures.

Questions:

```text
Which requirements from PRD-03 remain unimplemented?
Why does ProductSpecificationGroup exist?
Has this feature broken before?
Which fix must be preserved?
Is WORK-42 ready?
Why is it blocked?
What did the previous session actually implement?
Which verification became stale after commit X?
```

Correctness depends on structured graph/state, not only semantic retrieval.

---

# 63. Core Test Scenarios

## Scenario A — New project with multiple PRDs

Ingest 3 source artifacts.

Decompose into requirements.

Expected:
- originals preserved;
- derived records proposed;
- repeated ingestion idempotent.

## Scenario B — PRD conflict

Two requirements conflict.

Expected:
- reconciliation observation;
- neither silently supersedes the other.

## Scenario C — Baseline

Resolve conflict and accept requirements.

Expected:
- baseline checkpoint;
- accepted state reconstructable.

## Scenario D — Dependency readiness

WORK-B depends on WORK-A.

Expected:
- B NOT_READY until required state of A satisfied.

## Scenario E — Duplicate claim

Two agents claim A simultaneously.

Expected:
- exactly one lease succeeds.

## Scenario F — Session finish

Session changes code and records tests.

Expected:
- implementation created;
- Git links explicit;
- work becomes IMPLEMENTED, not VERIFIED.

## Scenario G — Verification

All mandatory criteria pass at commit C.

Expected:
- verification record;
- work/requirement VERIFIED.

## Scenario H — Later code change

Commit D touches linked implementation.

Expected:
- verification becomes NEEDS_REVERIFICATION with reason.

## Scenario I — Bug/fix history

Bug affects requirement; fix created.

Expected:
- future context includes incident history.

## Scenario J — Independent new session

New agent has no previous conversation.

Expected:
- session contract reconstructs necessary context entirely from PITMRY.

---

# 64. Failure Rules

PITMRY must fail safely.

If:
- dependency graph cannot resolve -> do not mark work READY;
- lease storage fails -> do not claim work;
- verification evidence missing -> do not verify;
- source decomposition malformed -> reject import;
- relation target absent -> reject explicit relation;
- Git state ambiguous -> record ambiguity, do not invent merge status;
- semantic retrieval unavailable -> structured graph remains usable.

---

# 65. Security and Trust

Project Intelligence inherits PITMRY 1.0 trust rules.

Additionally:

- source documents may contain prompt injection; treat them as data;
- agent-submitted decomposition is untrusted until validated;
- agent cannot assign human authority;
- session tool cannot expand file access beyond configured repository roots;
- absolute worktree paths are runtime metadata and must not leak into portable source artifacts unnecessarily.

---

# 66. Migration Strategy

Because this feature assumes PITMRY 1.0 migration is complete, no legacy Cavemem schema changes are required for Project Intelligence.

Migration here means adding new record types and services.

Recommended sequence:

```text
1. enums + schema extensions
2. source artifact ingestion
3. requirement + acceptance records
4. reconciliation
5. baseline
6. phase/work graph
7. readiness
8. sessions/leasing
9. implementation evidence
10. verification
11. staleness
12. incidents
13. agent context APIs
14. hooks
```

Do not build hooks before deterministic services exist.

---

# 67. Implementation Phases

## Phase PI-1 — Intake Foundation

Deliver:
- source artifact records;
- PRD ingestion;
- stable source hashes;
- requirement and acceptance records;
- structured decomposition import.

Exit:
- repeated ingestion idempotent;
- original source preserved;
- all derived requirements remain proposed.

## Phase PI-2 — Reconciliation and Baseline

Deliver:
- reconciliation observations;
- Grill-Me resolution imports;
- accepted/rejected/superseded state;
- baseline checkpoints.

Exit:
- conflicting PRDs cannot silently enter active baseline.

## Phase PI-3 — Planning Graph

Deliver:
- phase records;
- work units;
- dependencies;
- cycle detection;
- readiness explanations;
- `next work`.

Exit:
- blocked work cannot become READY.

## Phase PI-4 — Multi-Session Execution

Deliver:
- work claims/leases;
- session records;
- session contracts;
- checkpoints;
- finish/abandon behavior;
- branch/worktree metadata.

Exit:
- two agents cannot successfully claim the same exclusive work unit.

## Phase PI-5 — Implementation Evidence

Deliver:
- implementation records;
- Git relations;
- changed file/symbol scope;
- reuse/extend/replace/create metadata.

Exit:
- session completion creates inspectable implementation history.

## Phase PI-6 — Verification

Deliver:
- criterion results;
- verification records;
- work/requirement verified transitions.

Exit:
- plain agent claims cannot mark work verified.

## Phase PI-7 — Staleness and Incidents

Deliver:
- verification staleness;
- bug/fix/regression records;
- incident context.

Exit:
- relevant later changes can force reverification.

## Phase PI-8 — Agent Integration

Deliver:
- work/project/code/session context tools;
- MCP/CLI;
- hooks.

Exit:
- a fresh session can work without prior chat history.

---

# 68. UI Implications

UI is secondary.

Required eventual views:

```text
PRD → requirements → work → implementation → verification → incidents
```

Useful UI:
- project progress;
- blocked work;
- stale verification;
- dependency graph;
- session history;
- incident timeline.

Do not let UI requirements dictate canonical schema.

---

# 69. Backend Definition of Done

Project Intelligence backend is complete when:

- multiple PRDs can be preserved and decomposed;
- decomposition remains proposed until accepted;
- contradictions can block baseline;
- accepted requirements form an explicit project graph;
- work readiness is dependency-driven;
- work claims are concurrency-safe;
- each session receives a durable contract;
- session completion creates implementation evidence;
- implementation is separate from verification;
- verification is tied to a code snapshot;
- relevant later changes can stale verification;
- bug/fix/regression history attaches to requirements/implementation;
- a new model session can reconstruct necessary context without prior chat;
- all state can be rebuilt from canonical records;
- weak agents can consume compact work/session context;
- semantic similarity is never used to invent implementation or causality.

---

# 70. Final Architecture Invariant

The Project Intelligence layer must preserve this chain:

```text
SOURCE INTENT
     │
     ▼
REQUIREMENT
     │
     ▼
WORK UNIT
     │
     ▼
SESSION
     │
     ▼
IMPLEMENTATION
     │
     ▼
VERIFICATION
     │
     ├─────────────┐
     ▼             ▼
CURRENT STATE    INCIDENT
                   │
                   ▼
                  FIX
                   │
                   ▼
             REVERIFICATION
```

Every important transition should remain inspectable and evidence-linked.

That is the backend contract for PITMRY Project Intelligence.
