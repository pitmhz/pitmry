/**
 * Record taxonomy and the Project Intelligence dossier schema.
 *
 * ## The problem this solves
 *
 * The `records` endpoint returns every canonical record with a flattened
 * legacy type: Project Intelligence records (requirements, acceptance
 * criteria, phases, work units, sessions, test results, and the relation graph
 * itself) all arrive as `type: "other"`. The dashboard therefore rendered a
 * `portfolio` project as an undifferentiated wall of ~370 cards, where a
 * relation edge and an architecture decision looked the same and neither
 * carried any traceable identity.
 *
 * Measured on this checkout, `portfolio/.pitmry/records` holds 449 records:
 *
 *   relation 143   observation 138   acceptance_criterion 62   requirement 21
 *   decision 18    git_change 17      test_result 15            work_unit 12
 *   phase 8        implementation 5   session 5                 source_artifact 3
 *
 * So the Project Intelligence graph was fully built, and the UI had no schema
 * for showing it. That is the gap this module fills.
 *
 * ## The classification
 *
 * Two things separate a record cleanly and without guessing:
 *
 * 1. **The id prefix.** `server/pitmry/ids.py` enforces prefix-to-type on
 *    load, so `req_` is always a requirement and `work_` is always a work
 *    unit. It is a machine-checkable discriminator, not a heuristic.
 * 2. **The lifecycle stage.** The Project Intelligence backend specification
 *    defines one chain, and every record belongs to exactly one stage of it.
 *
 * Stages follow the specification's chain, and the dossier renders them in
 * this order, so a reader always sees a record's position in the causal
 * history rather than a flat property dump.
 */

// Relative, not the "@/" alias: this module is executed directly by the
// verification scripts under `node --experimental-strip-types`, which cannot
// resolve a bundler alias.
import type { MemoryItem } from "./types.ts";

export type RecordClass = "intent" | "plan" | "work" | "evidence" | "incident" | "log" | "relation";

export type Stage = {
  id: RecordClass;
  /** Short name for a column header or a chip. */
  label: string;
  /** One line explaining what belongs here, shown as the group description. */
  description: string;
  /** Ordering in the dossier, following the backend's causal chain. */
  order: number;
};

export const STAGES: Stage[] = [
  {
    id: "intent",
    label: "Intent",
    description: "What was asked for, and the decisions that shaped it.",
    order: 1,
  },
  {
    id: "plan",
    label: "Plan",
    description: "Phases, requirements, and the criteria that define done.",
    order: 2,
  },
  {
    id: "work",
    label: "Work",
    description: "Bounded units of implementation, their leases, and sessions.",
    order: 3,
  },
  {
    id: "evidence",
    label: "Evidence",
    description: "Code changes, test results, and the verifications that passed them.",
    order: 4,
  },
  {
    id: "incident",
    label: "Incidents",
    description: "Defects, regressions, and the fixes that closed them.",
    order: 5,
  },
  {
    id: "log",
    label: "History",
    description: "Session summaries, checkpoints, and other durable traces.",
    order: 6,
  },
  {
    id: "relation",
    label: "Relations",
    description: "Evidence-backed edges. These carry no state; they explain it.",
    order: 7,
  },
];

const STAGE_BY_ID = new Map(STAGES.map((stage) => [stage.id, stage]));

export function stageFor(recordClass: RecordClass): Stage {
  return STAGE_BY_ID.get(recordClass) ?? STAGES[STAGES.length - 1];
}

/**
 * Canonical id prefix to record class. Enforced by `server/pitmry/ids.py`, so
 * this is a table, not a guess.
 */
const PREFIX_CLASS: Record<string, RecordClass> = {
  src: "intent",
  dec: "intent",
  req: "plan",
  ac: "plan",
  ph: "plan",
  work: "work",
  sess: "work",
  obs: "work",
  impl: "evidence",
  ver: "evidence",
  test: "evidence",
  chk: "evidence",
  git: "evidence",
  bug: "incident",
  fix: "incident",
  reg: "incident",
  sum: "log",
  rel: "relation",
};

