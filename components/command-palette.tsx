"use client";

import React, { useEffect, useState, useRef } from "react";
import { Search, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MemoryItem } from "@/lib/types";
import { formatItemType } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelect: (item: MemoryItem) => void;
}

function formatIndexedAt(value?: number | string): string | null {
  const timestamp = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "indexed now";
  if (minutes < 60) return `indexed ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `indexed ${hours}h ago`;
  return `indexed ${Math.floor(hours / 24)}d ago`;
}

export function CommandPalette({ open, onClose, onSelect }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  // Roving highlight index. The list is a single tab stop with
  // aria-activedescendant, so arrow keys move the selection without the focus
  // leaving the input. Previously the rows were bare <div onClick>: a keyboard
  // user could type a query and then reach no result at all.
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) onClose();
      }
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      // Deferring both the focus and the index reset keeps them out of the
      // effect's synchronous body, so opening the palette does not trigger a
      // cascading render before it has painted.
      const timer = window.setTimeout(() => {
        inputRef.current?.focus();
        setActiveIndex(0);
      }, 50);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      setQuery("");
      setResults([]);
    }, 0);
    // Return focus to whatever opened the palette, so keyboard users are not
    // dropped at the top of the document.
    previouslyFocused.current?.focus?.();
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      const timer = window.setTimeout(() => setResults([]), 0);
      return () => window.clearTimeout(timer);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/memory?action=feed&query=${encodeURIComponent(query)}&limit=8`, {
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((data) => {
          setResults(Array.isArray(data) ? (data as MemoryItem[]) : []);
          setLoading(false);
        })
        .catch((err) => {
          if (err?.name !== "AbortError") setLoading(false);
        });
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // A new result set always starts at the top. Deriving it during render
  // rather than in an effect avoids a second render pass per keystroke.
  const [lastResults, setLastResults] = useState<MemoryItem[]>(results);
  if (lastResults !== results) {
    setLastResults(results);
    if (activeIndex !== 0) setActiveIndex(0);
  }

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  const commit = (item: MemoryItem) => {
    onSelect(item);
    onClose();
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(results.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = results[activeIndex];
      if (item) commit(item);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-0 duration-150 cursor-pointer"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Search and command palette"
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input Bar */}
        <div className="flex items-center border-b border-border px-4 py-3.5">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search decisions, commits, and discussions..."
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="command-palette-list"
            aria-activedescendant={
              results.length > 0 ? `command-palette-option-${activeIndex}` : undefined
            }
            aria-autocomplete="list"
            aria-label="Search memory records"
            className="ml-3 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            title="Close (Esc)"
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2" ref={listRef}>
          {loading ? (
            <div className="py-6 text-center text-xs text-muted-foreground animate-pulse" role="status">
              Searching local memory...
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground" role="status">
              {query ? "No matching records. Try a project, file, or decision term." : "Type to search..."}
            </div>
          ) : (
            <div id="command-palette-list" role="listbox" aria-label="Search results" className="space-y-1">
              {results.map((item, index) => {
                const indexedLabel = formatIndexedAt(item.indexed_at);
                const isActive = index === activeIndex;
                return (
                <div
                  key={item.id}
                  id={`command-palette-option-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => commit(item)}
                  onMouseMove={() => setActiveIndex(index)}
                  className={cn(
                    "group flex cursor-pointer items-center justify-between rounded-lg p-2.5 transition-colors",
                    isActive ? "bg-secondary" : "hover:bg-secondary",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3 overflow-hidden">
                    <span className="shrink-0 rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
                      {formatItemType(item.type)}
                    </span>
                    <div className="truncate">
                      <div className="text-xs font-medium text-foreground group-hover:text-primary transition-colors truncate">
                        {item.title}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {item.project}
                      </div>
                    </div>
                  </div>
                  <div className="ml-2 flex shrink-0 items-center gap-2">
                    {item.source && item.score !== undefined && (
                      <div className="hidden text-right sm:block">
                        <div className="font-mono text-[10px] text-foreground/80">
                          {item.source} · {Math.round(item.score * 100)}%
                        </div>
                        {indexedLabel && (
                          <div className="font-mono text-[9px] text-muted-foreground">
                            {indexedLabel}
                          </div>
                        )}
                      </div>
                    )}
                    {item.related_ids?.length ? (
                      <span className="hidden rounded border border-border/70 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground md:inline">
                        {item.related_ids.length} linked
                      </span>
                    ) : null}
                    <ArrowRight className={cn("h-3.5 w-3.5 text-muted-foreground text-primary opacity-0 transition-all", isActive && "opacity-100")} />
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Result count is announced to screen readers as results change. */}
        <span className="sr-only" role="status" aria-live="polite">
          {loading ? "Searching" : `${results.length} result${results.length === 1 ? "" : "s"}`}
        </span>

        {/* Footer */}
        <div className="border-t border-border bg-secondary/30 px-4 py-2 text-[10px] text-muted-foreground flex flex-wrap items-center justify-between gap-2">
          <span>Search all items</span>
          <span className="flex items-center gap-2 font-mono">
            <span>↑↓ to navigate</span>
            <span aria-hidden="true">·</span>
            <span>↵ to open</span>
            <span aria-hidden="true">·</span>
            <span>Esc to close</span>
          </span>
        </div>
      </div>
    </div>
  );
}
