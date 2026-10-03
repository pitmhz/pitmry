/**
 * Capability registry for the record inspector.
 *
 * ## The problem
 *
 * The old inspector was one component with two hardcoded tabs ("journey",
 * "neighbors") and a diff modal. It rendered the same shape for every record,
 * so a work unit and an acceptance criterion got identical treatment even
 * though the useful facts about them are completely different. Most of the
 * panel was empty, and the parts that mattered were buried.
 *
 * ## The model
 *
 * A **capability** is a question the panel can answer about the selected
 * record. Which capabilities are offered depends on the record's kind, so the
 * panel is context-aware rather than fixed:
 *
 *   work unit      -> overview, readiness, chain, session, evidence, diff
 *   requirement    -> overview, criteria, chain
 *   implementation -> overview, session, evidence, verification, diff
 *   verification   -> overview, chain, evidence
 *   test result    -> overview, evidence, chain
 *   decision       -> overview, chain, relations, diff
 *   git change     -> overview, evidence, diff
 *
 * Capabilities are declared as data, not as conditionals inside a render, so
 * adding one is a single entry rather than a new branch in a component. Each
 * declares whether it needs a capability the record may not have, which is how
 * a diff tab stays hidden for a requirement instead of rendering empty.
 *
 * ## Why this is not decoration
 *
 * The Project Intelligence PRD's whole argument is that the unit of value is a
 * connected record, not a row. This registry is the UI expression of that: the
 * panel assembles the connected view for whatever is selected, and every
 * section states its own provenance so a reader can tell recorded fact from
 * derived conclusion.
 */

import type { RecordClass } from "./pi-dossier.ts";

export type CapabilityId =
  | "overview"
  | "trust"
  | "readiness"
  | "criteria"
  | "chain"
  | "session"
  | "evidence"
  | "verification"
  | "relations"
  | "diff"
  | "raw";

export type CapabilityDefinition = {
  id: CapabilityId;
  /** Tab label. Short, because the tab bar is narrow. */
  label: string;
  /** One line describing what this tab answers. */
  hint: string;
  /**
   * Record prefixes this capability needs. The tab is hidden when the selected
   * record has none of them, so a diff tab never appears on a requirement.
   */
  requires?: string[];
  /**
   * Record prefixes for which the tab is *urgent*: it is shown ahead of the
   * others because a record in one of these classes is currently wrong.
   */
  alert?: string[];
  /** Icon key, resolved by the panel to avoid importing icons into data. */
  icon: "info" | "gauge" | "check" | "link" | "play" | "file" | "shield" | "share" | "code" | "braces" | "alert";
};

export const CAPABILITIES: Record<CapabilityId, CapabilityDefinition> = {
  overview: {
    id: "overview",
    label: "Overview",
    hint: "Identity, authority, lifecycle state and the claim this record makes",
    icon: "info",
  },
  trust: {
      id: "trust",
      label: "Trust",
      hint: "Whether this claim is contradicted, what it rests on, and how it was recorded",
      requires: ["dec", "req", "ac", "chk", "obs"],
      icon: "alert",
    },
    readiness: {
    id: "readiness",
    label: "Readiness",
    hint: "Why this work can or cannot start, and what it depends on",
    requires: ["work"],
    icon: "gauge",
  },
  criteria: {
    id: "criteria",
    label: "Criteria",
    hint: "Acceptance criteria that define what done means",
    requires: ["req", "work"],
    icon: "check",
  },
  chain: {
    id: "chain",
    label: "Chain",
    hint: "Recorded edges from this record through implementation to proof",
    icon: "link",
  },
  session: {
    id: "session",
    label: "Session",
    hint: "The contract, lease, branch and known failure modes an agent inherits",
    requires: ["work", "sess", "impl"],
    icon: "play",
  },
  evidence: {
    id: "evidence",
    label: "Evidence",
    hint: "Commits, files changed and the artifacts this record points at",
    requires: ["impl", "git", "test", "ver", "work"],
    icon: "file",
  },
  verification: {
    id: "verification",
    label: "Verified",
    hint: "What was proven, by what evidence, and whether the proof still holds",
    requires: ["test", "ver", "impl", "work"],
    icon: "shield",
  },
  relations: {
    id: "relations",
    label: "Relations",
    hint: "Explicit evidence-backed links, kept separate from similarity hints",
    icon: "share",
  },
  diff: {
    id: "diff",
    label: "Diff",
    hint: "The recorded code change for this record",
    requires: ["git", "impl", "work"],
    icon: "code",
  },
  raw: {
    id: "raw",
    label: "Record",
    hint: "The complete canonical record as stored",
    icon: "braces",
  },
};

/** Which capabilities a record kind offers, in tab order. */
const BY_PREFIX: Record<string, CapabilityId[]> = {
  work: ["overview", "readiness", "criteria", "chain", "session", "evidence", "verification", "diff", "raw"],
  req: ["overview", "trust", "criteria", "chain", "relations", "raw"],
  ac: ["overview", "trust", "chain", "raw"],
  ph: ["overview", "chain", "raw"],
  sess: ["overview", "session", "chain", "raw"],
  impl: ["overview", "session", "evidence", "verification", "diff", "chain", "raw"],
  ver: ["overview", "verification", "evidence", "chain", "raw"],
  test: ["overview", "evidence", "verification", "chain", "raw"],
  bug: ["overview", "chain", "relations", "raw"],
  fix: ["overview", "chain", "relations", "raw"],
  reg: ["overview", "chain", "relations", "raw"],
  src: ["overview", "chain", "raw"],
  dec: ["overview", "trust", "chain", "relations", "diff", "raw"],
  git: ["overview", "evidence", "diff", "chain", "raw"],
  obs: ["overview", "trust", "chain", "raw"],
  chk: ["overview", "trust", "chain", "raw"],
  rel: ["overview", "relations", "raw"],
  sum: ["overview", "chain", "raw"],
  dis: ["overview", "chain", "raw"],
};

/** Fallback for an unknown prefix, so a new record type still renders. */
const DEFAULT_CAPABILITIES: CapabilityId[] = ["overview", "trust", "chain", "relations", "raw"];

export function prefixOf(id: string): string {
  return id.split("_")[0] ?? "";
}

/** The ordered capability list for a record. */
export function capabilitiesFor(id: string): CapabilityDefinition[] {
  const prefix = prefixOf(id);
  const ids = BY_PREFIX[prefix] ?? DEFAULT_CAPABILITIES;
  return ids.map((capabilityId) => CAPABILITIES[capabilityId]);
}

/** True when a capability has something to show for this record. Capabilities
 * that require a prefix are hidden when the record does not have one. */
export function capabilityApplies(capability: CapabilityDefinition, id: string): boolean {
  if (!capability.requires || capability.requires.length === 0) return true;
  const prefix = prefixOf(id);
  return capability.requires.includes(prefix);
}

/**
 * The lifecycle stage a capability mainly serves, used to group the tab bar.
 * Overview is always first and always present.
 */
export function stageForCapability(capability: CapabilityId): RecordClass | null {
  switch (capability) {
    case "trust":
      return "intent";
    case "readiness":
    case "criteria":
      return "plan";
    case "session":
      return "work";
    case "evidence":
    case "verification":
    case "diff":
      return "evidence";
    case "chain":
    case "relations":
      return "relation";
    default:
      return null;
  }
}
