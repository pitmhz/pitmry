/**
 * Provenance-aware graph traversal.
 *
 * ## What this reads
 *
 * `GET /api/memory?action=graph` returns the full canonical edge set: 375
 * nodes and 866 edges across every tracked project, with a `provenance` of
 * `canonical` and no warnings. The `records` projection deliberately strips
 * relation fields, so the graph action is the only route that carries the
 * edges, and this is the layer that makes them navigable.
 *
 * ## The one rule that matters
 *
 * Edges arrive in three provenances and they must never be blended:
 *
 *   explicit   evidence-backed. A recorded `contains` / `implements` /
 *              `validated_by` edge with evidence references. This is history.
 *   structural project membership. A record belongs to a project. True, but it
 *              says nothing about causality.
 *   inferred   discovery. `temporal_neighbor` (same day) and `shared_files`.
 *              A search hint, not a relationship.
 *
 * The backend specification is explicit that similarity does not establish
 * causality or supersession, and that explicit relationships outrank semantic
 * similarity. So the traversal default is to follow explicit edges only, and
 * any inferred edge is shown separately, labelled as a hint, and never used to
 * build a causal chain. A chain that mixed the two would assert a history the
 * store does not actually record.
 *
 * ## What it produces
 *
 * For any record, the full history chain the Project Intelligence PRD asks
 * for (section 34): requirement -> work unit -> session -> implementation ->
 * verification, with incidents hanging off the affected record.
 */

// Relative, not the "@/" alias: this module is executed directly by the
// verification scripts under `node --experimental-strip-types`, which cannot
// resolve a bundler alias. Both imports are also valid application code.
import type { MemoryItem } from "./types.ts";
import { classifyId, typeNameFor, type RecordClass } from "./pi-dossier.ts";

export type EdgeProvenance = "explicit" | "structural" | "inferred";

export type GraphNode = {
  id: string;
  label: string;
  /** Flattened legacy type. Often "other" for Project Intelligence records. */
  type?: string;
  /** The real canonical type, e.g. "implementation", "work_unit". */
  canonical_type?: string;
  project?: string;
  state?: string | null;
  /** `project:prj_x` membership nodes are not records. */
  isProject?: boolean;
};

export type GraphEdge = {
  source: string;
  target: string;
  type: string;
  provenance: EdgeProvenance | string;
  weight?: number;
};

export type GraphPayload = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  provenance?: string;
  warnings?: string[];
};

/** Relations that describe history rather than coincidence. */
export const EVIDENCE_RELATIONS = new Set([
  "contains",
  "derived_from",
  "clarifies",
  "implements",
  "verifies",
  "validates",
  "validated_by",
  "depends_on",
  "blocks",
  "created_during",
  "produced_commit",
  "affects",
  "fixes",
  "regressed_by",
  "supersedes",
  "reverts",
  "invalidates_verification",
  "targets",
  "scoped_to",
]);

/** Relations that are discovery hints and never prove anything. */
export const INFERRED_RELATIONS = new Set([
  "semantically_related",
  "shared_files",
  "temporal_neighbor",
  "possible_origin",
  "possible_followup",
]);

export const PROVENANCE_MEANING: Record<EdgeProvenance, string> = {
  explicit: "Recorded in the canonical store with evidence. This is history.",
  structural: "Project membership. True, but it says nothing about cause.",
  inferred: "A discovery hint from similarity or timing. Not evidence of a relationship.",
};

/** Causal direction: what flows forward through the chain. */
const FORWARD: Record<string, string> = {
  contains: "forward",
  implements: "forward",
  created_during: "forward",
  derived_from: "backward",
  depends_on: "backward",
  validated_by: "forward",
  verifies: "forward",
  affects: "forward",
  fixes: "forward",
  regressed_by: "backward",
  supersedes: "forward",
  invalidates_verification: "forward",
  clarifies: "forward",
};

/* ------------------------------------------------------------------ *
 * Chain model
 * ------------------------------------------------------------------ */

/** The chain stages, in the order the PRD defines them. */
export type ChainStage = RecordClass;

export type ChainNode = {
  id: string;
  label: string;
  type: string;
  typeLabel: string;
  stage: RecordClass;
  state: string | null;
  project?: string;
  /** The evidence-backed edges that led here from the focal record. */
  via: { relation: string; from: string }[];
  depth: number;
};

export type ChainLink = {
  from: string;
  to: string;
  relation: string;
  provenance: EdgeProvenance;
};

export type Traversal = {
  focal: ChainNode;
  /** Reached only by evidence-backed edges. Ordered by stage, then depth. */
  chain: ChainNode[];
  /** Reached only by discovery hints. Never mixed into `chain`. */
  hints: { node: ChainNode; via: { relation: string; via: string } }[];
  /** Records that share the focal record but carry no path at all. */
  unreachable: number;
  /** Every evidence edge touching the focal record, for the raw edge list. */
  focalEdges: ChainLink[];
  /** True when evidence stops before reaching verification. */
  incomplete: boolean;
  /** The furthest stage reached, so a reader can see how far the chain goes. */
  reachedStage: RecordClass | null;
};

