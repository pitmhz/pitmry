"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Search,
  Network,
  ListFilter,
  Sparkles,
  RefreshCw,
  Bell,
  Activity,
  Server,
  GitBranch,
  Layers,
  Code2,
} from "lucide-react";
import { StatTile } from "@/components/stat-tile";
import { RelationalInspector } from "@/components/relational-inspector";
import { KnowledgeGraph } from "@/components/knowledge-graph";
import { GalaxyView } from "@/components/galaxy-view";
import { DesignTokenController } from "@/components/design-token-controller";
import { CommandPalette } from "@/components/command-palette";
import { TimelinesStatusPage } from "@/components/timelines-status-page";
import { TimelinesDeploys } from "@/components/timelines-deploys";
import { TimelinesActivityFeed } from "@/components/timelines-activity-feed";
import { TimelinesNotifications, NotificationItem } from "@/components/timelines-notifications";
import { NotificationToastContainer } from "@/components/notification-toast";
import { CodeDiffViewer } from "@/components/code-diff-viewer";
import { OnboardingDialog } from "@/components/onboarding-dialog";
import { SkillsWorkspace } from "@/components/skills-workspace";
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
  | "skills";

function formatItemType(type?: string): string {
  switch (type) {
    case "adr":
      return "Decision";
    case "commit":
      return "Commit";
    case "grill":
      return "Discussion";
    default:
      return type || "Item";
  }
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
  summary: any;
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
        <SidebarGroup>
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
                <Sparkles className="size-4 text-primary" />
                <span>Skills &amp; Automations</span>
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
        {summary?.tags?.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Tags</SidebarGroupLabel>
            <SidebarMenu>
              {summary.tags.slice(0, 10).map((t: any) => (
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
          <SidebarMenuItem>
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
  const [summary, setSummary] = useState<any>(null);
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("stream");
  const [activeItem, setActiveItem] = useState<any | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [diffModalState, setDiffModalState] = useState<{
    open: boolean;
    project?: string;
    commitHash?: string;
    itemId?: number;
  }>({ open: false });

  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);

  const fetchSummary = () => {
    fetch("/api/memory?action=summary")
      .then((res) => res.json())
      .then((data) => setSummary(data))
      .catch((err) => console.error(err));
  };

  const fetchFeed = () => {
    setLoading(true);
    let url = "/api/memory?action=feed&limit=60";
    if (selectedProject) url += `&project=${encodeURIComponent(selectedProject)}`;
    if (selectedType) url += `&type=${encodeURIComponent(selectedType)}`;
    if (selectedTag) url += `&tag=${encodeURIComponent(selectedTag)}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        const items = Array.isArray(data) ? data : [];
        setFeed(items);
        setLoading(false);
        if (items.length > 0 && !activeItem) {
          setActiveItem(items[0]);
        }
      })
      .catch((err) => {
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
    fetchFeed();
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
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [diffModalState.open, onboardingOpen, notifOpen]);

  const handleSelectNeighbor = (id: string, type: "adr" | "commit" | "grill") => {
    const numId = parseInt(id.split("-")[1]);
    fetch(`/api/memory?action=feed&type=${type}&limit=60`)
      .then((res) => res.json())
      .then((data) => {
        const found = data.find((it: any) => it.id === id || it.numeric_id === numId);
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
                {viewMode === "stream" ? (selectedProject || "all-projects") : viewMode}
              </span>
              {selectedType && viewMode === "stream" && (
                <>
                  <span>/</span>
                  <span className="text-muted-foreground capitalize">{selectedType}</span>
                </>
              )}
            </div>
            <Separator orientation="vertical" className="h-4 opacity-40 hidden sm:block" />
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-border/70 bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground w-40 sm:w-48 lg:w-60 cursor-pointer"
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Search memory...</span>
              <kbd className="ml-auto rounded border border-border bg-secondary px-1.5 text-[10px] font-mono text-muted-foreground">
                ⌘K
              </kbd>
            </button>
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
                onClick={() => setViewMode("graph")}
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

              <button
                onClick={() => setViewMode("galaxy")}
                className={cn(
                  "flex items-center gap-1 rounded px-2 py-0.5 font-medium transition-colors text-xs cursor-pointer",
                  viewMode === "galaxy"
                    ? "bg-card text-primary shadow-xs font-semibold border border-primary/30"
                    : "text-muted-foreground hover:text-primary"
                )}
                title="3D vector galaxy"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="hidden md:inline">3D</span>
              </button>

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
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="hidden md:inline">Skills</span>
              </button>
            </div>

            {/* Notification Bell with Popover */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative rounded-md border border-border/70 bg-secondary/40 p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
                title="Notifications"
              >
                <Bell className="h-3.5 w-3.5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground shadow-xs animate-in zoom-in">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

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

            {summary?.is_demo && (
              <button
                onClick={() => setOnboardingOpen(true)}
                className="flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                title="Connect real repositories & vector memory"
              >
                <Sparkles className="h-3 w-3" />
                <span>Setup</span>
              </button>
            )}

            <button
              onClick={() => {
                fetchSummary();
                fetchFeed();
              }}
              className="rounded-md border border-border/70 bg-secondary/40 p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </button>
          </div>
        </header>

        {/* Demo Mode Notice Banner */}
        {summary?.is_demo && !bannerDismissed && (
          <div className="flex items-center justify-between border-b border-primary/25 bg-primary/10 px-4 py-1.5 text-xs backdrop-blur shrink-0 animate-in fade-in-0 duration-150">
            <div className="flex items-center gap-2 text-foreground">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <span>
                <strong className="font-semibold text-primary">Demo Mode:</strong> You are exploring built-in sample memory. Run <code className="font-mono bg-black/40 px-1.5 py-0.5 rounded text-primary text-[11px]">pnpm setup</code> to connect your local repositories & vector engine.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setOnboardingOpen(true)}
                className="rounded border border-primary/50 bg-primary/20 px-2.5 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/30 transition-colors cursor-pointer"
              >
                Setup Guide
              </button>
              <button
                onClick={() => setBannerDismissed(true)}
                className="text-muted-foreground hover:text-foreground px-1.5 py-0.5 text-xs transition-colors cursor-pointer"
                title="Dismiss notice"
              >
                ✕
              </button>
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
                    handleSelectNeighbor(`${type}-${id}`, type);
                    setViewMode("stream");
                  }
                }}
              />
            </div>
          ) : (
            /* Standard List / Stream View */
            <div className="flex flex-1 overflow-hidden">
              {/* Feed column */}
              <div className="flex flex-1 flex-col overflow-y-auto p-3.5 sm:p-5 space-y-4">
                {/* View Header (H1) */}
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 border-b border-border/50 pb-3">
                  <div>
                    <h1 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                      Operational Memory Stream
                    </h1>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Unified architectural decision records, semantic git digests, and discussions.
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

                {/* Activity Feed */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-heading text-sm sm:text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                      <span>Recent Activity</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground">
                        {feed.length}
                      </span>
                    </h2>
                    {(selectedProject || selectedType || selectedTag) && (
                      <button
                        onClick={() => {
                          setSelectedProject(null);
                          setSelectedType(null);
                          setSelectedTag(null);
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
                  ) : feed.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                      No items match your filter.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {feed.map((item) => {
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
                              "group flex cursor-pointer flex-col gap-2 rounded-xl border p-3.5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                              isSelected
                                ? "border-primary/50 bg-secondary/35 ring-1 ring-primary/40 shadow-xs"
                                : "border-border/70 bg-card hover:border-primary/40 hover:bg-secondary/20 shadow-2xs"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center rounded border border-border/80 bg-secondary px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-foreground">
                                  {formatItemType(item.type)}
                                </span>
                                <span className="rounded bg-secondary/80 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                  {item.project}
                                </span>
                                {item.commit_hash && (
                                  <span className="font-mono text-[11px] text-muted-foreground">
                                    #{item.commit_hash}
                                  </span>
                                )}
                                {item.bullets && item.bullets.length > 0 && (
                                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-primary bg-primary/10 px-2 py-0.5 rounded font-semibold">
                                    <Sparkles className="size-3" />
                                    {item.bullets.length} points
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                                {formatDate(item.timestamp)}
                              </span>
                            </div>

                            <h3 className="font-heading text-sm sm:text-[15px] font-bold text-foreground group-hover:text-primary leading-snug transition-colors">
                              {item.title}
                            </h3>

                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                              {item.summary || item.rationale}
                            </p>

                            {item.tags && item.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {item.tags.slice(0, 5).map((tg: string) => (
                                  <span
                                    key={tg}
                                    className="rounded bg-secondary/60 px-2 py-0.5 text-[11px] text-muted-foreground font-mono font-medium"
                                  >
                                    #{tg}
                                  </span>
                                ))}
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
    </SidebarProvider>
  );
}
