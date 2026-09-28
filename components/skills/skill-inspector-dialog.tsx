"use client";

import { BookOpen, Check, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Overlay } from "@/components/shell/overlay";
import type { SkillsCatalog } from "./use-skills-catalog";

export function SkillInspectorDialog({ catalog }: { catalog: SkillsCatalog }) {
  const skill = catalog.inspectingSkill;

  return (
    <Overlay
      open={skill !== null}
      onClose={catalog.closeInspector}
      label={skill ? `Inspect ${skill.title}` : "Inspect skill"}
      size="lg"
      panelClassName="max-h-[85dvh]"
    >
      {skill ? (
        <div className="flex max-h-[85dvh] flex-col">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-secondary/30 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg border border-primary/20 bg-primary/10 p-2 text-primary">
                <BookOpen className="size-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">{skill.title}</h2>
                <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                  <span>{skill.name}</span>
                  <span aria-hidden="true">•</span>
                  <span className="capitalize">{skill.category}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div
                role="tablist"
                aria-label="Skill view"
                className="flex items-center gap-1 rounded-lg border border-border bg-secondary/60 p-0.5"
              >
                <Button
                  type="button"
                  role="tab"
                  aria-selected={!catalog.isEditingSkill}
                  variant={!catalog.isEditingSkill ? "odysseyui" : "ghost"}
                  size="xs"
                  onClick={() => catalog.setIsEditingSkill(false)}
                  className="h-7 text-xs"
                >
                  Preview
                </Button>
                <Button
                  type="button"
                  role="tab"
                  aria-selected={catalog.isEditingSkill}
                  variant={catalog.isEditingSkill ? "odysseyui" : "ghost"}
                  size="xs"
                  onClick={() => catalog.setIsEditingSkill(true)}
                  className="h-7 text-xs"
                >
                  Edit Source
                </Button>
              </div>

              {catalog.isEditingSkill ? (
                <Button
                  type="button"
                  variant="odysseyui"
                  size="xs"
                  onClick={() => void catalog.handleSaveSkill()}
                  disabled={catalog.savingSkill}
                  className="h-7 gap-1 font-semibold"
                >
                  <Save className="size-3.5" />
                  <span>{catalog.savingSkill ? "Saving..." : "Save"}</span>
                </Button>
              ) : null}
            </div>
          </header>

          {catalog.skillSaveSuccess ? (
            <div
              role="status"
              className="flex shrink-0 items-center gap-2 border-b border-success bg-success/10 px-6 py-2 text-xs font-medium text-success"
            >
              <Check className="size-4" aria-hidden="true" />
              <span>Skill updated successfully!</span>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {catalog.isEditingSkill ? (
              <label className="sr-only" htmlFor="skill-source">
                Skill source
              </label>
            ) : null}
            {catalog.isEditingSkill ? (
              <textarea
                id="skill-source"
                value={catalog.editingContent}
                onChange={(e) => catalog.setEditingContent(e.target.value)}
                className="h-full min-h-[400px] w-full resize-none rounded-lg border border-border/80 bg-muted/50 p-4 font-mono text-xs leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
                spellCheck={false}
              />
            ) : (
              <pre className="max-h-none whitespace-pre-wrap rounded-xl border border-border/80 bg-muted/40 p-4 font-mono text-xs leading-relaxed text-foreground">
                {catalog.skillContent || "No content found in SKILL.md"}
              </pre>
            )}
          </div>
        </div>
      ) : null}
    </Overlay>
  );
}