const STAGE_ORDER: RecordClass[] = [
  "intent",
  "plan",
  "work",
  "evidence",
  "incident",
  "relation",
  "log",
];

function stageRank(stage: RecordClass): number {
  const index = STAGE_ORDER.indexOf(stage);
  return index === -1 ? STAGE_ORDER.length : index;
}

export function stageOfNode(id: string): RecordClass {
  return classifyId(id);
}

/** Build a lookup from the loaded record page, so labels are real. */
export function indexRecords(items: MemoryItem[]): Map<string, MemoryItem> {
  const map = new Map<string, MemoryItem>();
  for (const item of items) map.set(String(item.id), item);
  return map;
}

function toChainNode(
  id: string,
  records: Map<string, MemoryItem>,
  graphNodes: Map<string, GraphNode>,
): ChainNode {
  const record = records.get(id);
  const node = graphNodes.get(id);
  // `canonical_type` is the real type. The graph's `type` field is the
  // flattened legacy taxonomy, which reports "other" for every Project
  // Intelligence record, so preferring it would erase the whole schema.
  const canonicalType =
    (record as { canonical_type?: string } | undefined)?.canonical_type ??
    node?.canonical_type ??
    null;
  return {
    id,
    label: record?.title ?? node?.label ?? id,
    type: canonicalType ?? id.split("_")[0],
    typeLabel: typeNameFor(id, canonicalType),
    stage: stageOfNode(id),
    state: record?.state ?? node?.state ?? null,
    project: record?.project ?? node?.project,
    via: [],
    depth: 0,
  };
}

/**
 * Traverse the evidence graph outward from a focal record.
 *
 * Only evidence-backed edges are followed. Three exclusions matter:
 *
 * - **Inferred edges are never traversed.** They are collected into `hints`,
 *   so the rendered history cannot claim a causal link the store never
 *   recorded. A record may still appear in both sets: it can be reachable by
 *   evidence *and* similar to something else. That is not a leak, it is the
 *   correct separation, so the two sets are allowed to overlap and the chain
 *   is never pruned for appearing in `hints`.
 * - **Structural edges are not traversed.** They are project membership only
 *   (`project:X -> record`), so walking them turns any record into a hub that
 *   reaches every other record in the project.
 * - **Dependency edges are followed only one step.** A serial
 *   `work_a -> work_b -> work_c` chain is real, but walking all of it turns
 *   one work unit's history into the whole plan, which is the plan view's job,
 *   not the chain view's. The first dependency is shown as context and the
 *   walk stops there.
 */
