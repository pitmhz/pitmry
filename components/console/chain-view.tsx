"use client";

/**
 * Provenance chain view.
 *
 * The traversal the Project Intelligence PRD describes in section 34: a future
 * agent should be able to retrieve the original requirement, the accepted
 * decision, the implementation, the verification, the known bug, the fix, and
 * the current status as one history.
 *
 * The chain is drawn as an ordered spine rather than a hairball graph,
 * because a chain is a sequence. Each row names the record, the evidence edge
 * that led to it, and the lifecycle state it currently holds. Discovery hints
 * sit in a separate block below the chain, never interleaved into it, because
 * a shared file or a same-day timestamp is not a relationship.
 */

import * as React from "react";
import {
  AlertTriangle,
  ArrowRight,
  CircleDot,
  Link2,
  Loader2,
  Radar,
  Search,
} from "lucide-react";
import type { MemoryItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  PROVENANCE_MEANING,
  groupChain,
  rankByConnectivity,
  stageOfNode,
  traverse,
  type ChainNode,
  type EdgeProvenance,
  type GraphPayload,
  type Traversal,
} from "@/lib/graph-traversal";
import { STAGES, stageFor, type RecordClass } from "@/lib/pi-dossier";
import { describeState } from "@/lib/pi-status";
import { EmptyState } from "./primitives";

/* ------------------------------------------------------------- loading */

function ChainSkeleton() {
  return (
    <div role="status" aria-label="Loading record graph" className="space-y-3">
      <div className="h-4 w-48 animate-pulse rounded bg-muted" />
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="flex items-center gap-3">
          <span className="size-2 shrink-0 animate-pulse rounded-full bg-muted" />
          <span className="h-3 flex-1 animate-pulse rounded bg-muted" />
        </div>
      ))}
      <span className="sr-only">Loading record graph</span>
    </div>
  );
}

/* -------------------------------------------------------------- rows */

const STAGE_TONE: Record<RecordClass, string> = {
  intent: "text-primary",
  plan: "text-info",
  work: "text-foreground",
  evidence: "text-success",
  incident: "text-danger",
  relation: "text-muted-foreground",
  log: "text-muted-foreground",
};

