"use client";

import { ChevronRight, Folder, Plus, RefreshCw, Search, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { SkillsCatalog } from "./use-skills-catalog";

export function SkillsCatalogTab({ catalog }: { catalog: SkillsCatalog }) {
  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search
              className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="text"
              value={catalog.searchQuery}
              onChange={(e) => catalog.setSearchQuery(e.target.value)}
              placeholder="Search skills or keywords..."
              className="h-9 w-64 sm:w-80 rounded-lg border border-border/80 bg-secondary/30 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {catalog.categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => catalog.setSelectedCategory(category)}
                aria-pressed={catalog.selectedCategory === category}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer",
                  catalog.selectedCategory === category
                    ? "border-primary/50 bg-primary/10 text-primary font-bold"
                    : "border-border/60 bg-secondary/30 text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <Button
          variant="odysseyui"
          size="sm"
          onClick={() => catalog.setCreateModalOpen(true)}
          className="gap-1.5"
        >
          <Plus className="size-3.5" />
          <span>Create Custom Skill</span>
        </Button>
      </div>

      {/* Path Banner */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-secondary/20 px-4 py-2.5 text-xs text-muted-foreground">
        <div className="flex min-w-0 items-center gap-2 truncate">
          <Folder className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>Active Skills Directory:</span>
          <code className="truncate font-mono font-semibold text-foreground">
            {catalog.activePath || "~/.agents/skills"}
          </code>
          <span className="rounded border border-border/80 bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-muted-foreground">
            {catalog.scope}
          </span>
        </div>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => void catalog.fetchSkills()}
          className="h-7 shrink-0 gap-1 font-medium text-primary hover:text-primary"
        >
          <RefreshCw className="size-3" /> Refresh
        </Button>
      </div>

      {/* Skills Grid */}
      {catalog.skillsLoading ? (
        <div className="grid grid-cols-1 gap-4 animate-pulse md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-40 rounded-xl border border-border/60 bg-secondary/20" />
          ))}
        </div>
      ) : catalog.filteredSkills.length === 0 ? (
        <div className="space-y-3 rounded-xl border border-border/70 bg-card p-12 text-center">
          <SearchX className="mx-auto size-8 text-muted-foreground/40" aria-hidden="true" />
          <div className="text-sm font-semibold text-foreground">No skills match your filter</div>
          <p className="mx-auto max-w-md text-xs text-muted-foreground">
            Try clearing your search or create a new custom skill for your workflow.
          </p>
          <Button variant="outline" size="sm" onClick={catalog.resetFilters}>
            Reset filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {catalog.filteredSkills.map((skill) => {
            const isActive = skill.source === "active";
            return (
              <div
                key={skill.name}
                className="group relative flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 transition-all duration-150 hover:border-primary/50 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider",
                        isActive
                          ? "border border-success bg-success/10 text-success"
                          : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {skill.category}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {skill.source}
                    </span>
                  </div>

                  <h3 className="mt-2.5 flex items-center gap-1.5 text-sm font-bold text-foreground transition-colors group-hover:text-primary">
                    {skill.title || skill.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {skill.description || "No description provided."}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {skill.file_count} file(s)
                  </span>
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => void catalog.handleInspectSkill(skill)}
                    className="gap-1 font-semibold"
                  >
                    <span>Inspect &amp; Edit</span>
                    <ChevronRight className="size-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
