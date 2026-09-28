/**
 * Contract check for the Project Intelligence console.
 *
 * Renders each real ProjectContext through the same graph and status logic the
 * UI uses, so a schema drift in the Python payload is caught here rather than
 * as an empty panel in the browser.
 *
 * Run: .venv/Scripts/python.exe server/memory_dashboard_api.py --project-intelligence
 *      | node scripts/check-pi-contract.mjs
 */

import { buildPiGraph, claimableWork, activeSessions, blockerBreakdown, groupPiNodes } from "../lib/pi-graph.ts";
import { describeState, explainBlocker, describeReadiness, verificationTone } from "../lib/pi-status.ts";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

const data = JSON.parse(raw);
if (data.status !== "OK") {
  console.error("backend did not return OK:", data.status, data.message);
  process.exit(1);
}

let problems = 0;
const note = (msg) => {
  problems += 1;
  console.error(`  FAIL ${msg}`);
};

for (const project of data.projects) {
  const graph = buildPiGraph(project);
  const groups = groupPiNodes(graph);
  const nodeIds = new Set(graph.nodes.map((n) => n.id));

  // Every edge must point at a node that exists. A dangling edge means the
  // payload referenced a record the projection did not return.
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source)) note(`${project.project_name}: edge source missing ${edge.source}`);
    if (!nodeIds.has(edge.target)) note(`${project.project_name}: edge target missing ${edge.target}`);
  }

  // Duplicate nodes would render twice and make selection ambiguous.
  if (nodeIds.size !== graph.nodes.length) {
    note(`${project.project_name}: duplicate node ids (${nodeIds.size} unique of ${graph.nodes.length})`);
  }

  // Readiness must always be an object with an array, even when unblocked.
  for (const work of project.work_units) {
    if (typeof work.readiness?.ready !== "boolean") {
      note(`${project.project_name}/${work.id}: readiness.ready is not a boolean`);
    }
    if (!Array.isArray(work.readiness?.blocking_reasons)) {
      note(`${project.project_name}/${work.id}: blocking_reasons is not an array`);
    }
    describeReadiness(work.readiness?.ready ?? false, work.state);
    for (const reason of work.readiness?.blocking_reasons ?? []) explainBlocker(reason.code);
  }

  for (const unit of project.work_units) describeState(unit.state);
  for (const requirement of project.requirements) describeState(requirement.state);
  for (const session of project.sessions) describeState(session.state);
  for (const verification of project.verifications) verificationTone(verification.overall);

  // Exercise the derived views so a shape change throws here.
  claimableWork(project);
  activeSessions(project);
  blockerBreakdown(project);

  const summary = groups.map((g) => `${g.kind}:${g.count}`).join(" ");
  console.log(
    `OK ${project.project_name.padEnd(18)} nodes=${String(graph.nodes.length).padStart(3)} edges=${String(graph.edges.length).padStart(3)} lanes=${graph.lanes.length}  ${summary}`,
  );
}

if (problems > 0) {
  console.error(`\n${problems} contract problem(s) found.`);
  process.exit(1);
}
console.log("\nAll Project Intelligence payloads satisfy the console contract.");
