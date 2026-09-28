"use client";

import React, { useEffect, useRef } from "react";
import {
  FileCode,
  Search,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DiffFile } from "./diff-types";

export function DiffFileTabs({
  files,
  filteredFiles,
  selectedFileIndex,
  searchQuery,
  onSearchChange,
  onSelect,
}: {
  files: DiffFile[];
  filteredFiles: DiffFile[];
  selectedFileIndex: number;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSelect: (index: number) => void;
}) {
  const fileTabsRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [selectedFileIndex]);

  const scrollTabs = (offset: number) => {
    if (fileTabsRef.current) {
      fileTabsRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  return (
    <div className="flex items-center border-b border-border/70 bg-secondary/15 px-2 py-1.5 gap-1.5 shrink-0 overflow-hidden">
      {/* Search filter input if > 3 files */}
      {files.length > 3 && (
        <div className="relative shrink-0 flex items-center">
          <Search className="h-3 w-3 text-muted-foreground absolute left-2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter..."
            className="w-20 sm:w-28 focus:w-36 transition-all bg-secondary/50 pl-6 pr-2 py-0.5 text-[11px] rounded border border-border/70 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
          />
        </div>
      )}

      {/* Quick jump select dropdown if > 5 files */}
      {files.length > 5 && (
        <select
          value={selectedFileIndex}
          onChange={(e) => onSelect(Number(e.target.value))}
          className="h-6 max-w-[110px] bg-secondary/60 border border-border/70 text-[10px] font-mono rounded px-1 text-muted-foreground hover:text-foreground focus:outline-none truncate shrink-0 cursor-pointer"
          title="Jump directly to file"
        >
          {files.map((f, i) => {
            const fn = f.path.split("/").pop() || f.path;
            return (
              <option key={f.path} value={i}>
                {fn} ({f.additions > 0 ? `+${f.additions}` : ""}{f.deletions > 0 ? ` -${f.deletions}` : ""})
              </option>
            );
          })}
        </select>
      )}

      {/* Left Scroll Chevron */}
      {files.length > 2 && (
        <button
          onClick={() => scrollTabs(-160)}
          className="h-6 w-5 shrink-0 rounded hover:bg-secondary/70 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          title="Scroll files left"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Scrollable File Tabs */}
      <div
        ref={fileTabsRef}
        className="flex-1 flex items-center gap-1.5 overflow-x-auto py-0.5 scroll-smooth"
      >
        {filteredFiles.map((file) => {
          const originalIndex = files.indexOf(file);
          const isSelected = originalIndex === selectedFileIndex;
          const fName = file.path.split("/").pop() || file.path;

          return (
            <button
              key={file.path}
              ref={isSelected ? activeTabRef : undefined}
              onClick={() => onSelect(originalIndex)}
              className={cn(
                "shrink-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-mono transition-all border cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                isSelected
                  ? "bg-primary/15 text-primary border-primary/50 font-bold shadow-xs"
                  : "bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground border-border/40"
              )}
              title={file.path}
            >
              <FileCode className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "text-primary" : "text-muted-foreground")} />
              <span className="truncate max-w-[130px] sm:max-w-[190px]">{fName}</span>
              <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-mono font-semibold">
                {file.additions > 0 && <span className="text-success text-success font-bold">+{file.additions}</span>}
                {file.deletions > 0 && <span className="text-danger text-danger font-bold">-{file.deletions}</span>}
              </span>
            </button>
          );
        })}
        {filteredFiles.length === 0 && (
          <span className="text-xs text-muted-foreground italic px-2">No files match filter</span>
        )}
      </div>

      {/* Right Scroll Chevron */}
      {files.length > 2 && (
        <button
          onClick={() => scrollTabs(160)}
          className="h-6 w-5 shrink-0 rounded hover:bg-secondary/70 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Scroll files right"
          aria-label="Scroll files right"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Files Count Indicator */}
      <span className="shrink-0 text-[11px] font-mono text-muted-foreground hidden sm:inline-block px-1 font-semibold">
        {selectedFileIndex + 1}/{files.length}
      </span>
    </div>
  );
}

export function DiffFileHeader({ activeFile, language }: { activeFile: DiffFile; language: string }) {
  const zedUrl = activeFile?.full_path ? `zed://file/${activeFile.full_path}` : null;
  const vscodeUrl = activeFile?.full_path ? `vscode://file/${activeFile.full_path}` : null;

  return (
    <div className="flex items-center justify-between border-b border-border/70 bg-secondary/30 px-3.5 py-1.5 text-xs shrink-0">
      <div className="flex items-center gap-2 truncate pr-2 min-w-0">
        <FileCode className="h-3.5 w-3.5 text-primary shrink-0" />
        <div className="flex items-baseline gap-1 truncate font-mono min-w-0">
          {activeFile.path.substring(0, activeFile.path.lastIndexOf("/")) && (
            <span className="text-[11px] text-muted-foreground truncate shrink">
              {activeFile.path.substring(0, activeFile.path.lastIndexOf("/"))}/
            </span>
          )}
          <span className="text-xs font-bold text-foreground shrink-0">
            {activeFile.path.split("/").pop()}
          </span>
        </div>
        <span className="rounded bg-secondary/80 border border-border/60 px-1.5 py-0.5 text-[11px] font-mono uppercase text-muted-foreground font-semibold shrink-0">
          {language}
        </span>
        <span className="text-xs font-mono shrink-0">
          {activeFile.additions > 0 && <span className="text-success text-success font-bold">+{activeFile.additions} </span>}
          {activeFile.deletions > 0 && <span className="text-danger text-danger font-bold">-{activeFile.deletions}</span>}
        </span>
      </div>

      {/* Editor Launch Links */}
      <div className="flex items-center gap-1.5 shrink-0">
        {zedUrl && (
          <a
            href={zedUrl}
            className="flex items-center gap-1 rounded border border-border/70 bg-secondary/50 px-2 py-0.5 text-[11px] font-mono font-medium text-foreground hover:bg-secondary hover:text-primary transition-colors"
            title="Open this file in Zed editor"
          >
            <span>Zed</span>
            <ExternalLink className="h-3 w-3 opacity-70" />
          </a>
        )}
        {vscodeUrl && (
          <a
            href={vscodeUrl}
            className="flex items-center gap-1 rounded border border-border/70 bg-secondary/50 px-2 py-0.5 text-[11px] font-mono font-medium text-foreground hover:bg-secondary hover:text-primary transition-colors"
            title="Open this file in VS Code"
          >
            <span>VS Code</span>
            <ExternalLink className="h-3 w-3 opacity-70" />
          </a>
        )}
      </div>
    </div>
  );
}