/**
 * Full canonical type name to record class.
 *
 * The record's `type` field is the long form ("work_unit", "source_artifact")
 * while its id uses the short prefix ("work_...", "src_..."). Both appear in
 * the API, so both are mapped. Without this, a record read by its `type`
 * falls through to the unclassified bucket, which is exactly the bug that made
 * every Project Intelligence record look identical in the old dashboard.
 */
const TYPE_CLASS: Record<string, RecordClass> = {
  source_artifact: "intent",
  decision: "intent",
  constraint: "intent",
  requirement: "plan",
  acceptance_criterion: "plan",
  phase: "plan",
  work_unit: "work",
  session: "work",
  observation: "work",
  implementation: "evidence",
  verification: "evidence",
  test_result: "evidence",
  build_result: "evidence",
  checkpoint: "evidence",
  git_change: "evidence",
  bug: "incident",
  fix: "incident",
  regression: "incident",
  session_summary: "log",
  relation: "relation",
  adr: "intent",
  commit: "evidence",
  grill: "intent",
  discussion: "intent",
};

/** Human-readable type name for each prefix. */
export const TYPE_NAME: Record<string, string> = {
  src: "Source artifact",
  dec: "Decision",
  req: "Requirement",
  ac: "Acceptance criterion",
  ph: "Phase",
  work: "Work unit",
  sess: "Session",
  obs: "Observation",
  impl: "Implementation",
  ver: "Verification",
  test: "Test result",
  chk: "Checkpoint",
  git: "Git change",
  bug: "Bug",
  fix: "Fix",
  reg: "Regression",
  sum: "Session summary",
  rel: "Relation",
  // Long-form aliases, so a lookup by `type` resolves to the same label.
  source_artifact: "Source artifact",
  decision: "Decision",
  constraint: "Constraint",
  requirement: "Requirement",
  acceptance_criterion: "Acceptance criterion",
  phase: "Phase",
  work_unit: "Work unit",
  session: "Session",
  observation: "Observation",
  implementation: "Implementation",
  verification: "Verification",
  test_result: "Test result",
  build_result: "Build result",
  checkpoint: "Checkpoint",
  git_change: "Git change",
  session_summary: "Session summary",
  relation: "Relation",
  adr: "Decision",
  commit: "Git change",
  grill: "Discussion",
  discussion: "Discussion",
};

/** The specific record type, resolved from the prefix. Null when unknown. */
export function recordKind(id: string): string | null {
  const prefix = id.split("_")[0];
  return PREFIX_CLASS[prefix] ? prefix : null;
}

export function classifyId(id: string): RecordClass {
  const prefix = id.split("_")[0];
  return PREFIX_CLASS[prefix] ?? "log";
}

/** Classify by the record's declared `type`, which is the long form. */
export function classifyType(type: string | null | undefined): RecordClass {
  if (!type) return "log";
  return TYPE_CLASS[type] ?? "log";
}

export function typeNameFor(id: string, type?: string | null): string {
  const kind = recordKind(id);
  if (kind) return TYPE_NAME[kind] ?? kind.toUpperCase();
  if (type && TYPE_NAME[type]) return TYPE_NAME[type];
  return "Record";
}

/**
 * Classify a record for display.
 *
 * Falls back to the legacy `type` for migrated records that predate the
 * Project Intelligence id scheme, and to tags, so a legacy ADR imported from
 * Cavemem still lands in Intent rather than in an unclassified bucket.
 */
