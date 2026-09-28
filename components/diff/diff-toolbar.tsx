import React from "react";
import {
  Copy,
  Check,
  Maximize2,
  Columns,
  AlignJustify,
  Eye,
  SplitSquareVertical,
  Code2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DiffData, ViewMode } from "./diff-types";

export function DiffToolbar({
  data,
  viewMode,
  isModal,
  copied,
  copiedCode,
  onViewModeChange,
  onCopyPatch,
  onCopyCode,
  onExpand,
  onClose,
}: {
  data: DiffData;
  viewMode: ViewMode;
  isModal: boolean;
  copied: boolean;
  copiedCode: boolean;
  onViewModeChange: (mode: ViewMode) => void;
  onCopyPatch: () => void;
  onCopyCode: () => void;
  onExpand?: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-secondary/30 px-3.5 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="font-mono text-xs uppercase font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded">
          #{data.commit_hash?.slice(0, 8)}
        </span>
        <div className="flex items-center gap-1.5 text-xs font-mono font-semibold">
          <span className="text-success text-success font-bold">+{data.total_additions}</span>
          <span className="text-danger text-danger font-bold">-{data.total_deletions}</span>
          <span className="text-muted-foreground font-normal">• {data.total_files} files</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Mode Switcher */}
        <div role="tablist" aria-label="Diff view modes" className="flex items-center rounded-lg border border-border/80 bg-secondary/60 p-0.5 text-xs">
          <Button
            role="tab"
            aria-selected={viewMode === "inline"}
            aria-label="Unified single column diff"
            size="xs"
            variant={viewMode === "inline" ? "odysseyui" : "ghost"}
            onClick={() => onViewModeChange("inline")}
            className="gap-1.5 text-xs font-medium"
            title="Unified single column diff"
          >
            <AlignJustify className="h-3.5 w-3.5" />
            <span>Inline</span>
          </Button>

          {/* Split & Resizable modes shown when in modal or explicitly toggled */}
          {isModal && (
            <>
              <Button
                role="tab"
                aria-selected={viewMode === "split"}
                aria-label="Side-by-side comparison"
                size="xs"
                variant={viewMode === "split" ? "odysseyui" : "ghost"}
                onClick={() => onViewModeChange("split")}
                className="gap-1.5 text-xs font-medium"
                title="Side-by-side comparison"
              >
                <Columns className="h-3.5 w-3.5" />
                <span>Split</span>
              </Button>
              <Button
                role="tab"
                aria-selected={viewMode === "resizable"}
                aria-label="Split resizable mode"
                size="xs"
                variant={viewMode === "resizable" ? "odysseyui" : "ghost"}
                onClick={() => onViewModeChange("resizable")}
                className="gap-1.5 text-xs font-medium"
                title="Split Resizable: Diff & Live Preview side-by-side"
              >
                <SplitSquareVertical className="h-3.5 w-3.5" />
                <span>Resizable</span>
              </Button>
            </>
          )}

          <Button
            role="tab"
            aria-selected={viewMode === "preview"}
            aria-label="Post-change file preview"
            size="xs"
            variant={viewMode === "preview" ? "odysseyui" : "ghost"}
            onClick={() => onViewModeChange("preview")}
            className="gap-1.5 text-xs font-medium"
            title="Post-change file preview"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Preview</span>
          </Button>
        </div>

        {/* Copy Patch */}
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onCopyPatch}
          title="Copy diff patch"
          aria-label="Copy diff patch"
        >
          {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
        </Button>

        {/* Copy Reconstructed Code */}
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onCopyCode}
          title="Copy post-commit file content"
          aria-label="Copy file content"
        >
          {copiedCode ? <Check className="h-4 w-4 text-success text-success" /> : <Code2 className="h-4 w-4" />}
        </Button>

        {/* Expand Modal / Pop-out */}
        {onExpand && !isModal && (
          <Button
            variant="outline"
            size="icon-sm"
            onClick={onExpand}
            title="Expand into full modal view"
            aria-label="Expand diff viewer"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        )}

        {isModal && onClose && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="gap-1.5 ml-1"
            title="Close modal (Esc)"
            aria-label="Close modal diff viewer"
          >
            <X className="h-4 w-4" />
            <span className="text-[11px] font-medium hidden sm:inline">Close</span>
            <kbd className="hidden sm:inline-block rounded border border-border bg-card px-1 text-[9px] font-mono text-muted-foreground">
              Esc
            </kbd>
          </Button>
        )}
      </div>
    </div>
  );
}
