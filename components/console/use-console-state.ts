"use client";

/**
 * Console URL state.
 *
 * The previous app kept the active view, the project and every filter in
 * React state only. Nothing was shareable, nothing survived a refresh, and the
 * browser back button did nothing. For an agent-facing tool that is a real
 * cost: an agent cannot hand a human a link to a specific view and record.
 *
 * This hook serialises the console's meaningful state into the querystring and
 * keeps it in sync with history, so every view is deep-linkable and back /
 * forward work as expected.
 *
 * `useSearchParams` requires a Suspense boundary in the App Router. The parent
 * view wraps this component accordingly, otherwise Next.js will refuse to
 * prerender the route.
 */

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export const CONSOLE_TABS = ["board", "chain", "map", "handoff", "verification", "release"] as const;
export type ConsoleTab = (typeof CONSOLE_TABS)[number];

function isConsoleTab(value: string | null): value is ConsoleTab {
  return value !== null && (CONSOLE_TABS as readonly string[]).includes(value);
}

export function useConsoleState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("view");
  const tab: ConsoleTab = isConsoleTab(tabParam) ? tabParam : "board";
  const projectId = searchParams.get("project");
  const selectedId = searchParams.get("record");

  // Keep the latest params without making every callback depend on the whole
  // searchParams object, which changes identity on every navigation. The write
  // happens in an effect because assigning a ref during render is unsafe.
  const paramsRef = React.useRef(searchParams);
  React.useEffect(() => {
    paramsRef.current = searchParams;
  }, [searchParams]);

  const update = React.useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(paramsRef.current.toString());
      mutate(next);
      // `replace` keeps the back button meaningful: it steps out of the console
      // rather than walking through every record the user inspected.
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const setTab = React.useCallback(
    (next: ConsoleTab) => update((params) => params.set("view", next)),
    [update],
  );

  const setProjectId = React.useCallback(
    (next: string) =>
      update((params) => {
        params.set("project", next);
        // The selected record belongs to the previous project. Keeping it would
        // leave the inspector showing a record the new project does not have.
        params.delete("record");
      }),
    [update],
  );

  const setSelectedId = React.useCallback(
    (next: string | null) =>
      update((params) => {
        if (next) params.set("record", next);
        else params.delete("record");
      }),
    [update],
  );

  return { tab, setTab, projectId, setProjectId, selectedId, setSelectedId };
}