export function classifyRecord(item: MemoryItem): RecordClass {
  const id = String(item.id);
  // The id prefix is authoritative when present: the backend enforces it on
  // load, so it cannot disagree with the type field.
  if (recordKind(id)) return classifyId(id);

  const canonical = (item as { canonical_type?: string }).canonical_type ?? item.type;

  // Legacy migration path: older records use adr / commit / grill / summary.
  switch (canonical) {
    case "adr":
      return "intent";
    case "commit":
      return "evidence";
    case "grill":
      return "intent";
    default:
      break;
  }

  const byType = TYPE_CLASS[canonical];
  if (byType) return byType;

  const tags = (item.tags ?? []).map((tag: string) => tag.toLowerCase());
  if (tags.some((tag) => ["requirement", "acceptance-criterion", "phase", "work-unit"].includes(tag))) {
    return "plan";
  }
  if (tags.includes("lease") || tags.includes("session")) return "work";
  if (tags.includes("test-result") || tags.includes("build-result")) return "evidence";
  if (tags.includes("project-intelligence")) return "plan";
  return "log";
}

/** True when the record is part of the Project Intelligence graph rather than
 * the raw memory history. */
export function isProjectIntelligence(item: MemoryItem): boolean {
  return classifyRecord(item) !== "log";
}

/* ------------------------------------------------------------------ *
 * Dossier schema
 * ------------------------------------------------------------------ */

export type DossierField = {
  label: string;
  value: string;
  /** Rendered in a monospace face, for ids, refs and commits. */
  mono?: boolean;
  /** A short explanation shown on hover. */
  hint?: string;
};

export type DossierGroup = {
  id: string;
  title: string;
  /** Explains why this group is on screen, or what it means when empty. */
  caption: string;
  fields: DossierField[];
  /** Relations listed under this group, kept apart from scalar fields. */
  links?: DossierLink[];
  /** Groups that describe risk render with a warning treatment. */
  tone?: "default" | "warning" | "danger";
  /** True when the record genuinely has nothing in this section. */
  empty?: boolean;
};

export type DossierLink = {
  id: string;
  label: string;
  /** Relation verb, e.g. "implements" or "depends on". */
  relation: string;
  state?: string | null;
  /** Explicit edges are evidence; inferred edges are discovery hints. */
  provenance: "explicit" | "inferred";
};

export type Dossier = {
  id: string;
  kind: string;
  kindLabel: string;
  stage: Stage;
  title: string;
  summary?: string;
  groups: DossierGroup[];
};

function field(label: string, value: unknown, options: { mono?: boolean; hint?: string } = {}): DossierField | null {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value) && value.length === 0) return null;
  const text = Array.isArray(value) ? value.join(", ") : String(value);
  return { label, value: text, mono: options.mono, hint: options.hint };
}

function group(
  id: string,
  title: string,
  caption: string,
  fields: (DossierField | null)[],
  extra: Partial<DossierGroup> = {},
): DossierGroup {
  const present = fields.filter((entry): entry is DossierField => entry !== null);
  return {
    id,
    title,
    caption,
    fields: present,
    empty: present.length === 0 && !(extra.links?.length ?? 0),
    ...extra,
  };
}

/**
 * Build the dossier for any record.
 *
 * The schema is uniform across record classes: identity, lifecycle,
 * traceability, evidence, risk, provenance. A work unit and an acceptance
 * criterion answer the same six questions, so a reader who learns the panel
 * once can read any record. Only the populated groups render.
 */
