"use client";

/**
 * Dashboard shell.
 *
 * The orchestrator, and nothing else. The previous version of this file was
 * 1418 lines: it held ~20 useState hooks, defined the sidebar inline, wrote
 * out the header and eight hand-copied nav buttons, carried a nine-branch view
 * router as a nested ternary, rendered both record variants inline, and
 * declared four global overlays each with their own Escape listener.
 *
 * What remains here is state and wiring. Everything visual lives in ./shell/*.
 */

import * as React from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { CommandPalette } from "@/components/command-palette";
import { CodeDiffViewer } from "@/components/code-diff-viewer";
import { OnboardingDialog } from "@/components/onboarding-dialog";
import { NotificationToastContainer } from "@/components/notification-toast-container";
import { FilterToolbar } from "@/components/filter-toolbar";
import { RecordDossierPanel } from "./shell/record-dossier-panel";
import type { NotificationItem } from "@/components/timelines-notifications";
import { OnboardingChecklistWidget, SpotlightTour, WelcomeCarouselModal } from "@/components/tours";
import type { OnboardingTask } from "@/app/api/onboarding/route";
import { useOnboarding } from "@/lib/onboarding-context";
import type { MemoryItem, MemoryItemType } from "@/lib/types";
import { DashboardHeader } from "./shell/header";
import { DashboardSidebar } from "./shell/sidebar";
import { Overlay } from "./shell/overlay";
import { StreamStatTiles, StreamView } from "./shell/stream-view";
import { LazyViews, ScrollView } from "./shell/view-router";
import { ProjectBriefing } from "./console/project-briefing";
import { VIEW_BY_MODE, type ViewMode } from "./shell/view-registry";
import { useFilteredRecords, useRecords, useWorkspaceSummary } from "./shell/use-dashboard-data";
import { useDashboardState, type Filters } from "./shell/use-dashboard-state";

export { VIEW_BY_MODE };
export type { ViewMode };

