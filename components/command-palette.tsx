"use client";

import React, { useEffect, useState, useRef } from "react";
import { Search, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MemoryItem } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelect: (item: MemoryItem) => void;
}

function formatItemType(type?: string): string {
  switch (type) {
    case "adr":
      return "Decision";
    case "commit":
      return "Commit";
    case "grill":
      return "Discussion";
    default:
      return type || "Item";
  }
}

export function CommandPalette({ open, onClose, onSelect }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
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

  if (!open) return null;

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
            placeholder="Search decisions, commits, and notes..."
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
        <div className="max-h-96 overflow-y-auto p-2">
          {loading ? (
            <div className="py-6 text-center text-xs text-muted-foreground animate-pulse">
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              {query ? "No results found." : "Type to search..."}
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelect(item);
                    onClose();
                  }}
                  className="group flex cursor-pointer items-center justify-between rounded-lg p-2.5 hover:bg-secondary transition-colors"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
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
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-primary transition-all shrink-0 ml-2" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-secondary/30 px-4 py-2 text-[10px] text-muted-foreground flex items-center justify-between">
          <span>Search all items</span>
          <span className="font-mono">Esc to close</span>
        </div>
      </div>
    </div>
  );
}