export function buildDossier(item: MemoryItem): Dossier {
  const id = String(item.id);
  const canonicalType = (item as { canonical_type?: string }).canonical_type ?? item.type;
  const kind = recordKind(id) ?? legacyKindName(canonicalType);
  const stage = stageFor(classifyRecord(item));
  const groups: DossierGroup[] = [];

  // 1. Identity. Always present: a record without provenance is untrustworthy.
  groups.push(
    group("identity", "Identity", "What this record is, and whether it can be trusted.", [
      field("Record id", id, { mono: true }),
      field("Type", TYPE_NAME[kind] ?? kind, {
        hint: "Derived from the canonical id prefix, which the backend enforces on load.",
      }),
      field("Canonical type", canonicalType, { mono: true }),
      field("Project", item.project),
      field("Authority", item.authority, {
        hint: "Authority is what lets a reader judge the claim. Imported or agent-reported claims are not human decisions.",
      }),
      field("Truth domain", (item as { truth_domain?: string }).truth_domain),
      field("Recorded", item.timestamp),
    ]),
  );

  // 2. Lifecycle.
  const lifecycleFields = [
    field("State", item.state, {
      hint: "Resolved from the canonical event chain, not from search rank.",
    }),
    field("Priority", (item as { priority?: string }).priority),
    field("Ordinal", (item as { ordinal?: number }).ordinal),
  ];
  groups.push(
    group(
      "lifecycle",
      "Lifecycle",
      "Where this sits in the plan, and how far it has progressed.",
      lifecycleFields,
    ),
  );

  // 3. The statement or rationale. Different record classes carry different
  //    payload keys, so all of them are checked rather than assuming one.
  const statement =
    item.rationale ?? item.summary ?? (item as { objective?: string }).objective ?? undefined;
  if (statement) {
    groups.push(
      group("statement", "Statement", "The claim this record makes.", [
        field(stage.id === "intent" ? "Rationale" : "Detail", statement),
      ]),
    );
  }

  // 4. Traceability and evidence.
  const relatedFiles = (item as { related_files?: string[] }).related_files ?? [];
  const relatedSymbols = (item as { related_symbols?: string[] }).related_symbols ?? [];
  const commit = item.commit_hash ?? (item as { commit_sha?: string }).commit_sha;
  const evidenceFields = [
    field("Commit", commit, { mono: true }),
    field("Files touched", relatedFiles.length ? `${relatedFiles.length} files` : null),
    field("Symbols touched", relatedSymbols.length ? `${relatedSymbols.length} symbols` : null),
    field("Tags", (item.tags ?? []).map((tag) => `#${tag}`)),
  ];
  groups.push(
    group(
      "evidence",
      "Code and evidence",
      "The objective artifacts this record points at.",
      evidenceFields,
    ),
  );

  // 5. Risk. A record that needs attention says so here and nowhere else, so
  //    the reader knows this group is the one that can block progress.
  const riskFields = [
    field("Blockers", (item as { blocking_reasons?: unknown[] }).blocking_reasons?.length ?? 0, {
      hint: "Readiness is derived from dependencies, not stored as a state.",
    }),
    field("Needs reverification", item.state === "NEEDS_REVERIFICATION" ? "yes" : null, {
      hint: "Later code changes invalidated the earlier proof.",
    }),
    field("Severity", (item as { severity?: string }).severity),
  ];
  const riskTone =
    item.state === "REGRESSED" || (item as { severity?: string }).severity === "critical"
      ? "danger"
      : item.state === "NEEDS_REVERIFICATION" || item.state === "BLOCKED"
        ? "warning"
        : "default";
  groups.push(
    group("risk", "Risk", "What could make this unusable or unsafe to rely on.", riskFields, {
      tone: riskTone,
    }),
  );

  return {
    id,
    kind,
    kindLabel: TYPE_NAME[kind] ?? kind.toUpperCase(),
    stage,
    title: item.title,
    summary: item.summary,
    groups,
  };
}

function legacyKindName(type: string): string {
  switch (type) {
    case "adr":
      return "dec";
    case "commit":
      return "git";
    case "grill":
      return "dec";
    default:
      return "log";
  }
}

/** Group a list of records by lifecycle stage, preserving stage order. */
export function groupByStage<T extends { id: string }>(items: T[]): { stage: Stage; items: T[] }[] {
  const buckets = new Map<RecordClass, T[]>();
  for (const item of items) {
    const stage = stageFor(classifyRecord(item as unknown as MemoryItem));
    const bucket = buckets.get(stage.id);
    if (bucket) bucket.push(item);
    else buckets.set(stage.id, [item]);
  }
  return STAGES.filter((stage) => buckets.has(stage.id)).map((stage) => ({
    stage,
    items: buckets.get(stage.id)!,
  }));
}
