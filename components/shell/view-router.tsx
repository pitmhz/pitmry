"use client";

/**
 * View router.
 *
 * Each view is code-split and only loaded when it is actually opened. The
 * previous router statically imported the diff viewer (912 lines), the skills
 * workspace (1192 lines) and the knowledge graph into the initial client
 * chunk, even though a user opening the dashboard almost never needs all of
 * them at once.
 */

import * as React from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const TimelinesDeploys = dynamic(
  () => import("@/components/timelines-deploys").then((module) => module.TimelinesDeploys),
  { loading: () => <ViewSkeleton label="Loading deploy history" /> },
);

const TimelinesStatusPage = dynamic(
  () => import("@/components/timelines-status-page").then((module) => module.TimelinesStatusPage),
  { loading: () => <ViewSkeleton label="Loading readiness checks" /> },
);

const TimelinesActivityFeed = dynamic(
  () => import("@/components/timelines-activity-feed").then((module) => module.TimelinesActivityFeed),
  { loading: () => <ViewSkeleton label="Loading activity" /> },
);

const SkillsWorkspace = dynamic(
  () => import("@/components/skills-workspace").then((module) => module.SkillsWorkspace),
  { loading: () => <ViewSkeleton label="Loading skills workspace" /> },
);

const TableLogs = dynamic(
  () => import("@/components/table-logs").then((module) => module.TableLogs),
  { loading: () => <ViewSkeleton label="Loading server logs" /> },
);

const ProjectIntelligenceConsole = dynamic(
  () =>
    import("@/components/console/project-intelligence-console").then(
      (module) => module.ProjectIntelligenceConsole,
    ),
  { loading: () => <ViewSkeleton label="Loading Project Intelligence console" /> },
);

export function ViewSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex-1 space-y-3 p-6">
      <Skeleton className="h-6 w-56" />
      <Skeleton className="h-3 w-80" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Scrolling page frame for the views that scroll their own body. */
export function ScrollView({ children }: { children: React.ReactNode }) {
  return <div className="h-full flex-1 overflow-y-auto">{children}</div>;
}

export const LazyViews = {
  TimelinesDeploys,
  TimelinesStatusPage,
  TimelinesActivityFeed,
  SkillsWorkspace,
  TableLogs,
  ProjectIntelligenceConsole,
};
