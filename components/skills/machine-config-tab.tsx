"use client";

import { Cpu, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { SkillsCatalog } from "./use-skills-catalog";

/**
 * The path-resolution ladder, in priority order.
 *
 * Declared as data so the ordering claim is one list rather than three
 * hand-ordered blocks that can drift apart.
 */
const RESOLUTION_ORDER = [
  {
    id: "AGENTS_SKILLS_PATH",
    label: "Environment Variable",
    code: "AGENTS_SKILLS_PATH",
    detail: "Overrides all defaults when set. Standard across custom agent launchers.",
    badge: "Highest Priority",
    badgeClass: "border-primary/20 bg-primary/10 text-primary",
  },
  {
    id: "project-local",
    label: "Project-Local Directory",
    code: "./.agents/skills",
    detail:
      "Isolated repository-specific skills. Recommended for project-only specialized automations.",
    badge: "Project Scope",
    badgeClass: "border-border bg-secondary text-muted-foreground",
  },
  {
    id: "global",
    label: "User Global Catalog",
    code: "~/.agents/skills",
    detail: "Standard machine-wide directory recognized by Claude Code, Zed, and Antigravity.",
    badge: "Active Default",
    badgeClass: "border-success bg-success/10 text-success",
  },
] as const;

export function MachineConfigTab({ catalog }: { catalog: SkillsCatalog }) {
  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-5 rounded-xl border border-border/80 bg-card p-6">
        <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
          <Cpu className="size-4 text-primary" aria-hidden="true" />
          <span>Agent Skills Path Resolution</span>
        </h2>

        <ol className="space-y-3 text-xs">
          {RESOLUTION_ORDER.map((entry, index) => (
            <li
              key={entry.id}
              className="flex items-start justify-between gap-4 rounded-lg border border-border/60 bg-secondary/20 p-3.5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="font-semibold text-foreground">
                    {entry.label}: <code className="font-mono">{entry.code}</code>
                  </span>
                </div>
                <p className="mt-0.5 text-muted-foreground">{entry.detail}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase",
                  entry.badgeClass,
                )}
              >
                {entry.badge}
              </span>
            </li>
          ))}
        </ol>

        <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-4">
          <div>
            <div className="text-xs font-semibold text-foreground">Sync Bundled Starter Skills</div>
            <p className="text-[11px] text-muted-foreground">
              Injects <code className="font-mono">strategic-memory</code>,{" "}
              <code className="font-mono">memory-navigator</code>, and core skills into your active
              directory.
            </p>
          </div>
          <Button
            variant="odysseyui"
            size="sm"
            onClick={() => void catalog.handleSyncStarterSkills()}
            disabled={catalog.syncingSkills}
            className="shrink-0 gap-1.5"
          >
            <RefreshCw
              className={cn("size-3.5", catalog.syncingSkills && "animate-spin")}
              aria-hidden="true"
            />
            <span>{catalog.syncingSkills ? "Syncing..." : "Sync Starter Skills"}</span>
          </Button>
        </div>

        {catalog.syncMessage ? (
          <div
            role="status"
            className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs font-medium text-primary"
          >
            {catalog.syncMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
}
