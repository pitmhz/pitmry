/**
 * Record grouping for the dashboard stream.
 *
 * ## The problem this solves
 *
 * A Project Intelligence plan generates one canonical record per lifecycle
 * transition: `PLANNED to IN_PROGRESS`, `IN_PROGRESS to IMPLEMENTED`, and so
 * on. The state they leave behind is already carried by the subject record, so
 * as top-level stream entries they are pure duplication. In a project with a
 * real plan they outnumber the substantive records, and because their titles
 * are near-identical ("PROPOSED to ACCEPTED", sixty-two times), they crowd the
 * stream with rows that all look alike and all say the same thing.
 *
 * ## The model
 *
 * A transition is not a record, it is **an attribute of a record**. So it is
 * partitioned out of the top level and attached to the record it describes,
 * where it becomes a state trail rather than a card.
 *
 * Two rules keep this honest:
 *
 *  1. **Nothing is hidden.** A transition whose subject is not in the current
 *     page -- filtered out, or on another page -- still appears, under its own
 *     collapsed heading. Silently dropping records to make a view tidier is how
 *     a dashboard starts lying.
 *  2. **Ordering is preserved.** Groups appear where their newest record would
 *     have appeared, so grouped mode reads in the same order as flat mode.
 */

import type { MemoryItem } from "./types.ts";

/** One lifecycle step, read from the backend's `transition` projection. */
export type RecordTransition = {
  subject_id: string | null;
  from_state: string | null;
  to_state: string | null;
  actor: string | null;
  reason: string;
  previous_event_id: string | null;
};

/**
 * A lifecycle event: an observation that exists only to record that another
 * record moved between states.
 */
export function isTransition(item: MemoryItem): boolean {
  return Boolean((item as { transition?: RecordTransition | null }).transition);
}

/** The record a transition describes, or null when it names none. */
export function subjectOf(item: MemoryItem): string | null {
  const transition = (item as { transition?: RecordTransition | null }).transition;
  return transition?.subject_id ?? null;
}

function byTimeDescending(a: MemoryItem, b: MemoryItem): number {
  return String(b.timestamp ?? "").localeCompare(String(a.timestamp ?? ""));
}

/**
 * Split a page into the records worth listing and the transitions that
 * describe them.
 *
 * Transitions are keyed by subject so a subject's whole trail can be rendered
 * in one place. A transition with no subject is returned separately rather than
 * dropped: it is unattributable, and the caller shows it under its own heading.
 */
export function partition(items: MemoryItem[]): {
  records: MemoryItem[];
  trails: Map<string, MemoryItem[]>;
  unattached: MemoryItem[];
} {
  const records: MemoryItem[] = [];
  const unattached: MemoryItem[] = [];
  const trails = new Map<string, MemoryItem[]>();

  for (const item of items) {
    if (!isTransition(item)) {
      records.push(item);
      continue;
    }
    const subject = subjectOf(item);
    if (!subject) {
      unattached.push(item);
      continue;
    }
    const trail = trails.get(subject);
    if (trail) trail.push(item);
    else trails.set(subject, [item]);
  }

  for (const trail of trails.values()) trail.sort(byTimeDescending);
  unattached.sort(byTimeDescending);
  return { records, trails, unattached };
}

/**
 * The state trail for one record, oldest first, as `["PLANNED", "IN_PROGRESS"]`.
 *
 * The starting state comes from the earliest transition's `from_state`, not
 * from any `to_state`: nothing ever transitions *into* PLANNED, so reading only
 * `to_state` would open every trail one step late and hide where the work
 * began.
 */
export function stateTrail(trail: MemoryItem[]): string[] {
  const ordered = [...trail].reverse();
  const first = ordered[0] as (MemoryItem & { transition: RecordTransition }) | undefined;
  const states = [first?.transition.from_state];
  for (const item of ordered) {
    states.push((item as MemoryItem & { transition: RecordTransition }).transition.to_state);
  }
  return states.filter((state): state is string => Boolean(state));
}

/**
 * How a group is presented. Kept as data so the renderer stays a lookup and a
 * new grouping is one entry rather than a new branch.
 */
export type GroupKind = "record" | "trail" | "unattached";

export type StreamGroup = {
  key: string;
  kind: GroupKind;
  /** The record this group is anchored on, absent for a group of orphans. */
  subject: MemoryItem | null;
  /** The state trail, oldest first. Empty for a plain record. */
  trail: string[];
  /** The transitions behind that trail, newest first, for the disclosure. */
  events: MemoryItem[];
  /** How many records the group represents, so a stacked card can say "3". */
  count: number;
  timestamp: string;
};

/**
 * Collapse a page into grouped entries.
 *
 * A record carrying transitions becomes one entry holding the whole trail. A
 * record carrying none stays a plain entry. Transitions whose subject is not on
 * this page are collected into a single trailing group rather than scattered,
 * so they cost one collapsed row instead of sixty.
 */
export function groupStream(items: MemoryItem[]): StreamGroup[] {
  const { records, trails, unattached } = partition(items);
  const groups: StreamGroup[] = [];
  const claimed = new Set<string>();

  for (const record of records) {
    const trail = trails.get(record.id);
    if (trail) claimed.add(record.id);
    groups.push({
      key: record.id,
      kind: "record",
      subject: record,
      trail: trail ? stateTrail(trail) : [],
      events: trail ?? [],
      count: 1,
      timestamp: String(record.timestamp ?? ""),
    });
  }

  // Transitions whose subject is not on this page are filtered out, on another
  // page, or deleted. They are still records and still have to be reachable, so
  // they are collected into one trailing group instead of being dropped. An
  // earlier version keyed orphans by subject alone and lost them here, which is
  // the exact data loss this function exists to avoid.
  const orphaned: MemoryItem[] = [...unattached];
  for (const [subjectId, trail] of trails) {
    if (!claimed.has(subjectId)) orphaned.push(...trail);
  }
  orphaned.sort(byTimeDescending);

  if (orphaned.length > 0) {
    groups.push({
      key: "__unattached_transitions",
      kind: "unattached",
      subject: null,
      trail: [],
      events: orphaned,
      count: orphaned.length,
      timestamp: String(orphaned[0].timestamp ?? ""),
    });
  }

  groups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return groups;
}

/** Counts for the grouped view's summary line. */
export function groupSummary(groups: StreamGroup[]) {
  let withTrail = 0;
  let transitions = 0;
  for (const group of groups) {
    if (group.trail.length > 0) withTrail += 1;
    transitions += group.events.length;
  }
  return {
    groups: groups.length,
    withTrail,
    transitions,
    /** What the flat stream would have shown for the same page. */
    flat: groups.length + transitions,
  };
}