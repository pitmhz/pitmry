"use client";

/**
 * Schema navigator.
 *
 * The left rail of the console, modelled on a database connector's object
 * browser. It lists what the project actually contains, grouped by record kind
 * with live counts, and every group expands and collapses.
 *
 * Counts come straight from the payload. A group with zero records is not
 * shown, because an empty browser entry that leads nowhere is worse than
 * silence.
 */

import * as React from "react";
import { ChevronRight, FolderTree, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildPiGraph, groupPiNodes, kindLabel, type PiGroup, type PiNode } from "@/lib/pi-graph";
import type { ProjectContext } from "@/lib/pi-types";
import { RecordId } from "./primitives";

function GroupRow({
  group,
  selectedId,
  onSelect,
}: {
  group: PiGroup;
  selectedId: string | null;
  onSelect: (node: PiNode) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const panelId = React.useId();

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-90",
            "motion-reduce:transition-none",
          )}
        />
        <span className="min-w-0 flex-1 truncate">{kindLabel(group.kind)}</span>
        <span className="shrink-0 font-mono text-[0.6875rem] text-muted-foreground">{group.count}</span>
      </button>
      <ul id={panelId} hidden={!open} className="ml-4 border-l border-border/70 pl-2">
        {group.nodes.map((node) => (
          <li key={node.id}>
            <button
              type="button"
              onClick={() => onSelect(node)}
              aria-pressed={selectedId === node.id}
              title={node.detail ? `${node.label} (${node.detail})` : node.label}
              className={cn(
                "block w-full rounded px-2 py-1.5 text-left text-xs transition-colors",
                "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selectedId === node.id
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground",
              )}
            >
              <span className="block truncate">{node.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </li>
  );
}

export function SchemaNavigator({
  project,
  selectedId,
  onSelect,
  onRefresh,
  refreshing,
  className,
}: {
  project: ProjectContext;
  selectedId: string | null;
  onSelect: (node: PiNode) => void;
  onRefresh: () => void;
  refreshing: boolean;
  className?: string;
}) {
  const groups = React.useMemo(
    () => groupPiNodes(buildPiGraph(project)),
    [project],
  );

  return (
    <nav
      aria-label="Project records"
      className={cn("flex h-full min-h-0 flex-col", className)}
    >
      <div className="flex items-start justify-between gap-2 border-b border-border/60 px-3 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{project.project_name}</p>
          <RecordId id={project.project_id} className="mt-0.5 block" />
        </div>
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Reload project records"
          className="shrink-0 rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RefreshCw aria-hidden="true" className={cn("size-4", refreshing && "animate-spin motion-reduce:animate-none")} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {groups.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs leading-relaxed text-muted-foreground">
            This project has no Project Intelligence records yet.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {groups.map((group) => (
              <GroupRow
                key={group.kind}
                group={group}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-border/60 px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
          <FolderTree aria-hidden="true" className="size-3" />
          {project.work_units.length} work unit{project.work_units.length === 1 ? "" : "s"},{" "}
          {project.requirements.length} requirement{project.requirements.length === 1 ? "" : "s"}
        </p>
      </div>
    </nav>
  );
}