export function traverse(
  focalId: string,
  graph: GraphPayload,
  records: Map<string, MemoryItem>,
  options: { maxDepth?: number; maxNodes?: number } = {},
): Traversal {
  const maxDepth = options.maxDepth ?? 5;
  const maxNodes = options.maxNodes ?? 40;

  const graphNodes = new Map(graph.nodes.map((node) => [node.id, node]));

  // Adjacency, both directions, split by whether the edge is evidence.
  const forward = new Map<string, GraphEdge[]>();
  const backward = new Map<string, GraphEdge[]>();
  const hintEdges = new Map<string, GraphEdge[]>();

  const push = (map: Map<string, GraphEdge[]>, key: string, edge: GraphEdge) => {
    const bucket = map.get(key);
    if (bucket) bucket.push(edge);
    else map.set(key, [edge]);
  };

  for (const edge of graph.edges) {
    const isHint = edge.provenance === "inferred" || INFERRED_RELATIONS.has(edge.type);
    if (isHint) {
      push(hintEdges, edge.source, edge);
      push(hintEdges, edge.target, edge);
      continue;
    }
    // Project membership: carries no causal information, so it is never
    // walked. It is reported in the edge list instead.
    if (edge.provenance === "structural") continue;
    if (edge.provenance === "explicit" && !EVIDENCE_RELATIONS.has(edge.type)) continue;
    push(forward, edge.source, edge);
    push(backward, edge.target, edge);
  }

  const focal = toChainNode(focalId, records, graphNodes);

  const visited = new Set<string>([focalId]);
  const chain: ChainNode[] = [];
  const focalEdges: ChainLink[] = [];

  interface Frame {
    id: string;
    depth: number;
    via: { relation: string; from: string }[];
  }
  const queue: Frame[] = [{ id: focalId, depth: 0, via: [] }];

  while (queue.length > 0) {
    const frame = queue.shift()!;
    if (frame.depth >= maxDepth) continue;
    // Hard cap, so a densely connected focal record cannot pull the entire
    // corpus into one panel.
    if (chain.length >= maxNodes) break;

    const outgoing = forward.get(frame.id) ?? [];
    const incoming = backward.get(frame.id) ?? [];

    // A dependency is context, not history: it joins the chain as a neighbour
    // but is never expanded, so a serial dependency chain cannot swallow the
    // whole plan.
    for (const edge of outgoing) {
      if (visited.has(edge.target)) continue;
      if (chain.length >= maxNodes) break;
      visited.add(edge.target);
      const node = toChainNode(edge.target, records, graphNodes);
      node.depth = frame.depth + 1;
      node.via = [...frame.via, { relation: edge.type, from: frame.id }];
      chain.push(node);
      if (node.stage !== "relation" && edge.type !== "depends_on") {
        queue.push({ id: edge.target, depth: node.depth, via: node.via });
      }
      if (frame.id === focalId) {
        focalEdges.push({
          from: edge.source,
          to: edge.target,
          relation: edge.type,
          provenance: (edge.provenance as EdgeProvenance) ?? "explicit",
        });
      }
    }

    // Walk backwards too, so a work unit can show the requirement it serves.
    for (const edge of incoming) {
      if (visited.has(edge.source)) continue;
      if (chain.length >= maxNodes) break;
      visited.add(edge.source);
      const node = toChainNode(edge.source, records, graphNodes);
      node.depth = frame.depth + 1;
      node.via = [...frame.via, { relation: edge.type, from: frame.id }];
      chain.push(node);
      if (node.stage !== "relation" && edge.type !== "depends_on") {
        queue.push({ id: edge.source, depth: node.depth, via: node.via });
      }
      if (frame.id === focalId) {
        focalEdges.push({
          from: edge.source,
          to: edge.target,
          relation: edge.type,
          provenance: (edge.provenance as EdgeProvenance) ?? "explicit",
        });
      }
    }
  }

  // Sort so the chain reads in the PRD's order: intent first, evidence last.
  chain.sort(
    (a, b) => stageRank(a.stage) - stageRank(b.stage) || a.depth - b.depth || a.id.localeCompare(b.id),
  );

  // Hints are collected, never traversed. The `via` records how the hint was
  // found, which is a similarity signal rather than a recorded edge, so it is
  // kept as a bare relation name rather than a node id.
  const hints: Traversal["hints"] = [];
  const seenHint = new Set<string>();
  for (const edge of hintEdges.get(focalId) ?? []) {
    for (const other of [edge.source, edge.target]) {
      if (other === focalId || seenHint.has(other)) continue;
      seenHint.add(other);
      hints.push({
        node: toChainNode(other, records, graphNodes),
        via: { relation: edge.type, via: "similarity" },
      });
    }
  }

  const reachedStage = chain.length > 0 ? chain[chain.length - 1].stage : focal.stage;
  // In this store the verification evidence is a `test_` record reached by a
  // `validated_by` edge, not a `verification` record. Both count, because the
  // question the reader cares about is "is there proof?", not what the proof
  // record happens to be called.
  const hasProof = chain.some(
    (node) => node.type === "verification" || node.type === "test_result",
  );
  const hasImplementation = chain.some((node) => node.type === "implementation");

  return {
    focal,
    chain,
    hints,
    unreachable: Math.max(0, graph.nodes.length - chain.length - 1 - hints.length),
    focalEdges,
    // A chain that reaches implementation but no proof is the exact gap the
    // product exists to surface, so it is flagged rather than hidden.
    incomplete: hasImplementation && !hasProof,
    reachedStage,
  };
}

/** Group a traversal into stage buckets for rendering. */
export function groupChain(chain: ChainNode[]): { stage: RecordClass; nodes: ChainNode[] }[] {
  const buckets = new Map<RecordClass, ChainNode[]>();
  for (const node of chain) {
    const bucket = buckets.get(node.stage);
    if (bucket) bucket.push(node);
    else buckets.set(node.stage, [node]);
  }
  return STAGE_ORDER.filter((stage) => buckets.has(stage)).map((stage) => ({
    stage,
    nodes: buckets.get(stage)!,
  }));
}

/** Count edges by provenance, for the header summary. */
export function provenanceSummary(graph: GraphPayload): Record<EdgeProvenance, number> {
  const summary: Record<EdgeProvenance, number> = { explicit: 0, structural: 0, inferred: 0 };
  for (const edge of graph.edges) {
    const key = (edge.provenance as EdgeProvenance) ?? "explicit";
    if (key in summary) summary[key] += 1;
  }
  return summary;
}

/** Records that are the best entry points for a traversal: the ones with the
 * most evidence edges, because they have the richest history. */
export function rankByConnectivity(
  graph: GraphPayload,
  limit = 12,
): { id: string; degree: number; explicit: number }[] {
  const degree = new Map<string, number>();
  const explicit = new Map<string, number>();
  for (const edge of graph.edges) {
    // Inferred and structural edges are excluded: a record that merely shares
    // a file, or merely belongs to the same project, is not well connected.
    if (edge.provenance !== "explicit") continue;
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
    explicit.set(edge.source, (explicit.get(edge.source) ?? 0) + 1);
    explicit.set(edge.target, (explicit.get(edge.target) ?? 0) + 1);
  }
  return [...degree.entries()]
    .map(([id, count]) => ({ id, degree: count, explicit: explicit.get(id) ?? 0 }))
    .filter((entry) => !entry.id.startsWith("project:"))
    .sort((a, b) => b.explicit - a.explicit || b.degree - a.degree || a.id.localeCompare(b.id))
    .slice(0, limit);
}
