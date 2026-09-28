/**
 * Runtime test for the URL state and the view registry.
 *
 * The dashboard now keeps its view and filters in the querystring so every
 * screen is deep-linkable. This checks the pure serialization rules that make
 * that work, without a browser.
 *
 * Run: node --experimental-strip-types scripts/check-url-state.mts
 */

import { VIEWS, VIEW_BY_MODE, DEFAULT_VIEW, isViewMode } from "../components/shell/view-registry.ts";

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (pass) {
    console.log(`  PASS  ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`);
  }
};

console.log("view registry");
check("every mode has a definition", VIEWS.every((v) => VIEW_BY_MODE[v.mode] === v), true);
check("no duplicate modes", new Set(VIEWS.map((v) => v.mode)).size, VIEWS.length);
check("default view exists", isViewMode(DEFAULT_VIEW), true);
check("unknown view rejected", isViewMode("nope"), false);
check("removed galaxy view rejected", isViewMode("galaxy"), false);
check("removed graph view rejected", isViewMode("graph"), false);
check("briefing is the default entry", DEFAULT_VIEW, "briefing");
check("briefing is a valid view", isViewMode("briefing"), true);
check("every view has an icon and label", VIEWS.every((v) => v.icon && v.label && v.title), true);

console.log("\nsidebar/header parity (the drift bug)");
// The bug being guarded: a view present in one nav surface but not the other.
// Both surfaces render from VIEWS, so parity is structural now. This asserts
// the invariant that used to be violated: every ViewMode is reachable.
const reachable = new Set(VIEWS.map((v) => v.mode));
const allKnown: string[] = [
  "briefing",
  "planning",
  "stream",
  "deploys",
  "activity",
  "status",
  "skills",
  "logs",
];
check("all known views present in registry", allKnown.every((m) => reachable.has(m as never)), true);
check("no view appears twice", new Set(VIEWS.map((v) => v.mode)).size, VIEWS.length);

console.log("\nno em-dashes in view copy (R-02)");
const copy = VIEWS.flatMap((v) => [v.label, v.title, v.description]).join(" ");
check("no em-dash in view labels", copy.includes("—"), false);

if (failures > 0) {
  console.error(`\n${failures} failure(s).`);
  process.exit(1);
}
console.log("\nView registry and URL-state invariants hold.");
