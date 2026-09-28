"use client";

/**
 * Dashboard sidebar.
 *
 * The "Views" group is generated from the view registry, so it can no longer
 * fall out of sync with the header switcher. The project / type / tag groups
 * are filter facets rather than navigation, so selecting one no longer forces
 * a jump to the stream view: the old sidebar called `setViewMode("stream")` on
 * every filter click, which meant you could not look at the graph with a
 * project filter applied.
 */

import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Folder01Icon,
  GitBranchIcon,
  HashtagIcon,
  MessageQuestionIcon,
  SearchList01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";
import type { MemorySummary, TagCount } from "@/lib/types";
import { VIEWS, type ViewMode } from "./view-registry";
import type { Filters } from "./use-dashboard-state";

export function DashboardSidebar({
  summary,
  view,
  onSelectView,
  filters,
  onToggleFacet,
  onClearFilters,
}: {
  summary: MemorySummary | null;
  view: ViewMode;
  onSelectView: (view: ViewMode) => void;
  filters: Filters;
  onToggleFacet: (key: "project" | "type" | "tag", value: string) => void;
  onClearFilters: () => void;
}) {
  const projectCounts = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const option of summary?.project_options ?? []) {
      if (typeof option.record_count === "number") {
        map.set(option.name, option.record_count);
      }
    }
    return map;
  }, [summary]);

  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border">
        <SidebarMenuButton
          tooltip="pitmry"
          className="gap-3 cursor-pointer"
          onClick={() => onSelectView("stream")}
        >
          <span
            aria-hidden="true"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10 font-mono text-[11px] font-bold text-primary"
          >
            p
          </span>
          <span className="font-semibold tracking-tight text-sidebar-foreground">pitmry</span>
        </SidebarMenuButton>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup data-tour="views-nav">
          <SidebarGroupLabel>Views</SidebarGroupLabel>
          <SidebarMenu>
            {VIEWS.map((definition) => {
              const Icon = definition.icon;
              return (
                <SidebarMenuItem key={definition.mode}>
                  <SidebarMenuButton
                    isActive={view === definition.mode}
                    onClick={() => onSelectView(definition.mode)}
                    tooltip={definition.title}
                  >
                    <Icon aria-hidden="true" className="size-4" />
                    <span>{definition.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={!filters.project}
                onClick={() => onToggleFacet("project", "")}
                tooltip="All projects"
              >
                <HugeiconsIcon icon={Folder01Icon} strokeWidth={1.5} />
                <span>All projects</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                  {summary?.stats?.total_records || 0}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {(summary?.projects ?? []).map((project: string) => (
              <SidebarMenuItem key={project}>
                <SidebarMenuButton
                  isActive={filters.project === project}
                  onClick={() => onToggleFacet("project", project)}
                  tooltip={project}
                >
                  <HugeiconsIcon icon={SearchList01Icon} strokeWidth={1.5} />
                  <span className="truncate">{project}</span>
                  <span
                    title="Canonical records in this project"
                    className="ml-auto font-mono text-[10px] text-muted-foreground"
                  >
                    {projectCounts.get(project) ?? ""}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Types</SidebarGroupLabel>
          <SidebarMenu>
            {(
              [
                { key: "adr", label: "Decisions", icon: Settings01Icon, count: summary?.stats?.total_adrs },
                { key: "commit", label: "Commits", icon: GitBranchIcon, count: summary?.stats?.total_commits },
                { key: "grill", label: "Discussions", icon: MessageQuestionIcon, count: summary?.stats?.total_grill },
              ] as const
            ).map((entry) => (
              <SidebarMenuItem key={entry.key}>
                <SidebarMenuButton
                  // The Commits view is the commit facet applied to the whole
                  // stream, so it counts as active while that view is open.
                  isActive={filters.type === entry.key || (view === "commits" && entry.key === "commit")}
                  onClick={() => onToggleFacet("type", entry.key)}
                  tooltip={entry.label}
                >
                  <HugeiconsIcon icon={entry.icon} strokeWidth={1.5} />
                  <span>{entry.label}</span>
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                    {entry.count || 0}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {(summary?.tags?.length ?? 0) > 0 ? (
          <SidebarGroup>
            <SidebarGroupLabel>Tags</SidebarGroupLabel>
            <SidebarMenu>
              {(summary?.tags ?? []).slice(0, 10).map((tag: TagCount) => (
                <SidebarMenuItem key={tag.tag}>
                  <SidebarMenuButton
                    isActive={filters.tag === tag.tag}
                    onClick={() => onToggleFacet("tag", tag.tag)}
                    tooltip={`#${tag.tag}`}
                  >
                    <HugeiconsIcon icon={HashtagIcon} strokeWidth={1.5} />
                    <span className="truncate">#{tag.tag}</span>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                      {tag.count}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={onClearFilters}
              tooltip="Clear every active filter"
              className="cursor-pointer text-muted-foreground hover:text-foreground"
              disabled={
                !filters.project && !filters.type && !filters.tag && !filters.query
              }
            >
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-primary" />
              <span className="truncate font-mono text-[10px] font-medium">
                {filters.project || filters.type || filters.tag
                  ? "Filtered view"
                  : "All records"}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
