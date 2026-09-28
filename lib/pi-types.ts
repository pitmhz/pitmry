/**
 * Project Intelligence client types.
 *
 * These mirror the `ProjectContext` payload emitted by
 * `server/pitmry/project_intelligence.py` (project_context, lines ~1331-1375).
 * The backend has no per-type JSON schema: `content` is a free-form mapping by
 * design, so the shapes below are the wire contract, not a generated type.
 *
 * Two model facts the UI must not violate:
 *
 * 1. `READY` is never a stored state. A work unit is created as `PLANNED` and
 *    readiness is a *derived* boolean plus structured blocking reasons. Render
 *    `state` and `readiness` as two independent axes.
 * 2. The `records` endpoint's `state` filter resolves through `state_resolver`
 *    (CURRENT / HISTORICAL / SUPERSEDED / UNKNOWN), which returns UNKNOWN for
 *    every Project Intelligence type. Never filter Project Intelligence rows by
 *    lifecycle through that endpoint. Use `project_context` instead.
 */

export type PiState =
  // requirement lifecycle
  | "PROPOSED"
  | "ACCEPTED"
  | "PLANNED"
  | "IN_PROGRESS"
  | "IMPLEMENTED"
  | "VERIFIED"
  | "NEEDS_REVERIFICATION"
  | "BLOCKED"
  | "REGRESSED"
  | "SUPERSEDED"
  | "REJECTED"
  // session lifecycle
  | "CREATED"
  | "ACTIVE"
  | "FINISHING"
  | "COMPLETED"
  | "FAILED"
  | "ABANDONED"
  // work + phase + plan validation
  | "VERIFYING"
  | "NOT_READY"
  // incident lifecycle
  | "OPEN"
  | "CLOSED"
  | (string & {});

export type PiReadinessCode =
  | "DEPENDENCY_NOT_VERIFIED"
  | "BLOCKING_DECISION_INACTIVE"
  | "NO_LINKED_REQUIREMENTS"
  | "REQUIREMENT_NOT_ACCEPTED"
  | "MISSING_ACCEPTANCE_CRITERIA"
  | "CRITERION_NOT_ACCEPTED"
  | "DEPENDENCY_CYCLE"
  | "CRITICAL_RECONCILIATION_OPEN"
  | "WORK_SUPERSEDED"
  | "WORK_ALREADY_COMPLETE"
  | "ACTIVE_LEASE"
  | (string & {});

export type PiBlockingReason = {
  code: PiReadinessCode;
  record_id: string;
  state?: string;
};

export type PiReadiness = {
  ready: boolean;
  blocking_reasons: PiBlockingReason[];
};

export type PiWorkUnit = {
  id: string;
  title: string;
  objective: string;
  state: PiState;
  phase_id: string | null;
  requirement_ids: string[];
  dependency_ids: string[];
  session_ids: string[];
  implementation_ids: string[];
  verification_ids: string[];
  readiness: PiReadiness;
};

export type PiPhase = {
  id: string;
  name: string;
  ordinal: number;
  objective?: string;
  state: PiState;
};

export type PiRequirement = {
  id: string;
  statement: string;
  kind?: string;
  priority?: string;
  state: PiState;
};

export type PiSession = {
  id: string;
  title: string;
  state: PiState;
  work_unit_id: string | null;
  branch?: string | null;
  worktree?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  base_commit?: string | null;
  head_commit?: string | null;
  read_only: boolean;
  known_incidents: { id: string; type: string; title: string; summary: string; state: string }[];
  previous_failed_attempts: { id: string; title: string; summary: string }[];
};

export type PiImplementation = {
  id: string;
  summary: string;
  work_unit_id: string | null;
  session_id: string | null;
  commit_sha: string | null;
  changed_files: string[];
  reuse_decision?: { mode: "REUSE" | "EXTEND" | "REPLACE" | "CREATE"; target?: string; reason?: string } | null;
};

export type PiVerification = {
  id: string;
  summary: string;
  overall: "PASS" | "FAIL" | string;
  verification_type: "automated" | "agent_reviewed" | "human_confirmed" | "runtime_observed" | string;
  commit_sha: string | null;
  work_ids: string[];
  created_at?: string | null;
};

export type PiIncident = {
  id: string;
  type: "bug" | "fix" | "regression" | string;
  title: string;
  summary: string;
  state: PiState;
  related_ids: string[];
};

export type PiReconciliation = {
  id: string;
  classification:
    | "DUPLICATE"
    | "OVERLAP"
    | "DEPENDENCY"
    | "CONFLICT"
    | "MISSING_PREREQUISITE"
    | "TERMINOLOGY_MISMATCH"
    | string;
  summary: string;
  record_ids?: string[];
  status?: string;
};

export type PiPlanError = { code: string; record_id?: string; dependency_id?: string };

export type PiReleaseReadiness = {
  ready: boolean;
  baseline_id: string | null;
  required_requirements: number;
  verified_requirements: number;
  release_checks: number;
  stale_requirement_ids: string[];
  blocking_reasons: PiBlockingReason[];
};

export type ProjectContext = {
  project_id: string;
  project_name: string;
  baseline_id: string | null;
  open_reconciliations: PiReconciliation[];
  phases: PiPhase[];
  work_state_counts: Record<string, number>;
  requirement_state_counts: Record<string, number>;
  open_bug_ids: string[];
  stale_verification_event_ids: string[];
  work_units: PiWorkUnit[];
  requirements: PiRequirement[];
  dependencies: { work_id: string; depends_on_id: string }[];
  sessions: PiSession[];
  implementations: PiImplementation[];
  verifications: PiVerification[];
  incidents: PiIncident[];
  plan_validation: { valid: boolean; errors: PiPlanError[] };
  release_readiness: PiReleaseReadiness;
};

export type PiApiResponse = {
  status: string;
  projects?: ProjectContext[];
  message?: string;
};

/**
 * How long a Project Intelligence read may take before it is treated as failed.
 *
 * The caller's own AbortController only fires on unmount, so without a deadline
 * a backend that stops responding leaves the console on its loading state
 * indefinitely. The deadline turns that into an error the UI can report.
 */
const PI_READ_TIMEOUT_MS = 20_000;

export async function fetchProjectContexts(signal?: AbortSignal): Promise<ProjectContext[]> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), PI_READ_TIMEOUT_MS);
  // A caller-supplied signal must still be able to cancel the request.
  const onAbort = () => timeout.abort();
  signal?.addEventListener("abort", onAbort);

  try {
    const response = await fetch("/api/memory?action=project-intelligence", {
      cache: "no-store",
      signal: timeout.signal,
    });
    const data = (await response.json()) as PiApiResponse;
    if (!response.ok || data.status !== "OK") {
      throw new Error(data.message || "Project Intelligence data is unavailable.");
    }
    return data.projects ?? [];
  } catch (cause) {
    // An abort that was not requested by the caller is our own deadline firing.
    if (timeout.signal.aborted && !signal?.aborted) {
      throw new Error(
        `The local backend did not answer within ${PI_READ_TIMEOUT_MS / 1000} seconds.`,
      );
    }
    throw cause;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
