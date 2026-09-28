"use client";

/**
 * Canonical graph loader.
 *
 * The `graph` action is the only route that carries relation edges: the
 * `records` projection strips `source_record_id`, `target_record_id`,
 * `relation` and `provenance`, so a record list can never reconstruct the
 * chain. It returns `provenance: "canonical"` when it is reading real records
 * and a list of warnings when a projection is degraded, so both are surfaced
 * rather than silently dropped.
 */

import * as React from "react";
import type { GraphPayload } from "@/lib/graph-traversal";

type GraphResponse = GraphPayload & {
  fallback?: boolean;
  fallback_reason?: string;
  error?: string;
  message?: string;
};

/**
 * How long a graph read may take before it is treated as failed.
 *
 * Without a deadline a backend that stops responding leaves the chain view on
 * its skeleton forever, because the caller's AbortController only fires on
 * unmount.
 */
const GRAPH_READ_TIMEOUT_MS = 20_000;

export function useCanonicalGraph() {
  const [graph, setGraph] = React.useState<GraphPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const readGraph = React.useCallback(async (signal: AbortSignal) => {
    const response = await fetch("/api/memory?action=graph", { cache: "no-store", signal });
    const data = (await response.json()) as GraphResponse;
    if (!response.ok) {
      throw new Error(data.message ?? "Could not read the canonical graph.");
    }
    // The legacy actions silently substitute sample data. A chain built on
    // sample edges would be a fabricated history, so that case is refused
    // rather than rendered.
    if (data.fallback) {
      throw new Error(
        data.fallback_reason ??
          "The local backend did not answer, so no real edges are available.",
      );
    }
    if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
      throw new Error("The graph response was not in the expected shape.");
    }
    return {
      nodes: data.nodes,
      edges: data.edges,
      provenance: data.provenance,
      warnings: data.warnings,
    } satisfies GraphPayload;
  }, []);

  // The fetch is inlined in the effect so the effect body never calls setState
  // synchronously; every transition below happens after an await.
  React.useEffect(() => {
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), GRAPH_READ_TIMEOUT_MS);
    readGraph(controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) return;
        setGraph(payload);
        setError(null);
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setGraph(null);
        setError(
          cause instanceof Error ? cause.message : "Could not read the canonical graph.",
        );
      })
      .finally(() => {
        clearTimeout(deadline);
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      clearTimeout(deadline);
      controller.abort();
    };
  }, [readGraph]);

  const reload = React.useCallback(async () => {
    setLoading(true);
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), GRAPH_READ_TIMEOUT_MS);
    try {
      const payload = await readGraph(controller.signal);
      setGraph(payload);
      setError(null);
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "Could not read the canonical graph.");
      }
    } finally {
      clearTimeout(deadline);
      setLoading(false);
    }
  }, [readGraph]);

  return { graph, loading, error, reload };
}