function ChainRow({
  node,
  isFocal,
  onSelect,
  selectedId,
}: {
  node: ChainNode;
  isFocal: boolean;
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  const state = describeState(node.state);
  const relation = node.via.at(-1)?.relation;

  return (
    <li className="relative">
      <div className="flex items-start gap-3">
        {/* The spine. Drawn as a connector so the sequence reads as a chain. */}
        <span aria-hidden="true" className="flex flex-col items-center self-stretch">
          <CircleDot
            className={cn(
              "mt-1 size-3 shrink-0",
              isFocal ? "text-primary" : STAGE_TONE[node.stage],
            )}
          />
          <span
            className={cn(
              "mt-1 w-px flex-1",
              isFocal ? "bg-primary/50" : "bg-border",
            )}
          />
        </span>

        <div className="min-w-0 flex-1 pb-4">
          {relation ? (
            <p className="mb-1 flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
              <Link2 aria-hidden="true" className="size-2.5 shrink-0" />
              <span className="font-mono">{relation}</span>
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => onSelect(node.id)}
            aria-pressed={selectedId === node.id}
            className={cn(
              "w-full rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isFocal
                ? "border-primary/50 bg-primary/8"
                : "border-border/70 bg-card hover:border-primary/40",
              selectedId === node.id && "border-primary shadow-[0_0_0_1px_var(--primary)]",
            )}
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                {node.typeLabel}
              </span>
              {isFocal ? (
                <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[0.6875rem] text-primary">
                  Selected
                </span>
              ) : null}
              {node.state ? (
                <span className="text-[0.6875rem] text-muted-foreground">{state.label}</span>
              ) : null}
            </span>
            <span className="mt-1 block truncate text-sm font-medium text-foreground">
              {node.label}
            </span>
            <span className="mt-0.5 block truncate font-mono text-[0.6875rem] text-muted-foreground">
              {node.id}
            </span>
          </button>
        </div>
      </div>
    </li>
  );
}

/* ------------------------------------------------------------- summary */

function ProvenanceBar({ graph }: { graph: GraphPayload }) {
  const counts: Record<EdgeProvenance, number> = { explicit: 0, structural: 0, inferred: 0 };
  for (const edge of graph.edges) {
    const key = (edge.provenance as EdgeProvenance) ?? "explicit";
    if (key in counts) counts[key] += 1;
  }
  const total = graph.edges.length || 1;

  return (
    <div className="space-y-2">
      <div
        aria-hidden="true"
        className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        {(["explicit", "structural", "inferred"] as const).map((key) => (
          <span
            key={key}
            className={cn(
              "block h-full",
              key === "explicit" && "bg-primary",
              key === "structural" && "bg-muted-foreground/50",
              key === "inferred" && "bg-muted-foreground/25",
            )}
            style={{ width: `${(counts[key] / total) * 100}%` }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {(["explicit", "structural", "inferred"] as const).map((key) => (
          <li key={key} className="flex items-baseline gap-1.5" title={PROVENANCE_MEANING[key]}>
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 self-center rounded-full",
                key === "explicit" && "bg-primary",
                key === "structural" && "bg-muted-foreground/50",
                key === "inferred" && "bg-muted-foreground/25",
              )}
            />
            <span className="text-[0.6875rem] font-medium text-foreground">{counts[key]}</span>
            <span className="text-[0.6875rem] capitalize text-muted-foreground">{key}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------- view */

export function ChainView({
  graph,
  items,
  focalId,
  onSelect,
  selectedId,
  loading,
  error,
}: {
  graph: GraphPayload | null;
  items: MemoryItem[];
  focalId: string | null;
  onSelect: (id: string) => void;
  selectedId: string | null;
  loading: boolean;
  error: string | null;
}) {
  const [query, setQuery] = React.useState("");

  const records = React.useMemo(() => {
    const map = new Map<string, MemoryItem>();
    for (const item of items) map.set(String(item.id), item);
    return map;
  }, [items]);

  const traversal: Traversal | null = React.useMemo(() => {
    if (!graph || !focalId) return null;
    return traverse(focalId, graph, records);
  }, [graph, focalId, records]);

  const hubs = React.useMemo(() => (graph ? rankByConnectivity(graph, 10) : []), [graph]);

  const matches = React.useMemo(() => {
    if (!query.trim() || !graph) return [];
    const needle = query.trim().toLowerCase();
    return graph.nodes
      .filter((node) => {
        if (node.id.startsWith("project:")) return false;
        const label = (node.label ?? "").toLowerCase();
        return label.includes(needle) || node.id.toLowerCase().includes(needle);
      })
      .slice(0, 8);
  }, [query, graph]);

  if (loading) {
    return (
      <div className="p-5">
        <ChainSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5">
        <EmptyState title="The record graph is unavailable">
          {error} The chain view reads recorded edges from the local store, so it does not fall
          back to a sample graph.
        </EmptyState>
      </div>
    );
  }

  if (!graph) return null;

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <header className="rounded-lg border border-border/70 bg-card px-5 py-4">
        <h2 className="font-heading text-base font-semibold text-foreground">Provenance chain</h2>
        <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">
          Follow a record through recorded edges: requirement, work, session, implementation,
          verification, incident. Only evidence-backed edges build the chain. Similarity and
          same-day neighbours are shown separately, because a hint is not a relationship.
        </p>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-mono text-[0.6875rem] text-muted-foreground">
            {graph.nodes.length} nodes · {graph.edges.length} edges
            {graph.provenance ? ` · ${graph.provenance}` : ""}
          </p>
        </div>
        <div className="mt-3">
          <ProvenanceBar graph={graph} />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        {/* Entry point picker. */}
        <div className="space-y-3">
          <div className="rounded-lg border border-border/70 bg-card p-4">
            <label htmlFor="chain-search" className="text-xs font-medium text-foreground">
              Find a record
            </label>
            <div className="mt-1.5 flex items-center gap-2 rounded border border-border bg-background px-2">
              <Search aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                id="chain-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by title or id"
                className="h-8 min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            {matches.length > 0 ? (
              <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto">
                {matches.map((node) => (
                  <li key={node.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(node.id)}
                      aria-pressed={focalId === node.id}
                      className={cn(
                        "block w-full truncate rounded px-2 py-1.5 text-left text-xs transition-colors",
                        focalId === node.id
                          ? "bg-primary/12 text-primary"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      )}
                      title={node.label}
                    >
                      {node.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="rounded-lg border border-border/70 bg-card p-4">
            <h3 className="text-xs font-medium text-foreground">Most connected</h3>
            <p className="mt-1 text-[0.6875rem] leading-relaxed text-muted-foreground">
              Records with the most evidence edges. Their histories are the richest.
            </p>
            <ul className="mt-2 space-y-0.5">
              {hubs.map((hub) => (
                <li key={hub.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(hub.id)}
                    aria-pressed={focalId === hub.id}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors",
                      focalId === hub.id
                        ? "bg-primary/12 text-primary"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                    title={hub.id}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {records.get(hub.id)?.title ?? hub.id}
                    </span>
                    <span className="shrink-0 font-mono text-[0.6875rem]">{hub.explicit}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* The chain itself. */}
        <div className="min-w-0">
          {!focalId ? (
            <EmptyState title="Choose a record to follow">
              Pick a connected record on the left, or search for one. The chain shows only what
              the store actually records.
            </EmptyState>
          ) : !traversal || traversal.chain.length === 0 ? (
            <EmptyState title="No recorded history for this record">
              This record has no evidence-backed edges yet. A requirement with no work unit, or a
              commit with no implementation record, has no chain to walk.
            </EmptyState>
          ) : (
            <div className="space-y-4">
              {traversal.incomplete ? (
                <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/8 px-4 py-3 text-xs leading-relaxed text-warning">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    The chain reaches an implementation but no verification. Code exists and
                    nothing has confirmed it meets its acceptance criteria.
                  </span>
                </p>
              ) : null}

              <section className="rounded-lg border border-border/70 bg-card p-5">
                <h3 className="font-heading text-sm font-semibold text-foreground">
                  Chain for {traversal.focal.typeLabel}
                </h3>
                <ol className="mt-3">
                  <ChainRow
                    node={traversal.focal}
                    isFocal
                    onSelect={onSelect}
                    selectedId={selectedId}
                  />
                  {groupChain(traversal.chain).map(({ stage, nodes }) => (
                    <React.Fragment key={stage}>
                      <li className="pb-2 pl-6">
                        <h4
                          className={cn(
                            "text-[0.6875rem] font-semibold uppercase tracking-[0.06em]",
                            STAGE_TONE[stage],
                          )}
                        >
                          {stageFor(stage).label}
                        </h4>
                        <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-muted-foreground">
                          {stageFor(stage).description}
                        </p>
                      </li>
                      {nodes.map((node) => (
                        <ChainRow
                          key={node.id}
                          node={node}
                          isFocal={false}
                          onSelect={onSelect}
                          selectedId={selectedId}
                        />
                      ))}
                    </React.Fragment>
                  ))}
                </ol>
              </section>

              {traversal.hints.length > 0 ? (
                <section className="rounded-lg border border-dashed border-border bg-muted/20 p-5">
                  <h3 className="flex items-center gap-2 font-heading text-sm font-semibold text-foreground">
                    <Radar aria-hidden="true" className="size-4 text-muted-foreground" />
                    Related by similarity ({traversal.hints.length})
                  </h3>
                  <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">
                    These share files or fall on the same day. That is a search hint, not a
                    relationship, so they are kept out of the chain above.
                  </p>
                  <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                    {traversal.hints.map(({ node, via }) => (
                      <li key={node.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(node.id)}
                          aria-pressed={selectedId === node.id}
                          className="w-full rounded border border-border/70 bg-card px-3 py-2 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="block truncate text-xs font-medium text-foreground">
                            {node.label}
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-[0.6875rem] text-muted-foreground">
                            {via.relation} · {node.id}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {traversal.focalEdges.length > 0 ? (
                <section className="rounded-lg border border-border/70 bg-card p-5">
                  <h3 className="font-heading text-sm font-semibold text-foreground">
                    Recorded edges
                  </h3>
                  <ul className="mt-2 divide-y divide-border/50">
                    {traversal.focalEdges.map((edge) => (
                      <li
                        key={`${edge.from}-${edge.to}-${edge.relation}`}
                        className="flex flex-wrap items-center gap-2 py-2 text-xs"
                      >
                        <span className="font-mono text-muted-foreground">{edge.from}</span>
                        <ArrowRight aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
                        <span className="font-mono text-primary">{edge.relation}</span>
                        <ArrowRight aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
                        <span className="font-mono text-muted-foreground">{edge.to}</span>
                        <span className="ml-auto rounded-full border border-border px-2 py-0.5 text-[0.6875rem] capitalize text-muted-foreground">
                          {edge.provenance}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { STAGES, stageOfNode, Loader2 };
