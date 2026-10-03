/**
 * Pin the grouped stream's contract.
 *
 * A grouping view is only acceptable if it is lossless. Its whole purpose is to
 * make a stream scannable, and the failure mode that matters is not "looks
 * wrong" but "quietly stops showing records". Every check here is therefore
 * about conservation: what the flat stream showed, the grouped stream must
 * still show, reachable in one click or one disclosure.
 *
 * Run:
 *   node --experimental-strip-types scripts/check-record-grouping.mts
 */

import { groupStream, groupSummary, isTransition, partition, subjectOf } from "../lib/record-grouping.ts";
import type { MemoryItem } from "../lib/types.ts";

let failures = 0;

function check(label: string, condition: boolean, detail = ""): void {
  if (condition) {
    console.log(`  PASS  ${label}${detail ? ` (${detail})` : ""}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? ` (${detail})` : ""}`);
  }
}

function record(id: string, timestamp: string, extra: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id,
    type: "other",
    project: "p",
    title: id,
    timestamp,
    tags: [],
    ...extra,
  } as MemoryItem;
}

function transition(
  id: string,
  subject: string | null,
  from: string,
  to: string,
  timestamp: string,
): MemoryItem {
  return {
    id,
    type: "other",
    project: "p",
    title: `${from} to ${to}`,
    timestamp,
    tags: [],
    transition: {
      subject_id: subject,
      from_state: from,
      to_state: to,
      actor: "agent",
      reason: "",
      previous_event_id: null,
    },
  } as MemoryItem;
}

console.log("record grouping");

// --- a subject's transitions collapse into one trail -------------------------
const items: MemoryItem[] = [
  record("work_1", "2026-10-01T10:00:00Z", { title: "Wire the conductor" }),
  transition("obs_a", "work_1", "PLANNED", "IN_PROGRESS", "2026-10-01T09:00:00Z"),
  transition("obs_b", "work_1", "IN_PROGRESS", "IMPLEMENTED", "2026-10-01T11:00:00Z"),
  record("req_1", "2026-10-01T08:00:00Z", { title: "Rail geometry" }),
];

const { records, trails, unattached } = partition(items);
check("a subject's transitions leave the top level",
  records.length === 2, `${records.length} records remain`);
check("transitions are keyed by their subject",
  trails.get("work_1")?.length === 2, `${trails.get("work_1")?.length ?? 0} attached`);
check("nothing is left unattached when every subject is present",
  unattached.length === 0);

// The trail must read forwards in time even though the stream sorts descending.
const grouped = groupStream(items);
const workGroup = grouped.find((group) => group.subject?.id === "work_1");
check("the trail reads oldest to newest",
  JSON.stringify(workGroup?.trail) === JSON.stringify(["PLANNED", "IN_PROGRESS", "IMPLEMENTED"]),
  JSON.stringify(workGroup?.trail));

// --- conservation ------------------------------------------------------------
// This is the check that matters most. If it ever fails, the view is lying.
// Count distinct ids rather than groups + events. The orphan group is both a
// group and a container for its events, so groups + events counts its single
// member twice and would report phantom records.
const flat = items.length;
const groupedIds0 = new Set<string>();
for (const group of grouped) {
  if (group.subject) groupedIds0.add(group.subject.id);
  for (const event of group.events) groupedIds0.add(event.id);
}
check("grouping neither drops nor invents records",
  flat === groupedIds0.size, `${flat} in, ${groupedIds0.size} shown`);

// Every id in the flat page is still reachable in the grouped page.
const flatIds = new Set(items.map((item) => item.id));
const groupedIds = new Set<string>();
for (const group of grouped) {
  if (group.subject) groupedIds.add(group.subject.id);
  for (const event of group.events) groupedIds.add(event.id);
}
const missing = [...flatIds].filter((id) => !groupedIds.has(id));
check("every record in the page is still reachable", missing.length === 0, missing.join(",") || "all present");

// --- ordering ----------------------------------------------------------------
check("groups are ordered newest first",
  grouped[0].timestamp >= grouped[grouped.length - 1].timestamp,
  grouped.map((group) => group.timestamp.slice(0, 10)).join(" > "));

// --- the orphan case ---------------------------------------------------------
// A filtered-out or off-page subject must not make its transitions disappear.
const orphanPage: MemoryItem[] = [
  record("work_2", "2026-10-01T10:00:00Z", { title: "A different work unit" }),
  transition("obs_c", "work_missing", "PLANNED", "IN_PROGRESS", "2026-10-01T09:00:00Z"),
];
const orphanGroups = groupStream(orphanPage);
const orphans = orphanGroups.find((group) => group.kind === "unattached");
check("a transition whose subject is off-page is not dropped",
  orphans?.events.length === 1, `${orphans?.events.length ?? 0} kept`);
check("orphans are labelled as such rather than shown as records",
  orphans?.kind === "unattached" && orphans.subject === null);

// The original version of this file passed the conservation check above while
// still losing every off-page transition, because that page happened to contain
// its subject. Conservation is re-asserted here on the page that used to break.
const orphanFlat = orphanPage.length;
const orphanShown = new Set<string>();
for (const group of orphanGroups) {
  if (group.subject) orphanShown.add(group.subject.id);
  for (const event of group.events) orphanShown.add(event.id);
}
check("conservation holds on the page that used to lose records",
  orphanFlat === orphanShown.size, `${orphanFlat} in, ${orphanShown.size} shown`);

// A transition naming no subject at all must survive too.
const nameless = groupStream([
  transition("obs_d", null, "PROPOSED", "ACCEPTED", "2026-10-01T09:00:00Z"),
]);
check("a transition naming no subject still appears",
  nameless[0]?.kind === "unattached" && nameless[0].events.length === 1);

// --- the summary line must not flatter ---------------------------------------
const summary = groupSummary(grouped);
check("the summary reports what grouping saved",
  summary.groups === 2 && summary.transitions === 2 && summary.flat === 4,
  `${summary.groups} groups, ${summary.transitions} transitions, ${summary.flat} flat`);
check("grouping is reported as a reduction, never as a record count",
  summary.groups < summary.flat, `${summary.groups} < ${summary.flat}`);

// --- a page with no transitions must be untouched ----------------------------
const plain = groupStream([record("dec_1", "2026-10-01T10:00:00Z"), record("dec_2", "2026-10-01T09:00:00Z")]);
check("a page with no transitions is passed through one to one",
  plain.length === 2 && plain.every((group) => group.trail.length === 0));

// --- helpers -----------------------------------------------------------------
check("isTransition is false for a plain record", !isTransition(plain[0].subject!));
check("subjectOf reads the declared subject", subjectOf(transition("obs_e", "work_9", "A", "B", "t")) === "work_9");
check("subjectOf is null when no subject is declared",
  subjectOf(transition("obs_f", null, "A", "B", "t")) === null);

console.log();
if (failures > 0) {
  console.log(`${failures} check(s) FAILED`);
  process.exit(1);
}
console.log("Grouping is lossless: every record in the flat stream is reachable in the grouped one.");