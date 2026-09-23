"use client";

import dynamic from "next/dynamic";
import React, { useDeferredValue, useEffect, useState, useRef } from "react";
import type { MemoryItem, MemorySummary, TagCount, MemoryItemType } from "@/lib/types";
import { formatAuthority, formatItemType } from "@/lib/types";
import {
  Search,
  Network,
  ListFilter,
  Boxes,
  Cpu,
  AlertCircle,
  RefreshCw,
  Bell,
  Activity,
  Server,
  GitBranch,
  Layers,
  Code2,
  Terminal,
  Compass,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/stat-tile";
import { RelationalInspector } from "@/components/relational-inspector";
const KnowledgeGraph = dynamic(
  () => import("@/components/knowledge-graph").then((m) => m.KnowledgeGraph),
  { ssr: false, loading: () => <div className="flex items-center justify-center py-12 text-xs text-muted-foreground animate-pulse">Loading graph…</div> }
);
const GalaxyView = dynamic(
  () => import("@/components/galaxy-view").then((m) => m.GalaxyView),
  { ssr: false, loading: () => <div className="flex items-center justify-center py-12 text-xs text-muted-foreground animate-pulse">Loading 3D view…</div> }
);
import { DesignTokenController } from "@/components/design-token-controller";
import { CommandPalette } from "@/components/command-palette";
import { TimelinesStatusPage } from "@/components/timelines-status-page";
import { TimelinesDeploys } from "@/components/timelines-deploys";
import { TimelinesActivityFeed } from "@/components/timelines-activity-feed";
import { TimelinesNotifications, NotificationItem } from "@/components/timelines-notifications";
import { NotificationToastContainer } from "@/components/notification-toast-container";
import { CodeDiffViewer } from "@/components/code-diff-viewer";
import { OnboardingDialog } from "@/components/onboarding-dialog";
import { SkillsWorkspace } from "@/components/skills-workspace";
import { FilterToolbar, type FilterToolbarState } from "@/components/filter-toolbar";
import { TableLogs } from "@/components/table-logs";
import {
  WelcomeCarouselModal,
  SpotlightTour,
  FeatureBeacon,
  OnboardingChecklistWidget,
} from "@/components/tours";
import { useOnboarding } from "@/lib/onboarding-context";
import { cn, formatDate } from "@/lib/utils";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { CustomSidebarTrigger } from "@/components/custom-sidebar-trigger";
import { Separator } from "@/components/ui/separator";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardSquare01Icon,
  GitBranchIcon as GitBranchHugeIcon,
  MessageQuestionIcon,
  Settings01Icon,
  ComputerTerminalIcon,
  HashtagIcon,
  Folder01Icon,
  SearchList01Icon,
} from "@hugeicons/core-free-icons";

export type ViewMode =
  | "stream"
  | "graph"
  | "galaxy"
  | "deploys"
  | "status"
  | "activity"
  | "skills"
  | "logs";

const VIEW_META: Record<ViewMode, { label: string; title: string; description: string }> = {
  stream: {
    label: "all-projects",
    title: "Operational memory stream",
    description: "Canonical project records with source, authority, and resolved state.",
  },
  deploys: {
    label: "deploys",
    title: "Deploy and commit history",
    description: "Browse captured Git changes. Deployment data appears only when recorded.",
  },
  activity: {
    label: "activity",
    title: "Recent activity",
    description: "A timeline of canonical records and their recorded sources.",
  },
  status: {
    label: "status",
    title: "Memory readiness",
    description: "Independent status for canonical records and rebuildable indexes.",
  },
  graph: { label: "graph", title: "Knowledge graph", description: "Explore relationships across your memory records." },
  galaxy: { label: "galaxy", title: "3D vector view", description: "Explore the vector projection when its layout is available." },
  skills: { label: "skills", title: "Skills workspace", description: "Run offline workflows and automations." },
  logs: { label: "logs", title: "System logs", description: "Inspect local service and runtime events." },
};

