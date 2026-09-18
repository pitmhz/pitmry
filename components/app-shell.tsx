"use client";

import React, { useEffect, useState } from "react";
import {
  Search,
  Network,
  ListFilter,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { StatTile } from "@/components/stat-tile";
import { RelationalInspector } from "@/components/relational-inspector";
import { KnowledgeGraph } from "@/components/knowledge-graph";
import { GalaxyView } from "@/components/galaxy-view";
import { DesignTokenController } from "@/components/design-token-controller";
import { CommandPalette } from "@/components/command-palette";
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
import { Separator } from "@/components/ui/separator";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardSquare01Icon,
  GitBranchIcon,
  MessageQuestionIcon,
  Settings01Icon,
  ComputerTerminalIcon,
  HashtagIcon,
  Folder01Icon,
  SearchList01Icon,
} from "@hugeicons/core-free-icons";

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
}: {
  summary: any;
  selectedProject: string | null;
  setSelectedProject: (p: string | null) => void;
  selectedType: string | null;
  setSelectedType: (t: string | null) => void;
  selectedTag: string | null;
  setSelectedTag: (g: string | null) => void;
}) {
  return (
    <Sidebar collapsible="icon" variant="floating">
      {/* Brand */}
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border">
        <SidebarMenuButton tooltip="Memory Dashboard" className="gap-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 border border-primary/20 font-mono text-[11px] font-bold text-primary">
            M
          </div>
          <span className="font-semibold tracking-tight text-sidebar-foreground">
            Memory
          </span>
        </SidebarMenuButton>
      </SidebarHeader>

      <SidebarContent>
        {/* Projects */}
        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={selectedProject === null && selectedType === null && selectedTag === null}
                onClick={() => {
                  setSelectedProject(null);
                  setSelectedType(null);
                  setSelectedTag(null);
                }}
                tooltip="All items"
              >
                <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={1.5} />
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
                  onClick={() => setSelectedProject(selectedProject === proj ? null : proj)}
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
                onClick={() => setSelectedType(selectedType === "adr" ? null : "adr")}
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
                onClick={() => setSelectedType(selectedType === "commit" ? null : "commit")}
                tooltip="Commits"
              >
                <HugeiconsIcon icon={GitBranchIcon} strokeWidth={1.5} />
                <span>Commits</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                  {summary?.stats?.total_commits || 0}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={selectedType === "grill"}
                onClick={() => setSelectedType(selectedType === "grill" ? null : "grill")}
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
              {summary.tags.slice(0, 12).map((t: any) => (
                <SidebarMenuItem key={t.tag}>
                  <SidebarMenuButton
                    isActive={selectedTag === t.tag}
                    onClick={() => setSelectedTag(selectedTag === t.tag ? null : t.tag)}
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
            <SidebarMenuButton tooltip="localhost:4242" className="text-muted-foreground">
              <HugeiconsIcon icon={ComputerTerminalIcon} strokeWidth={1.5} />
              <span className="font-mono text-[10px]">localhost:4242</span>
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
  const [viewMode, setViewMode] = useState<"stream" | "graph" | "galaxy">("stream");
  const [activeItem, setActiveItem] = useState<any | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

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
  }, []);

  useEffect(() => {
    fetchFeed();
  }, [selectedProject, selectedType, selectedTag]);

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
      />

      {/* Main Content Inset */}
      <SidebarInset className="flex flex-col overflow-hidden h-screen">
        {/* Top Navbar */}
        <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border/70 px-3 bg-background/80 backdrop-blur">
          {/* Sidebar toggle + search */}
          <div className="flex items-center gap-2">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
            <Separator orientation="vertical" className="h-4 opacity-40" />
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-border/70 bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground w-64"
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span>Search memory...</span>
              <kbd className="ml-auto rounded border border-border bg-secondary px-1.5 text-[10px] font-mono text-muted-foreground">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* View Switcher & Controls */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center rounded-md border border-border/70 bg-secondary/40 p-0.5 text-xs">
              <button
                onClick={() => setViewMode("stream")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-2 py-0.5 font-medium transition-colors text-xs",
                  viewMode === "stream"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ListFilter className="h-3.5 w-3.5" />
                List
              </button>
              <button
                onClick={() => setViewMode("graph")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-2 py-0.5 font-medium transition-colors text-xs",
                  viewMode === "graph"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Network className="h-3.5 w-3.5" />
                Graph
              </button>
              <button
                onClick={() => setViewMode("galaxy")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-2 py-0.5 font-medium transition-colors text-xs",
                  viewMode === "galaxy"
                    ? "bg-card text-primary shadow-xs font-semibold border border-primary/30"
                    : "text-muted-foreground hover:text-primary"
                )}
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                3D
              </button>
            </div>

            <DesignTokenController />

            <button
              onClick={() => {
                fetchSummary();
                fetchFeed();
              }}
              className="rounded-md border border-border/70 bg-secondary/40 p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              title="Refresh"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </button>
          </div>
        </header>

        {/* Body: Feed + Inspector */}
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
          ) : (
            /* List / Stream view */
            <div className="flex flex-1 overflow-hidden">
              {/* Feed column */}
              <div className="flex flex-1 flex-col overflow-y-auto p-3.5 sm:p-4 space-y-3.5">
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
                    onClick={() => setViewMode("galaxy")}
                  />
                </div>

                {/* Activity Feed */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Recent activity ({feed.length})
                    </div>
                    {(selectedProject || selectedType || selectedTag) && (
                      <button
                        onClick={() => {
                          setSelectedProject(null);
                          setSelectedType(null);
                          setSelectedTag(null);
                        }}
                        className="text-xs text-primary hover:underline font-medium"
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
                    <div className="space-y-1.5">
                      {feed.map((item) => {
                        const isSelected = activeItem?.id === item.id;
                        return (
                          <div
                            key={item.id}
                            onClick={() => setActiveItem(item)}
                            className={cn(
                              "group flex cursor-pointer flex-col gap-1.5 rounded-lg border p-3 transition-all duration-150",
                              isSelected
                                ? "border-primary/50 bg-secondary/30 ring-1 ring-primary/40 shadow-xs"
                                : "border-border/70 bg-card hover:border-primary/30 hover:bg-secondary/20"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center rounded border border-border/80 bg-secondary/80 px-1.5 py-0.2 font-mono text-[9px] font-semibold uppercase tracking-wider text-foreground">
                                  {formatItemType(item.type)}
                                </span>
                                <span className="rounded bg-secondary/60 px-1.5 py-0.2 text-[9px] font-medium text-muted-foreground">
                                  {item.project}
                                </span>
                                {item.commit_hash && (
                                  <span className="font-mono text-[9px] text-muted-foreground">
                                    #{item.commit_hash}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                                {formatDate(item.timestamp)}
                              </span>
                            </div>

                            <div className="text-xs font-semibold text-foreground group-hover:text-primary leading-snug transition-colors">
                              {item.title}
                            </div>

                            <div className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                              {item.summary || item.rationale}
                            </div>

                            {item.tags && item.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {item.tags.slice(0, 5).map((tg: string) => (
                                  <span
                                    key={tg}
                                    className="rounded bg-secondary/40 px-1.5 py-0.2 text-[9px] text-muted-foreground font-mono"
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

      {/* Global Command Palette */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={(item) => {
          setActiveItem(item);
          setViewMode("stream");
        }}
      />
    </SidebarProvider>
  );
}
