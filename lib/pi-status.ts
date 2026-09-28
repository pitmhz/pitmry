"use client";

/**
 * Project Intelligence status vocabulary.
 *
 * One place decides what a lifecycle state looks like, so the board, the map,
 * the navigator and the inspector cannot drift apart. Every colour resolves
 * through the semantic tokens in `globals.css` (--success / --warning /
 * --danger / --info) rather than a stock Tailwind palette, so accent switching
 * and the light theme stay coherent.
 */

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

export type StatusDescriptor = {
  tone: StatusTone;
  label: string;
  /** Short plain-language reading shown as the title attribute and in tooltips. */
  meaning: string;
};

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  success: "bg-success/12 text-success border-success/35",
  warning: "bg-warning/14 text-warning border-warning/38",
  danger: "bg-danger/12 text-danger border-danger/35",
  info: "bg-info/12 text-info border-info/32",
  accent: "bg-primary/12 text-primary border-primary/35",
};

const TONE_DOT: Record<StatusTone, string> = {
  neutral: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  accent: "bg-primary",
};

export function statusToneClass(tone: StatusTone): string {
  return TONE_CLASS[tone];
}

export function statusDotClass(tone: StatusTone): string {
  return TONE_DOT[tone];
}

const STATE_STATUS: Record<string, StatusDescriptor> = {
  // Requirement + work lifecycle.
  PROPOSED: { tone: "neutral", label: "Proposed", meaning: "Decomposed but not yet reviewed." },
  ACCEPTED: { tone: "info", label: "Accepted", meaning: "Part of the accepted baseline intent." },
  PLANNED: { tone: "neutral", label: "Planned", meaning: "Scheduled into a phase, not started." },
  IN_PROGRESS: { tone: "accent", label: "In progress", meaning: "A session is actively working on it." },
  IMPLEMENTED: { tone: "info", label: "Implemented", meaning: "Code exists. Not evidence that it is correct." },
  VERIFIED: { tone: "success", label: "Verified", meaning: "Acceptance criteria confirmed against a commit." },
  NEEDS_REVERIFICATION: {
    tone: "warning",
    label: "Needs reverification",
    meaning: "Later changes touched its implementation, so the old proof no longer holds.",
  },
  BLOCKED: { tone: "danger", label: "Blocked", meaning: "Something prevents progress." },
  REGRESSED: { tone: "danger", label: "Regressed", meaning: "It was working and a linked incident broke it." },
  SUPERSEDED: { tone: "neutral", label: "Superseded", meaning: "Replaced by a later, evidence-backed decision." },
  REJECTED: { tone: "neutral", label: "Rejected", meaning: "Reviewed and declined." },

  // Session lifecycle.
  CREATED: { tone: "neutral", label: "Created", meaning: "Contract issued, not started." },
  ACTIVE: { tone: "accent", label: "Active", meaning: "An agent holds this lease right now." },
  FINISHING: { tone: "warning", label: "Finishing", meaning: "Work is wrapping up, evidence being captured." },
  COMPLETED: { tone: "success", label: "Completed", meaning: "Session closed with implementation evidence." },
  FAILED: { tone: "danger", label: "Failed", meaning: "Session ended without producing work." },
  ABANDONED: { tone: "warning", label: "Abandoned", meaning: "Stopped mid-flight. The lease was released." },

  // Plan + release.
  NOT_READY: { tone: "warning", label: "Not ready", meaning: "Dependencies are not satisfied." },
  VERIFYING: { tone: "info", label: "Verifying", meaning: "Verification is in progress." },

  // Incidents.
  OPEN: { tone: "danger", label: "Open", meaning: "Unresolved." },
  CLOSED: { tone: "success", label: "Closed", meaning: "Resolved with a linked fix or disposition." },
};

export function describeState(state: string | null | undefined): StatusDescriptor {
  if (!state) return { tone: "neutral", label: "Unknown", meaning: "No lifecycle state recorded." };
  const known = STATE_STATUS[state.toUpperCase()];
  if (known) return known;
  return {
    tone: "neutral",
    label: state.replace(/_/g, " ").toLowerCase(),
    meaning: "State reported by the backend.",
  };
}

/** Readiness is derived, never a stored state, so it is described separately
 * from the lifecycle. This is the distinction the whole console protects. */
export function describeReadiness(ready: boolean, state: string | null | undefined): StatusDescriptor {
  if (ready) {
    return {
      tone: "success",
      label: "Ready",
      meaning: `All dependencies satisfied. Actionable while it stays ${describeState(state).label.toLowerCase()}.`,
    };
  }
  return {
    tone: "warning",
    label: "Not ready",
    meaning: "Dependencies are not satisfied. See the blocking reasons.",
  };
}

const VERIFICATION_TONE: Record<string, StatusTone> = {
  PASS: "success",
  FAIL: "danger",
};

export function verificationTone(overall: string | null | undefined): StatusTone {
  if (!overall) return "neutral";
  return VERIFICATION_TONE[overall.toUpperCase()] ?? "neutral";
}

