"use client";

/**
 * Dashboard state, backed by the URL.
 *
 * The previous shell kept the active view, the selected project, the selected
 * type, the selected tag, the search query and the density in React state only.
 * Two consequences, both bad for an agent-facing tool:
 *
 * 1. Nothing was shareable. An agent could not hand a human a link to a view
 *    with filters applied, because no such URL existed.
 * 2. There were two filter systems. The sidebar wrote `selectedProject` /
 *    `selectedType` / `selectedTag`, which were sent to the server as query
 *    params. The toolbar wrote `filterState`, which was applied client-side to
 *    the already-fetched page. They never reconciled, so the sidebar and the
 *    toolbar could show contradictory results for the same question, and the
 *    "showing N of M" counter mixed a server-filtered total with a
 *    client-filtered subset.
 *
 * This hook collapses both into one filter object, mirrors it into the
 * querystring, and exposes the split the fetch layer needs: server-side
 * params (project, type, tag) and client-side refinements (query, date range,
 * density).
 *
 * `useSearchParams` needs a Suspense boundary in the App Router, so the shell
 * is wrapped in one.
 */

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_VIEW, isViewMode, type ViewMode } from "@/components/shell/view-registry";

export type Density = "grid" | "rows" | "grouped";

export type Filters = {
  /** Server-side: narrows the corpus before it is returned. */
  project: string | null;
  type: string | null;
  tag: string | null;
  /** Client-side refinement over the returned page. */
  query: string;
  from: string | null;
  to: string | null;
  density: Density;
};

const DEFAULT_FILTERS: Filters = {
  project: null,
  type: null,
  tag: null,
  query: "",
  from: null,
  to: null,
  density: "grid",
};

export function useDashboardState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const viewParam = searchParams.get("view");
  const view: ViewMode = isViewMode(viewParam) ? viewParam : DEFAULT_VIEW;

  const selectedRecord = searchParams.get("record");

  const filters: Filters = React.useMemo(
    () => ({
      project: searchParams.get("project"),
      type: searchParams.get("type"),
      tag: searchParams.get("tag"),
      query: searchParams.get("q") ?? "",
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      density: searchParams.get("density") === "rows"
              ? "rows"
              : searchParams.get("density") === "grouped"
                ? "grouped"
                : "grid",
    }),
    [searchParams],
  );

  const filtersRef = React.useRef(filters);
  const searchRef = React.useRef(searchParams);
  React.useEffect(() => {
    filtersRef.current = filters;
    searchRef.current = searchParams;
  }, [filters, searchParams]);

  const update = React.useCallback(
    (mutate: (params: URLSearchParams) => void, options?: { replace?: boolean }) => {
      const next = new URLSearchParams(searchRef.current.toString());
      mutate(next);
      const query = next.toString();
      const href = query ? `${pathname}?${query}` : pathname;
      if (options?.replace) router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    },
    [pathname, router],
  );

  const setView = React.useCallback(
    (next: ViewMode) => update((params) => params.set("view", next), { replace: true }),
    [update],
  );

  const setFilter = React.useCallback(
    <K extends keyof Filters>(key: K, value: Filters[K]) => {
      update((params) => {
        const current = filtersRef.current;
        if (current[key] === value) return;
        if (value === null || value === "" || value === DEFAULT_FILTERS[key]) {
          params.delete(URL_KEYS[key]);
        } else {
          params.set(URL_KEYS[key], String(value));
        }
      });
    },
    [update],
  );

  const setRecord = React.useCallback(
    (id: string | null) =>
      update(
        (params) => {
          if (id) params.set("record", id);
          else params.delete("record");
        },
        { replace: true },
      ),
    [update],
  );

  /** Clearing one facet must not clear the others. */
  const toggleFilter = React.useCallback(
    (key: "project" | "type" | "tag", value: string) => {
      update((params) => {
        if (filtersRef.current[key] === value) params.delete(URL_KEYS[key]);
        else {
          params.set(URL_KEYS[key], value);
          // A project and a record type are independent facets, so selecting one
          // no longer silently cancels the other. The old sidebar forced the
          // user to pick exactly one.
        }
      });
    },
    [update],
  );

  const clearFilters = React.useCallback(() => {
    update((params) => {
      for (const key of Object.values(URL_KEYS)) params.delete(key);
    });
  }, [update]);

  const hasFilters =
    filters.project !== null ||
    filters.type !== null ||
    filters.tag !== null ||
    filters.query !== "" ||
    filters.from !== null ||
    filters.to !== null;

  return {
    view,
    setView,
    filters,
    setFilter,
    toggleFilter,
    clearFilters,
    hasFilters,
    selectedRecord,
    setRecord,
  };
}

const URL_KEYS: Record<keyof Filters, string> = {
  project: "project",
  type: "type",
  tag: "tag",
  query: "q",
  from: "from",
  to: "to",
  density: "density",
};
