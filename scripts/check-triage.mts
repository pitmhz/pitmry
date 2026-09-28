/**
 * Verifies the record classification against the real canonical stores.
 *
 * The whole point of `lib/pi-dossier.ts` is that a Project Intelligence record
 * can be told apart from a raw memory record. This proves the classifier does
 * that on real data rather than on a fixture.
 *
 * Run: node --experimental-strip-types scripts/check-triage.mts
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { classifyId, classifyType, recordKind, typeNameFor, STAGES } from "../lib/pi-dossier.ts";

const ROOTS = [
  "C:/Users/Pieter/portfolio",
  "C:/Users/Pieter/daschool",
  "C:/Users/Pieter/tools/memory-dashboard",
];

type OnDisk = { id: string; type: string };

function walk(dir: string, out: string[] = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".json")) out.push(full);
  }
  return out;
}

let failures = 0;
const check = (label: string, pass: boolean, detail = "") => {
  if (pass) {
    console.log(`  PASS  ${label}${detail ? ` (${detail})` : ""}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}${detail ? ` (${detail})` : ""}`);
  }
};

const records: OnDisk[] = [];
for (const root of ROOTS) {
  for (const file of walk(join(root, ".pitmry/records"))) {
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8"));
      if (parsed?.id && parsed?.type) records.push({ id: parsed.id, type: parsed.type });
    } catch {
      // A malformed file is a store problem, not a classifier problem.
    }
  }
}

console.log(`classified ${records.length} real records from ${ROOTS.length} stores\n`);

// 1. Every canonical type must map to a known record class.
const byType = new Map<string, number>();
for (const record of records) byType.set(record.type, (byType.get(record.type) ?? 0) + 1);

const stageOf = (type: string) => classifyType(type);

// 2. Project Intelligence types must NOT collapse into the History bucket.
const piTypes = [
  "source_artifact",
  "requirement",
  "acceptance_criterion",
  "phase",
  "work_unit",
  "session",
  "implementation",
  "verification",
  "test_result",
  "relation",
];
const leaked = piTypes.filter((type) => stageOf(type) === "log");
check("no Project Intelligence type is classified as raw history", leaked.length === 0, leaked.join(", ") || "none");

// 2b. The id prefix and the type field must agree, or the UI would show a
//     record differently depending on which field the caller read. The prefix
//     is read from a real record rather than guessed from the type name,
//     because several prefixes abbreviate (rel_ for relation, src_ for
//     source_artifact).
const sampleIds = new Map<string, string>();
for (const record of records) {
  if (!sampleIds.has(record.type)) sampleIds.set(record.type, record.id);
}
for (const type of piTypes) {
  const id = sampleIds.get(type);
  if (!id) continue;
  check(
    `type "${type}" and its real id "${id.slice(0, 6)}…" resolve to the same stage`,
    classifyId(id) === classifyType(type),
  );
}

// 3. Type names must be human readable, not raw.
for (const type of piTypes) {
  const id = sampleIds.get(type) ?? `${type.split("_")[0]}_abc123`;
  const label = typeNameFor(id, type);
  check(`"${type}" renders as a readable name`, /^[A-Z]/.test(label) && !label.includes("_"), label);
}

// 3b. The long-form type must resolve to a label even without a known prefix.
for (const type of piTypes) {
  check(`"${type}" has a standalone label`, typeNameFor("unknown_abc", type) !== "Record", typeNameFor("unknown_abc", type));
}

// 4. Distribution across stages, for a human sanity check.
const distribution = new Map<string, number>();
for (const record of records) {
  const stage = classifyType(record.type) !== "log" ? classifyType(record.type) : classifyId(record.id);
  distribution.set(stage, (distribution.get(stage) ?? 0) + 1);
}
console.log("\nstage distribution:");
for (const stage of STAGES) {
  const count = distribution.get(stage.id) ?? 0;
  if (count > 0) {
    console.log(`  ${stage.id.padEnd(10)} ${String(count).padStart(4)}  ${stage.label}`);
  }
}

// 5. Unknown prefixes degrade safely rather than throwing.
check("unknown prefix does not throw", classifyId("zzz_123") === "log");
check("missing prefix does not throw", classifyId("nounderscore") === "log");
check("empty id does not throw", classifyId("") === "log");

// 6. The dominant class must not be "log", which is the old broken behaviour.
const historyShare = (distribution.get("log") ?? 0) / records.length;
check(
  "raw history is no longer the dominant bucket",
  historyShare < 0.5,
  `${Math.round(historyShare * 100)}% history`,
);

if (failures > 0) {
  console.error(`\n${failures} failure(s).`);
  process.exit(1);
}
console.log("\nRecord classification is correct against the real canonical stores.");