export function AppShell() {
  const { view, setView, filters, setFilter, toggleFilter, clearFilters, hasFilters, selectedRecord, setRecord } =
    useDashboardState();
  const { summary, reload: reloadSummary } = useWorkspaceSummary();

  // The Commits view is the Records stream pinned to the commit type. Deriving
  // the filter here rather than duplicating the fetch keeps one request path:
  // the view supplies the type, everything else the user chose still applies.
  const effectiveFilters = React.useMemo<Filters>(
    () => (view === "commits" ? { ...filters, type: "commit" } : filters),
    [view, filters],
  );

  const records = useRecords(effectiveFilters);
  const visibleRecords = useFilteredRecords(records.items, effectiveFilters);

  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [setupOpen, setSetupOpen] = React.useState(false);
  const [bannerDismissed, setBannerDismissed] = React.useState(false);
  const [diffTarget, setDiffTarget] = React.useState<{
    project?: string;
    commitHash?: string;
    itemId?: number | string | null;
  } | null>(null);

  const notifRef = React.useRef<HTMLDivElement>(null);
  const definition = VIEW_BY_MODE[view];

  const {
    welcomeOpen,
    setWelcomeOpen,
    spotlightActive,
    spotlightStep,
    startSpotlight,
    setSpotlightStep,
    closeSpotlight,
    tasks,
    progress,
    toggleTask,
    completeTask,
    restartOnboarding,
    resetOnboarding,
  } = useOnboarding();

  const activeItem: MemoryItem | null = React.useMemo(() => {
    if (!selectedRecord) return null;
    return records.items.find((item) => String(item.id) === selectedRecord) ?? null;
  }, [selectedRecord, records.items]);

  // Notifications are optional and often absent. One read on mount is enough
  // to seed the badge; the toast container owns anything live.
  React.useEffect(() => {
    const controller = new AbortController();
    fetch("/api/memory?action=notifications", { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => setUnreadCount(data.unread_count || 0))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // Close the notification popover on an outside click.
  React.useEffect(() => {
    if (!notifOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [notifOpen]);

  const selectView = React.useCallback(
    (next: ViewMode) => {
      setView(next);
      const task = VIEW_BY_MODE[next].completesTask;
      if (task) completeTask(task);
    },
    [setView, completeTask],
  );

  /** Selecting a record from a graph or a notification. Recovery records
   * carry no neighbour graph, so they are resolved against the loaded page. */
  const selectNeighbor = React.useCallback(
    async (id: string, type: MemoryItemType) => {
      if (type === "adr" || type === "commit" || type === "grill") {
        try {
          const response = await fetch(`/api/memory?action=feed&type=${type}&limit=60`);
          const data = await response.json();
          const list = Array.isArray(data) ? (data as MemoryItem[]) : [];
          const found = list.find((item) => item.id === id);
          if (found) {
            setRecord(String(found.id));
            return;
          }
        } catch {
          // fall through to the local lookup below
        }
      }
      const local = records.items.find((item) => item.id === id);
      if (local) setRecord(String(local.id));
    },
    [records.items, setRecord],
  );

  const openDiff = React.useCallback(
    (target: { project?: string; commitHash?: string; itemId?: number | string | null }) => {
      setDiffTarget(target);
      completeTask("task_inspect_diff");
    },
    [completeTask],
  );

  const breadcrumb =
    view === "stream"
      ? filters.project ?? definition.title
      : definition.title;

  const handleInspectNotification = React.useCallback(
    (item: NotificationItem | MemoryItem) => {
      if (!("item_type" in item) || !("item_id" in item)) return;
      if (item.item_type === "commit" && item.item_id) {
        openDiff({ project: item.project, itemId: item.item_id });
      } else if (item.item_id) {
        void selectNeighbor(
          `${item.item_type}-${item.item_id}`,
          item.item_type as MemoryItemType,
        );
        selectView("stream");
      }
    },
    [openDiff, selectNeighbor, selectView],
  );

  const streamHeader = (
    <div className="flex flex-col justify-between gap-1 border-b border-border/50 pb-3 sm:flex-row sm:items-baseline">
      <div className="min-w-0">
        <h1 className="font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {definition.title}
        </h1>
        <p className="mt-0.5 max-w-prose text-xs leading-relaxed text-muted-foreground">
          {definition.description}
        </p>
      </div>
      {records.items.length > 0 ? (
        <p className="shrink-0 font-mono text-[11px] font-semibold text-muted-foreground">
          {records.items.length} of {records.total} records
        </p>
      ) : null}
    </div>
  );

  const filterBar = (
    <div data-tour="filter-toolbar">
      <StreamStatTiles
        summary={summary}
        onSelectType={(type) => toggleFilter("type", type)}
        onOpenStatus={() => selectView("status")}
      />
      <div className="pt-3">
        <FilterToolbar
          projects={summary?.projects || []}
          totalCount={records.total}
          filteredCount={visibleRecords.length}
          state={{
            query: filters.query,
            // Use the effective type so the control agrees with what the
            // Commits view is actually showing, rather than claiming "all".
            type: effectiveFilters.type ?? "all",
            project: filters.project ?? "all",
            dateRange: {
              preset: "Custom",
              from: filters.from ? new Date(filters.from) : undefined,
              to: filters.to ? new Date(filters.to) : undefined,
            },
            density: filters.density,
          }}
          onChange={(next) => {
            if (next.query !== undefined) setFilter("query", next.query);
            if (next.type !== undefined) {
              setFilter("type", next.type === "all" ? null : next.type);
            }
            if (next.project !== undefined) {
              setFilter("project", next.project === "all" ? null : next.project);
            }
            if (next.density !== undefined) setFilter("density", next.density);
            if (next.dateRange !== undefined) {
              const toIso = (date?: Date) =>
                date ? new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10) : null;
              setFilter("from", toIso(next.dateRange.from));
              setFilter("to", toIso(next.dateRange.to));
            }
          }}
          onReset={clearFilters}
        />
      </div>
    </div>
  );

  return (
    <SidebarProvider>
      <DashboardSidebar
        summary={summary}
        view={view}
        onSelectView={selectView}
        filters={filters}
        onToggleFacet={toggleFilter}
        onClearFilters={clearFilters}
      />

      <SidebarInset className="flex h-dvh flex-col overflow-hidden">
        <DashboardHeader
          view={view}
          onSelectView={selectView}
          breadcrumb={breadcrumb}
          onOpenPalette={() => {
            setPaletteOpen(true);
            completeTask("task_palette_search");
          }}
          loading={records.loading}
          onRefresh={() => {
            void reloadSummary();
            void records.reload();
          }}
          notifOpen={notifOpen}
          onToggleNotif={() => setNotifOpen((open) => !open)}
          unreadCount={unreadCount}
          notifRef={notifRef}
          onSelectNotification={(item) => {
            setNotifOpen(false);
            setUnreadCount((previous) => Math.max(0, previous - 1));
            if (item.item_type === "commit" && item.item_id) {
              openDiff({ project: item.project, itemId: item.item_id });
            } else if (item.item_id) {
              void selectNeighbor(`${item.item_type}-${item.item_id}`, item.item_type);
              selectView("stream");
            }
          }}
          onViewAllActivity={() => {
            setNotifOpen(false);
            selectView("activity");
          }}
        />

        {summary?.is_demo && !bannerDismissed ? (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-primary/25 bg-primary/10 px-4 py-2 text-xs">
            <p className="flex items-center gap-2 text-foreground">
              <span className="font-semibold">Demo mode.</span>
              <span className="text-muted-foreground">
                These records are the built-in sample set. Run{" "}
                <code className="rounded bg-background/40 px-1.5 py-0.5 font-mono text-[11px]">
                  pnpm setup
                </code>{" "}
                to connect your local repositories.
              </span>
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setSetupOpen(true)}
                className="rounded border border-primary/40 px-2.5 py-1 font-medium text-foreground transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Setup guide
              </button>
              <button
                type="button"
                onClick={() => setBannerDismissed(true)}
                aria-label="Dismiss demo notice"
                className="rounded px-1.5 py-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {view === "briefing" ? (
            <>
              <ProjectBriefing
                items={visibleRecords}
                total={records.total}
                projectName={filters.project}
                onSelect={(item) => setRecord(String(item.id))}
                onOpenConsole={() => selectView("planning")}
                onOpenStream={() => selectView("stream")}
                isFallback={records.isFallback}
              />
            </>
          ) : view === "stream" || view === "commits" ? (
            <>
              <StreamView
                items={visibleRecords}
                total={records.total}
                loaded={records.items.length}
                loading={records.loading}
                loadingMore={records.loadingMore}
                error={records.error}
                isFallback={records.isFallback}
                activeItem={activeItem}
                onSelect={(item) => setRecord(String(item.id))}
                density={filters.density}
                onDensityChange={(density) => setFilter("density", density)}
                onLoadMore={() => void records.loadMore()}
                hasFilters={hasFilters}
                onClearFilters={clearFilters}
                header={streamHeader}
                filterBar={filterBar}
              />
            </>
          ) : view === "deploys" ? (
            <ScrollView>
              <LazyViews.TimelinesDeploys
                onInspectCommit={(project, commitHash) => openDiff({ project, commitHash })}
              />
            </ScrollView>
          ) : view === "activity" ? (
            <ScrollView>
              <LazyViews.TimelinesActivityFeed
                onSelectItem={(type, id) => {
                  if (type === "commit") openDiff({ itemId: id });
                  else {
                    void selectNeighbor(id, type);
                    selectView("stream");
                  }
                }}
              />
            </ScrollView>
          ) : view === "planning" ? (
            <LazyViews.ProjectIntelligenceConsole />
          ) : view === "status" ? (
            <ScrollView>
              <LazyViews.TimelinesStatusPage />
            </ScrollView>
          ) : view === "skills" ? (
            <ScrollView>
              <LazyViews.SkillsWorkspace />
            </ScrollView>
          ) : (
            <ScrollView>
              <LazyViews.TableLogs />
            </ScrollView>
          )}

          {/* The record dossier belongs to every surface that lists records, so
              it is mounted once here instead of being repeated per branch. The
              views that render their own selection chrome (console, activity,
              deploys) own their own panel. */}
          {activeItem && (view === "briefing" || view === "stream" || view === "commits") ? (
            <RecordDossierPanel
              item={activeItem}
              onClose={() => setRecord(null)}
              onOpenDiff={(item: MemoryItem) =>
                openDiff({
                  project: item.project,
                  commitHash: item.commit_hash,
                  itemId: item.commit_hash ? undefined : item.id,
                })
              }
            />
          ) : null}
        </div>
      </SidebarInset>

      <Overlay
        open={diffTarget !== null}
        onClose={() => setDiffTarget(null)}
        label="Commit diff viewer"
        size="xl"
        showClose={false}
      >
        {diffTarget ? (
          <CodeDiffViewer
            project={diffTarget.project}
            commitHash={diffTarget.commitHash}
            itemId={diffTarget.itemId}
            isModal
            onClose={() => setDiffTarget(null)}
          />
        ) : null}
      </Overlay>

      <NotificationToastContainer onInspectNotification={handleInspectNotification} />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={(item) => {
          setRecord(String(item.id));
          setView("stream");
        }}
      />

      <OnboardingDialog open={setupOpen} onClose={() => setSetupOpen(false)} isDemo={summary?.is_demo} />

      <WelcomeCarouselModal
        open={welcomeOpen}
        onClose={() => setWelcomeOpen(false)}
        onStartTour={() => startSpotlight(0)}
        repoName={summary?.projects?.[0] || "pitmry"}
        isDemo={summary?.is_demo}
      />

      <SpotlightTour
        active={spotlightActive}
        step={spotlightStep}
        onStepChange={setSpotlightStep}
        onComplete={closeSpotlight}
        onDismiss={closeSpotlight}
      />

      <OnboardingChecklistWidget
        tasks={tasks}
        onToggleTask={toggleTask}
        onTaskAction={(task: OnboardingTask) => {
          if (task.action_type === "view" && task.target_view) {
            selectView(task.target_view as ViewMode);
          } else if (task.action_type === "open_diff") {
            const firstCommit = records.items.find((item: MemoryItem) => item.type === "commit");
            openDiff({
              project: firstCommit?.project ?? filters.project ?? "pitmry",
              commitHash: firstCommit?.commit_hash,
              itemId: firstCommit?.id,
            });
          } else if (task.action_type === "open_palette") {
            setPaletteOpen(true);
            completeTask("task_palette_search");
          }
        }}
        onRestartTour={restartOnboarding}
        onResetOnboarding={resetOnboarding}
        progressPct={progress.percentage}
        repoName={summary?.projects?.[0] || "pitmry"}
      />
    </SidebarProvider>
  );
}
