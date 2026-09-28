"use client";

/**
 * Dashboard data layer.
 *
 * One place fetches the workspace summary and the record page, with correct
 * abort handling. The previous shell ran two nearly identical fetch effects,
 * one of which (`fetchSummary`) had no AbortController and no cleanup, so it
 * could resolve after unmount and call setState on a dead component.
 *
 * The `fallback` flag matters here. The legacy API actions silently return
 * built-in sample data when the Python backend is unavailable, merging
 * `{fallback: true}` into the response. A dashboard that ignores that flag
 * presents fabricated records as real. This hook surfaces it so the UI can say
 * so.
 */

import * as React from "react";
import type { MemoryItem, MemorySummary } from "@/lib/types";
import type { Filters } from "./use-dashboard-state";

export type RecordsState = {
  items: MemoryItem[];
  total: number;
  cursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string;
  /** True when the response came from the built-in sample set, not the store. */
  isFallback: boolean;
};

const PAGE_SIZE = 60;

export function useWorkspaceSummary() {
  const [summary, setSummary] = React.useState<MemorySummary | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async (signal?: AbortSignal) => {
    try {
      const [summaryResponse, workspaceResponse] = await Promise.all([
        fetch("/api/memory?action=summary", { signal }),
        fetch("/api/memory?action=workspace", { signal }),
      ]);
      if (!summaryResponse.ok || !workspaceResponse.ok) {
        throw new Error("Could not load workspace metadata.");
      }
      const [legacy, workspace] = await Promise.all([
        summaryResponse.json(),
        workspaceResponse.json(),
      ]);
      if (legacy.fallback) throw new Error("The local memory backend is unavailable.");
      setSummary({
        ...legacy,
        ...workspace,
        stats: { ...legacy.stats, ...workspace.stats },
      });
      setError(null);
    } catch (cause) {
      if (signal?.aborted) return;
      setSummary(null);
      setError(
        cause instanceof Error ? cause.message : "Could not load workspace metadata.",
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    // The fetch is inlined rather than routed through `load` so the effect body
    // contains no synchronous setState at all. Every transition below happens
    // after an await.
    Promise.all([
      fetch("/api/memory?action=summary", { signal: controller.signal }),
      fetch("/api/memory?action=workspace", { signal: controller.signal }),
    ])
      .then(async ([summaryResponse, workspaceResponse]) => {
        if (!summaryResponse.ok || !workspaceResponse.ok) {
          throw new Error("Could not load workspace metadata.");
        }
        const [legacy, workspace] = await Promise.all([
          summaryResponse.json(),
          workspaceResponse.json(),
        ]);
        if (legacy.fallback) throw new Error("The local memory backend is unavailable.");
        setSummary({
          ...legacy,
          ...workspace,
          stats: { ...legacy.stats, ...workspace.stats },
        });
        setError(null);
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setSummary(null);
        setError(
          cause instanceof Error ? cause.message : "Could not load workspace metadata.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  return { summary, error, loading, reload: load };
}

/** Build the records query. Only the facets the server understands are sent;
 * the query text and date range stay client-side. */
function recordsUrl(filters: Filters, cursor?: string | null) {
  const params = new URLSearchParams({ action: "records", limit: String(PAGE_SIZE) });
  if (filters.project) params.set("project", filters.project);
  if (filters.type) params.set("type", filters.type);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (cursor) params.set("cursor", cursor);
  return `/api/memory?${params.toString()}`;
}

export function useRecords(filters: Filters) {
  const [state, setState] = React.useState<RecordsState>({
    items: [],
    total: 0,
    cursor: null,
    loading: true,
    loadingMore: false,
    error: "",
    isFallback: false,
  });

  const abortRef = React.useRef<AbortController | null>(null);

  // Only these facets reach the server. Pulling them out first keeps the
  // callback dependencies explicit: a change to the search text or the density
  // must NOT refetch, because those filter the already-loaded page.
  const { project, type, tag, from, to } = filters;

  const load = React.useCallback(
    async (signal?: AbortSignal) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const params: Filters = { project, type, tag, from, to, query: "", density: "grid" };
      try {
        const response = await fetch(recordsUrl(params), { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Could not load records.");
        if (controller.signal.aborted) return;
        // Every state transition happens after the await, so entering the
        // effect never calls setState synchronously. The loading flag is
        // already true from the initial state and is reset here on failure
        // and success alike.
        setState({
          items: (data.items ?? []) as MemoryItem[],
          total: data.total ?? 0,
          cursor: data.next_cursor ?? null,
          loading: false,
          loadingMore: false,
          error: "",
          isFallback: Boolean(data.fallback),
        });
      } catch (cause) {
        if (controller.signal.aborted) return;
        setState({
          items: [],
          total: 0,
          cursor: null,
          loading: false,
          loadingMore: false,
          error:
            cause instanceof Error ? cause.message : "Could not load records.",
          isFallback: false,
        });
      }
    },
    [project, type, tag, from, to],
  );

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      // Set the loading flag on the next tick so a filter change shows the
      // loading state without the effect body calling setState synchronously.
      setState((previous) => ({ ...previous, loading: true, error: "" }));
      void load();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [load]);

  const loadMore = React.useCallback(async () => {
    if (!state.cursor || state.loadingMore) return;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    const params: Filters = { project, type, tag, from, to, query: "", density: "grid" };
    // Deferred so the disabled/loading state applies before the await without
    // a synchronous setState in the caller.
    setState((previous) => ({ ...previous, loadingMore: true, error: "" }));
    try {
      const response = await fetch(recordsUrl(params, state.cursor), {
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not load more records.");
      if (controller.signal.aborted) return;
      setState((previous) => ({
        ...previous,
        items: [...previous.items, ...((data.items ?? []) as MemoryItem[])],
        cursor: data.next_cursor ?? null,
        loadingMore: false,
      }));
    } catch (cause) {
      if (controller.signal.aborted) return;
      setState((previous) => ({
        ...previous,
        loadingMore: false,
        error:
          cause instanceof Error ? cause.message : "Could not load more records.",
      }));
    }
  }, [project, type, tag, from, to, state.cursor, state.loadingMore]);

  return { ...state, reload: load, loadMore };
}

/** Client-side refinement over the fetched page. The corpus is already
 * narrowed by the server; this only trims what is on screen. */
export function useFilteredRecords(items: MemoryItem[], filters: Filters) {
  const query = filters.query.trim().toLowerCase();
  const from = filters.from ? new Date(filters.from).getTime() : null;
  const to = filters.to ? new Date(filters.to).getTime() + 86_399_999 : null;

  return React.useMemo(() => {
    if (!query && from === null && to === null) return items;
    return items.filter((item) => {
      if (query) {
        const matches =
          item.title?.toLowerCase().includes(query) ||
          item.summary?.toLowerCase().includes(query) ||
          item.rationale?.toLowerCase().includes(query) ||
          item.tags?.some((tag: string) => tag.toLowerCase().includes(query)) ||
          item.commit_hash?.toLowerCase().includes(query);
        if (!matches) return false;
      }
      if (from !== null || to !== null) {
        if (item.timestamp) {
          const time = new Date(item.timestamp).getTime();
          if (from !== null && time < from) return false;
          if (to !== null && time > to) return false;
        }
      }
      return true;
    });
  }, [items, query, from, to]);
}