function getItemInitials(item: MemoryItem) {
  const source = item.project?.trim() || formatItemType(item.type);
  return source
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/* ---------- Memory Sidebar ---------- */
function MemorySidebar({
  summary,
  selectedProject,
  setSelectedProject,
  selectedType,
  setSelectedType,
  selectedTag,
  setSelectedTag,
  viewMode,
  setViewMode,
}: {
  summary: MemorySummary | null;
  selectedProject: string | null;
  setSelectedProject: (p: string | null) => void;
  selectedType: string | null;
  setSelectedType: (t: string | null) => void;
  selectedTag: string | null;
  setSelectedTag: (g: string | null) => void;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
}) {
  return (
    <Sidebar collapsible="icon" variant="floating">
      {/* Brand */}
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border">
        <SidebarMenuButton
          tooltip="Memory Dashboard"
          className="gap-3 cursor-pointer"
          onClick={() => setViewMode("stream")}
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 border border-primary/20 font-mono text-[11px] font-bold text-primary">
            M
          </div>
          <span className="font-semibold tracking-tight text-sidebar-foreground">
            pitmry
          </span>
        </SidebarMenuButton>
      </SidebarHeader>

      <SidebarContent>
        {/* Hubs & Views Navigation */}
        <SidebarGroup data-tour="views-nav">
          <SidebarGroupLabel>Views</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={viewMode === "stream"}
                onClick={() => setViewMode("stream")}
                tooltip="Stream"
              >
                <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={1.5} />
                <span>Stream</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={viewMode === "deploys"}
                onClick={() => setViewMode("deploys")}
                tooltip="Deploys"
              >
                <HugeiconsIcon icon={GitBranchHugeIcon} strokeWidth={1.5} />
                <span>Deploys</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={viewMode === "activity"}
                onClick={() => setViewMode("activity")}
                tooltip="Activity"
              >
                <HugeiconsIcon icon={SearchList01Icon} strokeWidth={1.5} />
                <span>Activity</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={viewMode === "status"}
                onClick={() => setViewMode("status")}
                tooltip="Status"
              >
                <HugeiconsIcon icon={ComputerTerminalIcon} strokeWidth={1.5} />
                <span>Status</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={viewMode === "skills"}
                onClick={() => setViewMode("skills")}
                tooltip="Skills & Automations"
              >
                <Cpu className="size-4" />
                <span>Skills &amp; Automations</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={viewMode === "logs"}
                onClick={() => setViewMode("logs")}
                tooltip="Server Logs"
              >
                <Terminal className="size-4 text-primary" />
                <span>Server Logs</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Projects */}
        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={selectedProject === null && selectedType === null && selectedTag === null && viewMode === "stream"}
                onClick={() => {
                  setSelectedProject(null);
                  setSelectedType(null);
                  setSelectedTag(null);
                  setViewMode("stream");
                }}
                tooltip="All items"
              >
                <HugeiconsIcon icon={Folder01Icon} strokeWidth={1.5} />
                <span>All Projects</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                  {summary?.stats?.total_records || 0}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {summary?.projects?.map((proj: string) => (
              <SidebarMenuItem key={proj}>
                <SidebarMenuButton
                  isActive={selectedProject === proj}
                  onClick={() => {
                    setSelectedProject(selectedProject === proj ? null : proj);
                    setViewMode("stream");
                  }}
                  tooltip={proj}
                >
                  <HugeiconsIcon icon={SearchList01Icon} strokeWidth={1.5} />
                  <span className="truncate">{proj}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {/* Record Types */}
        <SidebarGroup>
          <SidebarGroupLabel>Types</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={selectedType === "adr"}
                onClick={() => {
                  setSelectedType(selectedType === "adr" ? null : "adr");
                  setViewMode("stream");
                }}
                tooltip="Decisions"
              >
                <HugeiconsIcon icon={Settings01Icon} strokeWidth={1.5} />
                <span>Decisions</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                  {summary?.stats?.total_adrs || 0}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={selectedType === "commit"}
                onClick={() => {
                  setSelectedType(selectedType === "commit" ? null : "commit");
                  setViewMode("stream");
                }}
                tooltip="Commits"
              >
                <HugeiconsIcon icon={GitBranchHugeIcon} strokeWidth={1.5} />
                <span>Commits</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                  {summary?.stats?.total_commits || 0}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={selectedType === "grill"}
                onClick={() => {
                  setSelectedType(selectedType === "grill" ? null : "grill");
                  setViewMode("stream");
                }}
                tooltip="Discussions"
              >
                <HugeiconsIcon icon={MessageQuestionIcon} strokeWidth={1.5} />
                <span>Discussions</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                  {summary?.stats?.total_grill || 0}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Tags */}
        {summary && (summary.tags?.length ?? 0) > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Tags</SidebarGroupLabel>
            <SidebarMenu>
              {(summary.tags ?? []).slice(0, 10).map((t: TagCount) => (
                <SidebarMenuItem key={t.tag}>
                  <SidebarMenuButton
                    isActive={selectedTag === t.tag}
                    onClick={() => {
                      setSelectedTag(selectedTag === t.tag ? null : t.tag);
                      setViewMode("stream");
                    }}
                    tooltip={`#${t.tag}`}
                  >
                    <HugeiconsIcon icon={HashtagIcon} strokeWidth={1.5} />
                    <span className="truncate">#{t.tag}</span>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                      {t.count}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem data-tour="readiness-button">
            <SidebarMenuButton
              onClick={() => setViewMode("status")}
              tooltip="Open memory readiness"
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <span className="size-2 rounded-full bg-primary shrink-0" />
              <span className="font-mono text-[10px] font-medium truncate">
                Memory readiness
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

/* ---------- Main Shell ---------- */
export function AppShell() {
  const [summary, setSummary] = useState<MemorySummary | null>(null);
  const [feed, setFeed] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("stream");
  const [activeItem, setActiveItem] = useState<MemoryItem | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [diffModalState, setDiffModalState] = useState<{
    open: boolean;
    project?: string;
    commitHash?: string;
    itemId?: number | string | null;
  }>({ open: false });

  const [filterState, setFilterState] = useState<FilterToolbarState>({
    query: "",
    type: "all",
    project: "all",
    dateRange: { preset: "Last 30 days" },
    density: "grid",
  });

  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

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
    isBeaconSeen,
    markBeaconSeen,
    restartOnboarding,
    resetOnboarding,
  } = useOnboarding();

  const notifRef = useRef<HTMLDivElement>(null);
  const feedAbortRef = useRef<AbortController | null>(null);
  const deferredQuery = useDeferredValue(filterState.query);

  const filterCriteria = React.useMemo(
    () => ({
      query: deferredQuery,
      type: filterState.type,
      project: filterState.project,
      from: filterState.dateRange.from?.getTime() ?? null,
      to: filterState.dateRange.to?.getTime() ?? null,
      density: filterState.density,
    }),
    [deferredQuery, filterState.type, filterState.project, filterState.dateRange.from, filterState.dateRange.to, filterState.density]
  );

  const filteredFeed = React.useMemo(() => {
    return feed.filter((item) => {
      // 1. Text Query (deferred — keeps typing responsive)
      if (filterCriteria.query.trim()) {
        const q = filterCriteria.query.toLowerCase().trim();
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchSummary =
          item.summary?.toLowerCase().includes(q) ||
          item.rationale?.toLowerCase().includes(q);
        const matchTags = item.tags?.some((t: string) => t.toLowerCase().includes(q));
        const matchCommit = item.commit_hash?.toLowerCase().includes(q);
        if (!matchTitle && !matchSummary && !matchTags && !matchCommit) return false;
      }

      // 2. Type Filter
      if (filterCriteria.type !== "all" && item.type !== filterCriteria.type) {
        return false;
      }

      // 3. Project Filter
      if (filterCriteria.project !== "all" && item.project !== filterCriteria.project) {
        return false;
      }

      // 4. Date Range Filter
      if (filterCriteria.from && item.timestamp) {
        const itemTime = new Date(item.timestamp).getTime();
        if (itemTime < filterCriteria.from) return false;
        if (filterCriteria.to) {
          const toEnd = filterCriteria.to + 86399999; // end of day
          if (itemTime > toEnd) return false;
        }
      }

      return true;
    });
  }, [feed, filterCriteria]);

  const fetchSummary = () => {
    fetch("/api/memory?action=summary")
      .then((res) => res.json())
      .then((data) => setSummary(data))
      .catch((err) => console.error(err));
  };

  const fetchFeed = () => {
    feedAbortRef.current?.abort();
    const controller = new AbortController();
    feedAbortRef.current = controller;
    setLoading(true);
    let url = "/api/memory?action=feed&limit=60";
    if (selectedProject) url += `&project=${encodeURIComponent(selectedProject)}`;
    if (selectedType) url += `&type=${encodeURIComponent(selectedType)}`;
    if (selectedTag) url += `&tag=${encodeURIComponent(selectedTag)}`;

    fetch(url, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        const items = Array.isArray(data) ? (data as MemoryItem[]) : [];
        setFeed(items);
        setLoading(false);
        if (items.length > 0) {
          setActiveItem((prev) => prev ?? items[0]);
        }
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchSummary();
    fetch("/api/memory?action=notifications")
      .then((res) => res.json())
      .then((data) => setUnreadCount(data.unread_count || 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(fetchFeed, 0);
    return () => {
      window.clearTimeout(timer);
      feedAbortRef.current?.abort();
    };
  }, [selectedProject, selectedType, selectedTag]);

  // Click outside to close notification popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifOpen]);

  // Global Escape key listener for overlays
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (diffModalState.open) setDiffModalState({ open: false });
        if (onboardingOpen) setOnboardingOpen(false);
        if (notifOpen) setNotifOpen(false);
        if (welcomeOpen) setWelcomeOpen(false);
        if (spotlightActive) closeSpotlight();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [diffModalState.open, onboardingOpen, notifOpen, welcomeOpen, spotlightActive, setWelcomeOpen, closeSpotlight]);

  const handleSelectNeighbor = (id: string, type: MemoryItemType) => {
    if (type !== "adr" && type !== "commit" && type !== "grill") {
      // Recovery records (checkpoint/memory/summary) carry no neighbor graph;
      // select from the already-loaded feed instead.
      const local = feed.find((it) => it.id === id);
      if (local) setActiveItem(local);
      return;
    }
    fetch(`/api/memory?action=feed&type=${type}&limit=60`)
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? (data as MemoryItem[]) : [];
        const found = list.find((it) => it.id === id);
        if (found) {
          setActiveItem(found);
        }
      });
  };

  return (
    <SidebarProvider>
      {/* Collapsible Sidebar */}
      <MemorySidebar
        summary={summary}
        selectedProject={selectedProject}
        setSelectedProject={setSelectedProject}
        selectedType={selectedType}
        setSelectedType={(t) => {
          setSelectedType(t);
          if (t) setSelectedProject(null);
        }}
        selectedTag={selectedTag}
        setSelectedTag={(g) => {
          setSelectedTag(g);
          if (g) setSelectedProject(null);
        }}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      {/* Main Content Inset */}
      <SidebarInset className="flex flex-col overflow-hidden h-screen">
        {/* Top Navbar */}
        <header className="relative z-40 flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border/70 px-3 bg-background/80 backdrop-blur">
          {/* Sidebar toggle + Breadcrumbs + Search */}
          <div className="flex items-center gap-2">
            <CustomSidebarTrigger />
            <Separator orientation="vertical" className="h-4 opacity-40" />
            <div className="hidden sm:flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">pitmry</span>
              <span>/</span>
              <span className="text-primary font-medium capitalize">
                {viewMode === "stream" ? (selectedProject || VIEW_META.stream.label) : VIEW_META[viewMode].label}
              </span>
              {selectedType && viewMode === "stream" && (
                <>
                  <span>/</span>
                  <span className="text-muted-foreground capitalize">{selectedType}</span>
                </>
              )}
            </div>
            <Separator orientation="vertical" className="h-4 opacity-40 hidden sm:block" />
            <Button
              variant="outline"
              size="sm"
              data-tour="search-palette"
              onClick={() => {
                setPaletteOpen(true);
                completeTask("task_palette_search");
              }}
              className="w-40 sm:w-48 lg:w-60 justify-start text-xs text-muted-foreground font-normal hover:text-foreground h-8"
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Search memory...</span>
              <kbd className="ml-auto rounded border border-border bg-secondary px-1.5 text-[10px] font-mono text-muted-foreground">
                ⌘K
              </kbd>
            </Button>
          </div>

          {/* View Switcher & Controls */}
          <div className="flex items-center gap-1.5">
            {/* View Switcher with simple labels */}
            <div className="flex items-center rounded-md border border-border/70 bg-secondary/40 p-0.5 text-xs">
              <button
                onClick={() => setViewMode("stream")}
                className={cn(
                  "flex items-center gap-1 rounded px-2 py-0.5 font-medium transition-colors text-xs cursor-pointer",
                  viewMode === "stream"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Memory list"
              >
                <ListFilter className="h-3.5 w-3.5" />
                <span className="hidden md:inline">List</span>
              </button>

              <button
                onClick={() => setViewMode("deploys")}
                className={cn(
                  "flex items-center gap-1 rounded px-2 py-0.5 font-medium transition-colors text-xs cursor-pointer",
                  viewMode === "deploys"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Git deploys"
              >
                <GitBranch className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Deploys</span>
              </button>

              <button
                onClick={() => setViewMode("activity")}
                className={cn(
                  "flex items-center gap-1 rounded px-2 py-0.5 font-medium transition-colors text-xs cursor-pointer",
                  viewMode === "activity"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Activity timeline"
              >
                <Activity className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Timeline</span>
              </button>

              <button
                onClick={() => {
                  setViewMode("graph");
                  completeTask("task_explore_graph");
                }}
                className={cn(
                  "flex items-center gap-1 rounded px-2 py-0.5 font-medium transition-colors text-xs cursor-pointer",
                  viewMode === "graph"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Knowledge graph"
              >
                <Network className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Graph</span>
              </button>

              <FeatureBeacon
                id="beacon_galaxy_3d"
                title="3D Vector Galaxy"
                body="A spatial embedding projection is not available from the canonical store yet."
                seen={isBeaconSeen("beacon_galaxy_3d")}
                onAcknowledge={markBeaconSeen}
                align="bottom"
              >
                <button
                  onClick={() => {
                    setViewMode("galaxy");
                    completeTask("task_explore_graph");
                  }}
                  className={cn(
                    "flex items-center gap-1 rounded px-2 py-0.5 font-medium transition-colors text-xs cursor-pointer",
                    viewMode === "galaxy"
                      ? "bg-card text-primary shadow-xs font-semibold border border-primary/30"
                      : "text-muted-foreground hover:text-primary"
                  )}
                  title="3D vector galaxy"
                >
                  <Boxes className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">3D</span>
                </button>
              </FeatureBeacon>

              <button
                onClick={() => setViewMode("status")}
                className={cn(
                  "flex items-center gap-1 rounded px-2 py-0.5 font-medium transition-colors text-xs cursor-pointer",
                  viewMode === "status"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="System status"
              >
                <Server className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Status</span>
              </button>

              <FeatureBeacon
                id="beacon_skills_workspace"
                title="Skills Workspace"
                body="Run offline Claude workflows, commit digests, and automated skills locally."
                seen={isBeaconSeen("beacon_skills_workspace")}
                onAcknowledge={markBeaconSeen}
                align="bottom"
              >
                <button
                  onClick={() => setViewMode("skills")}
                  className={cn(
                    "flex items-center gap-1 rounded px-2 py-0.5 font-medium transition-colors text-xs cursor-pointer",
                    viewMode === "skills"
                      ? "bg-card text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Skills & Automations"
                >
                  <Cpu className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Skills</span>
                </button>
              </FeatureBeacon>

              <button
                onClick={() => setViewMode("logs")}
                className={cn(
                  "flex items-center gap-1 rounded px-2 py-0.5 font-medium transition-colors text-xs cursor-pointer",
                  viewMode === "logs"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Server logs & Localhost status"
              >
                <Terminal className="h-3.5 w-3.5 text-primary" />
                <span className="hidden md:inline">Logs</span>
              </button>
            </div>

            {/* Notification Bell with Popover */}
            <div className="relative" ref={notifRef}>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative"
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell className="h-3.5 w-3.5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground shadow-xs animate-in zoom-in">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>

              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 z-50 w-80 sm:w-96 shadow-2xl animate-in fade-in-0 slide-in-from-top-2 duration-150">
                  <TimelinesNotifications
                    onSelectNotification={(item) => {
                      setNotifOpen(false);
                      setUnreadCount((prev) => Math.max(0, prev - 1));
                      if (item.item_type === "commit" && item.item_id) {
                        setDiffModalState({
                          open: true,
                          project: item.project,
                          itemId: item.item_id,
                        });
                      } else if (item.item_id) {
                        handleSelectNeighbor(`${item.item_type}-${item.item_id}`, item.item_type);
                        setViewMode("stream");
                      }
                    }}
                    onViewAllActivity={() => {
                      setNotifOpen(false);
                      setViewMode("activity");
                    }}
                  />
                </div>
              )}
            </div>

            <DesignTokenController />

            {/* Onboarding Tour Re-trigger */}
            <Button
              variant="outline"
              size="xs"
              onClick={() => restartOnboarding()}
              title="Repository onboarding checklist"
              className="gap-1.5 h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Compass className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Onboarding</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {progress.percentage}%
              </span>
            </Button>

            {summary?.is_demo && (
              <Button
                variant="odysseyui"
                size="xs"
                onClick={() => setOnboardingOpen(true)}
                title="Connect real repositories & vector memory"
                className="gap-1 font-medium"
              >
                <span>Setup</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => {
                fetchSummary();
                fetchFeed();
              }}
              title="Refresh"
              aria-label="Refresh dashboard data"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
          </div>
        </header>

        {/* Demo Mode Notice Banner */}
        {summary?.is_demo && !bannerDismissed && (
          <div className="flex items-center justify-between border-b border-primary/25 bg-primary/10 px-4 py-1.5 text-xs backdrop-blur shrink-0 animate-in fade-in-0 duration-150">
            <div className="flex items-center gap-2 text-foreground">
              <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>
                <strong className="font-semibold text-foreground">Demo Mode:</strong> You are exploring built-in sample memory. Run <code className="font-mono bg-black/40 px-1.5 py-0.5 rounded text-foreground text-[11px]">pnpm setup</code> to connect your local repositories & vector engine.
                {summary?.fallback && summary?.fallback_reason && (
                  <span className="block text-muted-foreground mt-0.5">
                    Reason: {summary.fallback_reason}
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="odysseyui"
                size="xs"
                onClick={() => setOnboardingOpen(true)}
              >
                Setup Guide
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setBannerDismissed(true)}
                title="Dismiss notice"
                aria-label="Dismiss notice"
              >
                ✕
              </Button>
            </div>
          </div>
        )}

        {/* Body: Multi-View Hub */}
        <div className="flex flex-1 overflow-hidden">
          {viewMode === "galaxy" ? (
            <div className="flex-1 h-full">
              <GalaxyView
                onSelectNode={(id, type) => {
                  handleSelectNeighbor(id, type);
                  setViewMode("stream");
                }}
              />
            </div>
          ) : viewMode === "graph" ? (
            <div className="flex-1 h-full">
              <KnowledgeGraph
                onSelectNode={(id, type) => {
                  handleSelectNeighbor(id, type);
                }}
              />
            </div>
          ) : viewMode === "deploys" ? (
            <div className="flex-1 h-full overflow-y-auto">
              <TimelinesDeploys
                onInspectCommit={(proj, sha) => {
                  setDiffModalState({
                    open: true,
                    project: proj,
                    commitHash: sha,
                  });
                  completeTask("task_inspect_diff");
                }}
              />
            </div>
          ) : viewMode === "status" ? (
            <div className="flex-1 h-full overflow-y-auto">
              <TimelinesStatusPage />
            </div>
          ) : viewMode === "skills" ? (
            <div className="flex-1 h-full overflow-y-auto flex flex-col">
              <SkillsWorkspace />
            </div>
          ) : viewMode === "logs" ? (
            <div className="flex-1 h-full overflow-y-auto flex flex-col">
              <TableLogs />
            </div>
          ) : viewMode === "activity" ? (
            <div className="flex-1 h-full overflow-y-auto">
              <TimelinesActivityFeed
                onSelectItem={(type, id) => {
                    if (type === "commit") {
                      setDiffModalState({
                        open: true,
                        itemId: id,
                      });
                    } else {
                      handleSelectNeighbor(id, type);
                    setViewMode("stream");
                  }
                }}
              />
            </div>
          ) : (
            /* Standard List / Stream View */
            <div className="flex flex-1 overflow-hidden">
              {/* Feed column */}
              <div className="@container/feed flex flex-1 flex-col overflow-y-auto p-4 sm:p-5 space-y-4">
                {/* View Header (H1) */}
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 border-b border-border/50 pb-3">
                  <div>
                    <h1 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                      {VIEW_META.stream.title}
                    </h1>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {VIEW_META.stream.description}
                    </p>
                  </div>
                  {feed.length > 0 && (
                    <div className="font-mono text-[11px] font-semibold text-muted-foreground shrink-0">
                      {feed.length} indexed records
                    </div>
                  )}
                </div>

                {/* Stat Tiles */}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                  <StatTile
                    label="Decisions"
                    value={summary?.stats?.total_adrs || 0}
                    description="Architecture choices saved"
                    badge="Saved"
                    sparkline={[12, 14, 15, 18, 20, 22, 23]}
                    onClick={() => setSelectedType("adr")}
                  />
                  <StatTile
                    label="Commits"
                    value={summary?.stats?.total_commits || 0}
                    description="Code changes tracked"
                    badge="Git"
                    sparkline={[4, 6, 8, 10, 12, 14, 15]}
                    onClick={() => setSelectedType("commit")}
                  />
                  <StatTile
                    label="Discussions"
                    value={summary?.stats?.total_grill || 0}
                    description="Questions and design notes"
                    badge="Notes"
                    sparkline={[0, 1, 1, 1, 1, 1, 1]}
                    onClick={() => setSelectedType("grill")}
                  />
                  <StatTile
                    label="Search Index"
                    value={summary?.stats?.total_vectors || 0}
                    description="Items connected by topic"
                    badge="Search"
                    sparkline={[10, 15, 20, 28, 32, 36, 39]}
                    onClick={() => setViewMode("status")}
                  />
                </div>

                {/* Filter Toolbar (devl.dev toolbar + date-range) */}
                <div data-tour="filter-toolbar">
                  <FilterToolbar
                    projects={summary?.projects || []}
                    totalCount={feed.length}
                    filteredCount={filteredFeed.length}
                    state={filterState}
                    onChange={setFilterState}
                    onReset={() => {
                      setSelectedProject(null);
                      setSelectedType(null);
                      setSelectedTag(null);
                      setFilterState({
                        query: "",
                        type: "all",
                        project: "all",
                        dateRange: { preset: "Last 30 days" },
                        density: filterState.density,
                      });
                    }}
                  />
                </div>

                {/* Activity Feed */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-heading text-sm sm:text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                      <span>Recent Activity</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground">
                        {filteredFeed.length}
                      </span>
                    </h2>
                    {(selectedProject || selectedType || selectedTag || filterState.query || filterState.type !== "all" || filterState.project !== "all") && (
                      <button
                        onClick={() => {
                          setSelectedProject(null);
                          setSelectedType(null);
                          setSelectedTag(null);
                          setFilterState({
                            query: "",
                            type: "all",
                            project: "all",
                            dateRange: { preset: "Last 30 days" },
                            density: filterState.density,
                          });
                        }}
                        className="text-xs text-primary hover:underline font-semibold cursor-pointer"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>

                  {loading ? (
                    <div className="flex items-center justify-center py-12 text-xs text-muted-foreground animate-pulse">
                      Loading...
                    </div>
                  ) : filteredFeed.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                      No items match your filter criteria.
                    </div>
                  ) : filterState.density === "rows" ? (
                    /* Compact Rows View */
                    <div className="divide-y divide-border/60 rounded-xl border border-border/80 bg-card shadow-2xs overflow-hidden">
                      {filteredFeed.map((item) => {
                        const isSelected = activeItem?.id === item.id;
                        return (
                          <div
                            key={item.id}
                            tabIndex={0}
                            role="button"
                            onClick={() => setActiveItem(item)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setActiveItem(item);
                              }
                            }}
                            className={cn(
                              "flex items-center gap-3 px-3.5 py-2.5 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                              isSelected ? "bg-primary/10" : "hover:bg-muted/40"
                            )}
                          >
                            <span
                              className={cn(
                                "size-2 rounded-full shrink-0",
                                item.type === "adr"
                                  ? "bg-primary"
                                  : item.type === "commit"
                                    ? "bg-emerald-500"
                                    : "bg-sky-500"
                              )}
                            />
                            <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground w-16 shrink-0">
                              {formatItemType(item.type)}
                            </span>
                            <span className="font-heading text-xs sm:text-[13px] font-semibold text-foreground truncate flex-1">
                              {item.title}
                            </span>
                            <span className="rounded bg-secondary/80 px-2 py-0.5 text-[10px] font-mono text-muted-foreground shrink-0 hidden sm:inline-block">
                              {item.project}
                            </span>
                            <span className="font-mono text-[11px] text-muted-foreground shrink-0 tabular-nums">
                              {formatDate(item.timestamp)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Rich Bento Grid View (Adaptive Desktop Min-Max Breakpoint Column System) */
                    <div className="grid grid-cols-1 @[640px]/feed:grid-cols-2 @[1120px]/feed:grid-cols-3 @[1580px]/feed:grid-cols-4 gap-3.5">
                      {filteredFeed.map((item) => {
                        const isSelected = activeItem?.id === item.id;
                        return (
                          <div
                            key={item.id}
                            tabIndex={0}
                            role="button"
                            onClick={() => setActiveItem(item)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setActiveItem(item);
                              }
                            }}
                            className={cn(
                              "memory-card group flex cursor-pointer flex-col justify-between gap-2.5 rounded-xl border p-4 transition-[background-color,border-color,box-shadow,color,transform] duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 min-h-[170px] shadow-2xs",
                              isSelected && "ring-1 ring-primary"
                            )}
                            data-active={isSelected}
                          >
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="memory-card__initials inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-current/20 font-mono text-[10px] font-bold tracking-wider transition-colors" aria-hidden="true">
                                    {getItemInitials(item)}
                                  </span>
                                  <span className="memory-card__subtle inline-flex items-center rounded border border-current/20 px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors">
                                    {formatItemType(item.type)}
                                  </span>
                                  {item.state && item.state !== "UNKNOWN" && (
                                    <span className="inline-flex items-center rounded border border-border px-2 py-0.5 font-mono text-[10px] uppercase text-muted-foreground" title="Resolved from explicit canonical relations">
                                      {item.state}
                                    </span>
                                  )}
                                  {formatAuthority(item.authority) && (
                                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] text-muted-foreground" title={`Authority: ${item.authority}`}>
                                      {formatAuthority(item.authority)}
                                    </span>
                                  )}
                                  <span className="memory-card__subtle rounded px-2 py-0.5 text-[11px] font-semibold font-mono transition-colors">
                                    {item.project}
                                  </span>
                                  {item.commit_hash && (
                                    <span className="memory-card__muted font-mono text-[11px] font-semibold transition-colors">
                                      #{item.commit_hash}
                                    </span>
                                  )}
                                  {item.bullets && item.bullets.length > 0 && (
                                    <span className="memory-card__subtle inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded font-medium transition-colors">
                                      <Layers className="size-3" />
                                      {item.bullets.length} points
                                    </span>
                                  )}
                                </div>
                                <span className="memory-card__muted text-[11px] font-mono shrink-0 tabular-nums transition-colors">
                                  {formatDate(item.timestamp)}
                                </span>
                              </div>

                              <h3 className="font-heading text-sm sm:text-[15px] font-bold leading-snug transition-colors line-clamp-2">
                                {item.title}
                              </h3>

                              <p className="memory-card__muted text-xs line-clamp-3 leading-relaxed transition-colors">
                                {item.summary || item.rationale}
                              </p>
                            </div>

                            {item.tags && item.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1 pt-2 border-t memory-card__divider">
                                {item.tags.slice(0, 4).map((tg: string) => (
                                  <span
                                    key={tg}
                                    className="memory-card__subtle rounded border border-current/15 px-2 py-0.5 text-[10px] font-mono font-medium transition-colors"
                                  >
                                    #{tg}
                                  </span>
                                ))}
                                {item.tags.length > 4 && (
                                    <span className="memory-card__muted font-mono text-[10px] self-center transition-colors">
                                    +{item.tags.length - 4}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Relational Inspector */}
              {activeItem && (
                <RelationalInspector
                  item={activeItem}
                  onClose={() => setActiveItem(null)}
                  onSelectNeighbor={handleSelectNeighbor}
                />
              )}
            </div>
          )}
        </div>
      </SidebarInset>

      {/* Global Diff Viewer Modal */}
      {diffModalState.open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 sm:p-6 animate-in fade-in-0 duration-150 cursor-pointer"
          onClick={() => setDiffModalState({ open: false })}
          role="dialog"
          aria-modal="true"
          aria-label="Commit Diff Viewer"
        >
          <div
            className="relative w-full max-w-6xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <CodeDiffViewer
              project={diffModalState.project}
              commitHash={diffModalState.commitHash}
              itemId={diffModalState.itemId}
              isModal={true}
              onClose={() => setDiffModalState({ open: false })}
            />
          </div>
        </div>
      )}

      {/* Real-time Toast Notifications */}
      <NotificationToastContainer
        onInspectNotification={(item) => {
          if ("item_type" in item && "item_id" in item && item.item_type === "commit" && item.item_id) {
            setDiffModalState({
              open: true,
              project: item.project,
              itemId: item.item_id,
            });
          } else if ("item_id" in item && "item_type" in item && item.item_id) {
            handleSelectNeighbor(`${item.item_type}-${item.item_id}`, item.item_type as MemoryItemType);
            setViewMode("stream");
          }
        }}
      />

      {/* Global Command Palette */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={(item) => {
          setActiveItem(item);
          setViewMode("stream");
        }}
      />

      {/* Onboarding / Setup Guide Modal */}
      <OnboardingDialog
        open={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        isDemo={summary?.is_demo}
      />

      {/* Welcome Carousel Modal for Newly Imported Cloned Repo */}
      <WelcomeCarouselModal
        open={welcomeOpen}
        onClose={() => setWelcomeOpen(false)}
        onStartTour={() => startSpotlight(0)}
        repoName={summary?.projects?.[0] || "pitmry"}
        isDemo={summary?.is_demo}
      />

      {/* Interactive Spotlight Guided Tour */}
      <SpotlightTour
        active={spotlightActive}
        step={spotlightStep}
        onStepChange={setSpotlightStep}
        onComplete={closeSpotlight}
        onDismiss={closeSpotlight}
      />

      {/* Docked Floating Onboarding Checklist */}
      <OnboardingChecklistWidget
        tasks={tasks}
        onToggleTask={toggleTask}
        onTaskAction={(task) => {
          if (task.action_type === "view" && task.target_view) {
            setViewMode(task.target_view as ViewMode);
          } else if (task.action_type === "open_diff") {
            const firstCommit = feed.find((f) => f.type === "commit");
            setDiffModalState({
              open: true,
              project: firstCommit?.project || selectedProject || "pitmry",
              commitHash: firstCommit?.commit_hash,
              itemId: firstCommit?.id,
            });
            completeTask("task_inspect_diff");
          } else if (task.action_type === "open_palette") {
            setPaletteOpen(true);
            completeTask("task_palette_search");
          }
        }}
        onRestartTour={() => restartOnboarding()}
        onResetOnboarding={resetOnboarding}
        progressPct={progress.percentage}
        repoName={summary?.projects?.[0] || "pitmry"}
      />
    </SidebarProvider>
  );
}
