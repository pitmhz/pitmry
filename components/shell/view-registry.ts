/**
 * View registry: the single source of truth for dashboard navigation.
 *
 * Before this, the sidebar and the header each hand-wrote their own list of
 * views. They had drifted: `graph` and `galaxy` were reachable only from the
 * header, `planning` only from the sidebar, and the two surfaces used
 * different words for the same destination ("Stream" vs "List", "Activity" vs
 * "Timeline", "Skills & Automations" vs "Skills"). Both surfaces now render
 * from this one array, so a view cannot become unreachable in one of them.
 */

import {
  Activity,
  Cpu,
  GitCompareArrows,
  LayoutDashboard,
  Layers,
  ListFilter,
  Server,
  Terminal,
  type LucideIcon,
} from "lucide-react";

export type ViewMode =
  | "briefing"
  | "stream"
  | "commits"
  | "deploys"
  | "activity"
  | "planning"
  | "skills"
  | "status"
  | "logs";

export type ViewDefinition = {
  mode: ViewMode;
  /** Short label for the header switcher and mobile select. */
  label: string;
  /** Full name for the sidebar and the page heading. */
  title: string;
  description: string;
  icon: LucideIcon;
  /** Primary destination: gets the most prominent placement. */
  primary: boolean;
  /** Which onboarding task this view completes when opened. */
  completesTask?: string;
};

export const VIEWS: ViewDefinition[] = [
  {
    mode: "briefing",
    label: "Briefing",
    title: "Project briefing",
    description:
      "Where this project stands, what needs attention, and what the records are made of.",
    icon: LayoutDashboard,
    primary: true,
  },
  {
    mode: "planning",
    label: "Intelligence",
    title: "Project Intelligence",
    description:
      "Accepted intent, planned work, readiness, verification, the knowledge map, and release readiness.",
    icon: Layers,
    primary: true,
    completesTask: "task_explore_graph",
  },
  {
    mode: "stream",
    label: "Records",
    title: "Record stream",
    description:
      "Every canonical record in capture order. The audit trail behind the briefing.",
    icon: ListFilter,
    primary: false,
  },
  {
    mode: "commits",
    label: "Commits",
    title: "Commits and diffs",
    description:
      "Every captured commit. Open one to read its full patch, side by side with the resulting file.",
    icon: GitCompareArrows,
    primary: false,
  },
  {
    mode: "deploys",
    label: "Deploys",
    title: "Deploy and commit history",
    description: "Browse captured Git changes. Deployment data appears only when recorded.",
    icon: Activity,
    primary: false,
  },
  {
    mode: "activity",
    label: "Activity",
    title: "Recent activity",
    description: "A timeline of canonical records and their recorded sources.",
    icon: Activity,
    primary: false,
  },
  {
    mode: "status",
    label: "Status",
    title: "Memory readiness",
    description: "Independent status for canonical records and rebuildable indexes.",
    icon: Server,
    primary: false,
  },
  {
    mode: "skills",
    label: "Skills",
    title: "Skills and automations",
    description: "Run offline workflows and automations.",
    icon: Cpu,
    primary: false,
  },
  {
    mode: "logs",
    label: "Logs",
    title: "System logs",
    description: "Inspect local service and runtime events.",
    icon: Terminal,
    primary: false,
  },
];

export const VIEW_BY_MODE: Record<ViewMode, ViewDefinition> = VIEWS.reduce(
  (accumulator, view) => {
    accumulator[view.mode] = view;
    return accumulator;
  },
  {} as Record<ViewMode, ViewDefinition>,
);

export const DEFAULT_VIEW: ViewMode = "briefing";

export function isViewMode(value: string | null | undefined): value is ViewMode {
  return value !== null && value !== undefined && value in VIEW_BY_MODE;
}
