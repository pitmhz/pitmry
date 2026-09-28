"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Overlay } from "@/components/shell/overlay";
import type { SkillsCatalog } from "./use-skills-catalog";

const CATEGORIES = ["Workflow", "Memory", "Coding", "Testing", "Automation"] as const;

export function CreateSkillDialog({ catalog }: { catalog: SkillsCatalog }) {
  return (
    <Overlay
      open={catalog.createModalOpen}
      onClose={catalog.closeCreateDialog}
      label="Create Custom Skill"
      size="sm"
    >
      <form onSubmit={catalog.handleCreateSkill} className="space-y-4 p-6 text-xs">
        {catalog.createError ? (
          <div
            role="alert"
            className="rounded-lg border border-danger bg-danger/8 p-3 text-xs text-danger"
          >
            {catalog.createError}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="skill-title" className="text-[11px] font-semibold text-foreground">
              Skill Title
            </label>
            <input
              id="skill-title"
              type="text"
              required
              value={catalog.newSkillTitle}
              onChange={(e) => {
                catalog.setNewSkillTitle(e.target.value);
                // The slug is derived from the title only while it is untouched,
                // so a user who typed an explicit identifier keeps it.
                if (!catalog.newSkillName) {
                  catalog.setNewSkillName(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                }
              }}
              placeholder="e.g. Git Release Automator"
              className="mt-1.5 h-9 w-full rounded-lg border border-border bg-secondary/30 px-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label htmlFor="skill-slug" className="text-[11px] font-semibold text-foreground">
              Identifier (slug)
            </label>
            <input
              id="skill-slug"
              type="text"
              required
              value={catalog.newSkillName}
              onChange={(e) =>
                catalog.setNewSkillName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-"))
              }
              placeholder="e.g. git-release"
              className="mt-1.5 h-9 w-full rounded-lg border border-border bg-secondary/30 px-3 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div>
          <label htmlFor="skill-category" className="text-[11px] font-semibold text-foreground">
            Category
          </label>
          <select
            id="skill-category"
            value={catalog.newSkillCategory}
            onChange={(e) => catalog.setNewSkillCategory(e.target.value)}
            className="mt-1.5 h-9 w-full rounded-lg border border-border bg-secondary/30 px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="skill-description" className="text-[11px] font-semibold text-foreground">
            Description
          </label>
          <textarea
            id="skill-description"
            rows={3}
            value={catalog.newSkillDesc}
            onChange={(e) => catalog.setNewSkillDesc(e.target.value)}
            placeholder="Brief summary of when and how the agent should invoke this skill..."
            className="mt-1.5 w-full rounded-lg border border-border bg-secondary/30 p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <fieldset>
          <legend className="text-[11px] font-semibold text-foreground">Template</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {(
              [
                { id: "blank", title: "Blank Skill", hint: "SKILL.md only" },
                { id: "automation", title: "Python Automation", hint: "Bundles scripts/run.py helper" },
              ] as const
            ).map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => catalog.setNewSkillTemplate(template.id)}
                aria-pressed={catalog.newSkillTemplate === template.id}
                className={cn(
                  "cursor-pointer rounded-lg border p-2.5 text-left transition-colors",
                  catalog.newSkillTemplate === template.id
                    ? "border-primary bg-primary/10 font-semibold text-primary"
                    : "border-border bg-secondary/20 text-muted-foreground",
                )}
              >
                <div className="text-xs font-bold">{template.title}</div>
                <div className="mt-0.5 text-[10px]">{template.hint}</div>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex justify-end gap-2 border-t border-border/80 pt-4">
          <Button type="button" variant="outline" size="sm" onClick={catalog.closeCreateDialog}>
            Cancel
          </Button>
          <Button type="submit" variant="odysseyui" size="sm" disabled={catalog.creatingSkill}>
            {catalog.creatingSkill ? "Creating..." : "Create Skill"}
          </Button>
        </div>
      </form>
    </Overlay>
  );
}