const VERIFICATION_MEANING: Record<string, string> = {
  automated: "Recorded by a test or build run.",
  agent_reviewed: "Reviewed by a model. Strong, but not human authority.",
  human_confirmed: "Confirmed by a person. The strongest evidence type.",
  runtime_observed: "Observed running, not only statically checked.",
};

export function verificationTypeMeaning(type: string): string {
  return VERIFICATION_MEANING[type] ?? "Verification type reported by the backend.";
}

/** Verification strength ordering, used to sort the ledger weakest-first so
 * the entries that need attention surface at the top. */
const VERIFICATION_RANK: Record<string, number> = {
  FAIL: 0,
  PASS: 3,
  agent_reviewed: 2,
  automated: 1,
  runtime_observed: 2,
  human_confirmed: 4,
};

export function verificationRank(verification: { overall: string; verification_type: string }): number {
  return VERIFICATION_RANK[verification.verification_type] ?? 1;
}

export type BlockerExplanation = { title: string; detail: string };

/** Plain-language reading of the ten backend blocking codes. The backend
 * returns evidence-bearing codes; this is the "why does this matter" layer
 * that a developer needs in order to act. */
const BLOCKER_COPY: Record<string, BlockerExplanation> = {
  DEPENDENCY_NOT_VERIFIED: {
    title: "Dependency not verified",
    detail: "A work unit this depends on is implemented but its acceptance criteria are not confirmed. Prove the dependency first.",
  },
  BLOCKING_DECISION_INACTIVE: {
    title: "Blocking decision inactive",
    detail: "A decision this work relies on has been superseded or reverted. Re-read the replacement before coding.",
  },
  NO_LINKED_REQUIREMENTS: {
    title: "No linked requirement",
    detail: "Nothing in the accepted baseline justifies this work. Link a requirement or drop the unit.",
  },
  REQUIREMENT_NOT_ACCEPTED: {
    title: "Requirement not accepted",
    detail: "A linked requirement is still proposed or rejected. Accept it through review before planning against it.",
  },
  MISSING_ACCEPTANCE_CRITERIA: {
    title: "Missing acceptance criteria",
    detail: "There is nothing to verify against. Add criteria, otherwise completion cannot be proven.",
  },
  CRITERION_NOT_ACCEPTED: {
    title: "Criterion not accepted",
    detail: "One acceptance criterion is still proposed. Review it before this work can proceed.",
  },
  DEPENDENCY_CYCLE: {
    title: "Dependency cycle",
    detail: "These units depend on each other. Break the loop in the plan before any of them can start.",
  },
  CRITICAL_RECONCILIATION_OPEN: {
    title: "Critical reconciliation open",
    detail: "Two source artifacts disagree about this area and no one has resolved it yet.",
  },
  WORK_SUPERSEDED: {
    title: "Work superseded",
    detail: "A later unit replaced this one. Do not implement it.",
  },
  WORK_ALREADY_COMPLETE: {
    title: "Work already complete",
    detail: "This unit is already implemented. Verify it or close it rather than redoing it.",
  },
  ACTIVE_LEASE: {
    title: "Held by another agent",
    detail: "Another session holds a live lease on this unit. It is not available to claim.",
  },
};

export function explainBlocker(code: string): BlockerExplanation {
  return (
    BLOCKER_COPY[code] ?? {
      title: code.replace(/_/g, " ").toLowerCase(),
      detail: "Reported by the backend as a readiness blocker.",
    }
  );
}

const RELEASE_COPY: Record<string, { title: string; detail: string; tone: StatusTone }> = {
  BASELINE_MISSING: {
    title: "No accepted baseline",
    detail: "Review the imported requirements and record a baseline before the project can be considered complete.",
    tone: "danger",
  },
  REQUIREMENT_NOT_VERIFIED: {
    title: "Requirement not verified",
    detail: "A mandatory requirement has no passing verification against a commit.",
    tone: "danger",
  },
  CRITICAL_CONFLICT_OPEN: {
    title: "Critical conflict open",
    detail: "An unresolved reconciliation is blocking the release.",
    tone: "danger",
  },
  BUG_OPEN: {
    title: "Open bug",
    detail: "A known defect is still open.",
    tone: "danger",
  },
  REGRESSION_OPEN: {
    title: "Open regression",
    detail: "A regression has no linked fix.",
    tone: "danger",
  },
  RELEASE_CHECK_NOT_VERIFIED: {
    title: "Release check not verified",
    detail: "A configured release gate has no verification evidence.",
    tone: "warning",
  },
};

export function explainReleaseBlocker(code: string): { title: string; detail: string; tone: StatusTone } {
  return (
    RELEASE_COPY[code] ?? {
      title: code.replace(/_/g, " ").toLowerCase(),
      detail: "Reported by the backend as a release blocker.",
      tone: "warning",
    }
  );
}

/** Human ordering for the work board columns. Not alphabetical, not insertion
 * order: the sequence a developer actually moves a task through. */
export const WORK_BOARD_ORDER: string[] = [
  "PLANNED",
  "IN_PROGRESS",
  "IMPLEMENTED",
  "VERIFIED",
  "NEEDS_REVERIFICATION",
  "REGRESSED",
  "BLOCKED",
  "SUPERSEDED",
];
