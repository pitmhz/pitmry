import React from "react";
import { cn } from "@/lib/utils";
import type { DiffHunk, DiffLine } from "./diff-types";

function HunkHeader({ hunk, hintClass }: { hunk: DiffHunk; hintClass: string }) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-y border-border/80 bg-secondary px-3 py-1.5 text-[11px] font-mono text-muted-foreground font-semibold backdrop-blur">
      <span className="text-primary font-bold">{hunk.header}</span>
      {hunk.context_hint && (
        <span className={cn("truncate text-foreground/80 dark:text-zinc-300 font-medium", hintClass)}>
          {hunk.context_hint}
        </span>
      )}
    </div>
  );
}

export function InlineDiffHunk({ hunk }: { hunk: DiffHunk }) {
  return (
    <div className="space-y-0">
      <HunkHeader hunk={hunk} hintClass="max-w-xs" />
      <div className="divide-y divide-border/10">
        {hunk.lines.map((line, lIdx) => {
          const isAdd = line.type === "addition";
          const isDel = line.type === "deletion";

          return (
            <div
              key={lIdx}
              className={cn(
                "flex items-start text-[11px] leading-snug font-mono transition-colors",
                isAdd && "bg-success text-success bg-success text-success border-l-2 border-success border-success font-medium",
                isDel && "bg-danger text-danger bg-danger text-danger border-l-2 border-danger border-danger font-medium",
                !isAdd && !isDel && "text-foreground dark:text-zinc-100 hover:bg-muted/40 border-l-2 border-transparent"
              )}
            >
              <span className="w-10 shrink-0 select-none px-1 text-right text-[11px] font-mono font-medium text-muted-foreground">
                {line.old_num !== null ? line.old_num : ""}
              </span>
              <span className="w-10 shrink-0 select-none px-1 text-right text-[11px] font-mono font-medium text-muted-foreground border-r border-border/40">
                {line.new_num !== null ? line.new_num : ""}
              </span>
              <span
                className={cn(
                  "w-5 shrink-0 select-none text-center font-bold",
                  isAdd ? "text-success text-success" : isDel ? "text-danger text-danger" : "text-muted-foreground/40"
                )}
              >
                {isAdd ? "+" : isDel ? "-" : " "}
              </span>
              <span className="flex-1 whitespace-pre pr-2 overflow-x-auto select-text font-mono font-normal">
                {line.content || " "}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function InlineDiffFile({ hunks }: { hunks: DiffHunk[] }) {
  return (
    <div className="divide-y divide-border/30 font-mono text-xs">
      {hunks.map((hunk, hIdx) => (
        <InlineDiffHunk key={hIdx} hunk={hunk} />
      ))}
    </div>
  );
}

// Pair deletions and additions into aligned left/right columns so removed and
// added lines line up row-for-row in split mode.
function pairHunkLines(hunk: DiffHunk): { left: (DiffLine | null)[]; right: (DiffLine | null)[] } {
  const leftLines: (DiffLine | null)[] = [];
  const rightLines: (DiffLine | null)[] = [];

  let i = 0;
  while (i < hunk.lines.length) {
    const line = hunk.lines[i];
    if (line.type === "context") {
      leftLines.push(line);
      rightLines.push(line);
      i++;
    } else if (line.type === "deletion") {
      const delGroup = [line];
      let j = i + 1;
      while (j < hunk.lines.length && hunk.lines[j].type === "deletion") {
        delGroup.push(hunk.lines[j]);
        j++;
      }
      const addGroup: DiffLine[] = [];
      while (j < hunk.lines.length && hunk.lines[j].type === "addition") {
        addGroup.push(hunk.lines[j]);
        j++;
      }
      const maxLen = Math.max(delGroup.length, addGroup.length);
      for (let k = 0; k < maxLen; k++) {
        leftLines.push(delGroup[k] || null);
        rightLines.push(addGroup[k] || null);
      }
      i = j;
    } else if (line.type === "addition") {
      leftLines.push(null);
      rightLines.push(line);
      i++;
    }
  }

  return { left: leftLines, right: rightLines };
}

function SplitSideCell({
  line,
  side,
}: {
  line: DiffLine | null | undefined;
  side: "left" | "right";
}) {
  const isRemoval = side === "left" && line?.type === "deletion";
  const isAddition = side === "right" && line?.type === "addition";
  const num = side === "left" ? line?.old_num : line?.new_num;
  const marker = isRemoval ? "-" : isAddition ? "+" : " ";
  const markerTone = isRemoval ? "text-danger text-danger" : isAddition ? "text-success text-success" : "text-muted-foreground/30";

  return (
    <div
      className={cn(
        "flex items-start overflow-x-auto",
        (isRemoval || isAddition)
          ? side === "left"
            ? "bg-danger text-danger bg-danger text-danger border-l-2 border-danger border-danger font-medium"
            : "bg-success text-success bg-success text-success border-l-2 border-success border-success font-medium"
          : "text-foreground dark:text-zinc-100 border-l-2 border-transparent"
      )}
    >
      <span className="w-10 shrink-0 select-none px-1 text-right text-[11px] font-mono font-medium text-muted-foreground border-r border-border/30">
        {num !== null && num !== undefined ? num : ""}
      </span>
      <span className={cn("w-4 shrink-0 select-none text-center font-bold", markerTone)}>{marker}</span>
      <span className="flex-1 whitespace-pre pr-2 select-text font-mono">{line?.content || " "}</span>
    </div>
  );
}

export function SplitDiffHunk({ hunk }: { hunk: DiffHunk }) {
  const { left, right } = pairHunkLines(hunk);

  return (
    <div>
      <HunkHeader hunk={hunk} hintClass="max-w-sm" />
      <div className="divide-y divide-border/10">
        {left.map((leftLine, lIdx) => {
          const rightLine = right[lIdx];
          return (
            <div
              key={lIdx}
              className="grid grid-cols-2 divide-x divide-border/30 text-[11px] leading-snug"
            >
              <SplitSideCell line={leftLine} side="left" />
              <SplitSideCell line={rightLine} side="right" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SplitDiffFile({ hunks }: { hunks: DiffHunk[] }) {
  return (
    <div className="divide-y divide-border/30 min-w-[650px] font-mono text-xs">
      {hunks.map((hunk, hIdx) => (
        <SplitDiffHunk key={hIdx} hunk={hunk} />
      ))}
    </div>
  );
}
