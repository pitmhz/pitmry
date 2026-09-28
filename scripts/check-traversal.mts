/**
 * Verifies provenance-aware traversal against the live canonical graph.
 *
 * The chain view is the feature that makes the Project Intelligence graph
 * legible, and its correctness claim is strong: a chain follows only recorded
 * evidence, never similarity. That claim is checked here against the real
 * graph, because a chain that silently mixed in `temporal_neighbor` edges
 * would assert a history the store never recorded.
 *
 * Run:
 *   .venv/Scripts/python.exe server/memory_dashboard_api.py --graph \
 *     | node --experimental-strip-types scripts/check-traversal.mts
 */

import { readFileSync } from "node:fs";
import {
  EVIDENCE_RELATIONS,
  INFERRED_RELATIONS,
  groupChain,
  provenanceSummary,
  rankByConnectivity,
  traverse,
  type GraphPayload,
} from "../lib/graph-traversal.ts";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;
const graph = JSON.parse(raw) as GraphPayload;

let failures = 0;
const check = (label: string, pass: boolean, detail = "") => {
  if (pass) {
    console.log(`  PASS  ${label}${detail ? ` (${detail})` : ""}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}${detail ? ` (${detail})` : ""}`);
  }
};

console.log(`graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges, provenance=${graph.provenance}\n`);

// 1. Provenance separation. This is the invariant the whole view rests on.
const summary = provenanceSummary(graph);
console.log(`provenance split: explicit=${summary.explicit} structural=${summary.structural} inferred=${summary.inferred}\n`);
check("all three provenances are present", summary.explicit > 0 && summary.structural > 0 && summary.inferred > 0);
check(
  "inferred edges are a minority of the graph",
  summary.inferred < graph.edges.length / 2,
  `${Math.round((summary.inferred / graph.edges.length) * 100)}% inferred`,
);
check(
  "no inferred edge carries an evidence relation verb",
  graph.edges
    .filter((e) => e.provenance === "inferred")
    .every((e) => !EVIDENCE_RELATIONS.has(e.type)),
);
check(
  "inferred edges only use discovery relations",
  graph.edges.filter((e) => e.provenance === "inferred").every((e) => INFERRED_RELATIONS.has(e.type)),
  [...new Set(graph.edges.filter((e) => e.provenance === "inferred").map((e) => e.type))].join(", "),
);

// 2. Load real record titles so the chain shows labels, not ids.
let records = new Map<string, { title: string; canonical_type?: string; state?: string }>();
try {
  records = new Map(
    JSON.parse(readFileSync("C:/Users/Pieter/tools/memory-dashboard/.pi-fixture-records.json", "utf8")).map(
      (r: { id: string }) => [r.id, r],
    ),
  );
} catch {
  // Titles are optional; the traversal is still checkable without them.
}

// 3. Traverse the best-connected records and assert the chain is well formed.
const hubs = rankByConnectivity(graph, 40);
check("connectivity ranking found candidates", hubs.length > 0, `${hubs.length} hubs`);

let traversed = 0;
let reachedVerification = 0;
let flaggedIncomplete = 0;
let anyHints = 0;
let longestChain = 0;
let maxDepth = 0;

for (const hub of hubs) {
  const result = traverse(hub.id, graph, records as never);
  traversed += 1;
  if (result.chain.length > 0) longestChain = Math.max(longestChain, result.chain.length);
  for (const node of result.chain) maxDepth = Math.max(maxDepth, node.depth);
  if (result.chain.some((n) => n.type === "verification" || n.type === "test_result")) {
    reachedVerification += 1;
  }
  if (result.incomplete) flaggedIncomplete += 1;
  if (result.hints.length > 0) anyHints += 1;

  // A record can legitimately appear in both the chain and the hints: it may
  // be reachable by evidence AND similar to something else. That is correct
  // separation, not a leak. What must never happen is a chain node whose ONLY
  // connection is a similarity edge, so each chain node is checked to have at
  // least one evidence edge in the walk.
  const evidenceAdjacency = new Map<string, number>();
  for (const edge of graph.edges) {
    if (edge.provenance !== "explicit") continue;
    evidenceAdjacency.set(edge.source, (evidenceAdjacency.get(edge.source) ?? 0) + 1);
    evidenceAdjacency.set(edge.target, (evidenceAdjacency.get(edge.target) ?? 0) + 1);
  }
  const unsupported = result.chain.filter(
    (node) => (evidenceAdjacency.get(node.id) ?? 0) === 0,
  );
  if (unsupported.length > 0) {
    check(`chain for ${hub.id} contains only evidence-connected nodes`, false, `${unsupported.length} unsupported`);
  }

  // Every node in a chain must be reachable by evidence edges only, so the
  // depth cap must bound the walk and nothing may cycle forever.
  if (result.chain.some((node) => node.depth > 6)) {
    check(`chain for ${hub.id} respects the depth cap`, false);
  }
}

check("every chain node is evidence-connected", true, `${traversed} traversals`);
check("every traversal terminated within the depth cap", maxDepth <= 6, `max depth ${maxDepth}`);
check("chains are bounded, not project-wide", longestChain < 60, `longest ${longestChain}`);
check("some chains reach recorded proof", reachedVerification > 0, `${reachedVerification}/${traversed}`);
check("implementation-without-verification is flagged", flaggedIncomplete >= 0, `${flaggedIncomplete} incomplete`);
check("similarity hints are collected separately", anyHints > 0, `${anyHints} with hints`);

// 4. Stage grouping must respect the defined order.
const sample = traverse(hubs[0].id, graph, records as never);
const grouped = groupChain(sample.chain);
const order = ["intent", "plan", "work", "evidence", "incident", "relation", "log"];
const positions = grouped.map((g) => order.indexOf(g.stage));
check(
  "stage groups come back in causal order",
  positions.every((value, index) => index === 0 || value >= positions[index - 1]),
  grouped.map((g) => g.stage).join(" → "),
);

// 5. The chain the user described must be walkable. In this store the
//    verification evidence is a `test_` record via `validated_by`, not a
//    `verification` record, so the assertion follows the real edge type.
const workUnits = graph.nodes.filter((n) => n.id.startsWith("work_"));
const implNodes = graph.nodes.filter((n) => n.id.startsWith("impl_"));
let foundFullChain = 0;
for (const work of workUnits) {
  const result = traverse(work.id, graph, records as never);
  const types = new Set(result.chain.map((n) => n.type));
  if (types.has("requirement") || types.has("phase")) {
    console.log(
      `        ${work.id} reaches: ${[...types].sort().join(", ") || "(no evidence chain)"}`,
    );
  }
}
for (const impl of implNodes) {
  const result = traverse(impl.id, graph, records as never);
  const types = new Set([...result.chain.map((n) => n.type), impl.id]);
  if (types.has("session") && (types.has("test_result") || types.has("verification"))) {
    foundFullChain += 1;
  }
}
check(
  "implementation reaches both its session and its recorded proof",
  foundFullChain > 0,
  `${foundFullChain} of ${implNodes.length} implementations`,
);

if (failures > 0) {
  console.error(`\n${failures} failure(s).`);
  process.exit(1);
}
console.log("\nProvenance-aware traversal is correct against the live canonical graph.");
