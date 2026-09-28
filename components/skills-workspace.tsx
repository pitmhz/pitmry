"use client";

/**
 * Skills & Automations Hub.
 *
 * The shell owns only the tab selection and the header. Each feature — the
 * skills catalog, the Python automation studio, the machine path
 * configuration — owns its own state through a hook, so switching tabs cannot
 * reset an in-progress edit, and the two dialogs read from the same catalog
 * hook the tab renders from.
 */

import * as React from "react";
import { BookOpen, Blocks, Code2, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSkillsCatalog } from "./skills/use-skills-catalog";
import { useAutomations } from "./skills/use-automations";
import { SkillsCatalogTab } from "./skills/skills-catalog-tab";
import { AutomationsStudioTab } from "./skills/automations-studio-tab";
import { MachineConfigTab } from "./skills/machine-config-tab";
import { CreateSkillDialog } from "./skills/create-skill-dialog";
import { SkillInspectorDialog } from "./skills/skill-inspector-dialog";

type HubTab = "skills" | "automations" | "machine";

const TABS: {
  id: HubTab;
  label: string;
  icon: typeof BookOpen;
  count?: (catalog: ReturnType<typeof useSkillsCatalog>, automations: ReturnType<typeof useAutomations>) => number;
}[] = [
  { id: "skills", label: "Skills Catalog", icon: BookOpen, count: (c) => c.skillsCount },
  { id: "automations", label: "Python Studio", icon: Code2, count: (c, a) => a.scriptsCount },
  { id: "machine", label: "Machine Config", icon: Cpu },
];

export function SkillsWorkspace() {
  const [activeTab, setActiveTab] = React.useState<HubTab>("skills");
  const catalog = useSkillsCatalog();
  const automations = useAutomations();

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-background">
      <header className="border-b border-border/80 bg-card/60 px-6 py-4 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg border border-border/80 bg-secondary text-foreground">
                <Blocks className="size-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <h1 className="font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Skills &amp; Automations Hub
              </h1>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Manage custom agent skills, execute Python automations, and configure machine runtime
              paths.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Hub tabs"
            className="flex items-center gap-1 rounded-xl border border-border/80 bg-secondary/50 p-1 text-xs"
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const selected = activeTab === tab.id;
              const count = tab.count?.(catalog, automations);
              return (
                <Button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  variant={selected ? "odysseyui" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab(tab.id)}
                  className="h-8 gap-1.5 text-xs font-semibold"
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                  <span>{tab.label}</span>
                  {count !== undefined ? (
                    <span
                      className="rounded-full border border-border bg-secondary px-1.5 py-0.2 font-mono text-[10px] font-semibold text-muted-foreground"
                      aria-label={`${count} items`}
                    >
                      {count}
                    </span>
                  ) : null}
                </Button>
              );
            })}
          </div>
        </div>
      </header>

      <div
        role="tabpanel"
        id={`hub-panel-${activeTab}`}
        aria-label={`${TABS.find((tab) => tab.id === activeTab)?.label} panel`}
        className="p-6"
      >
        {activeTab === "skills" ? <SkillsCatalogTab catalog={catalog} /> : null}
        {activeTab === "automations" ? <AutomationsStudioTab automations={automations} /> : null}
        {activeTab === "machine" ? <MachineConfigTab catalog={catalog} /> : null}
      </div>

      <CreateSkillDialog catalog={catalog} />
      <SkillInspectorDialog catalog={catalog} />
    </div>
  );
}
