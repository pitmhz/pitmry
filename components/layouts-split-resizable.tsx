"use client";

import { useEffect, useRef, useState } from "react";
import {
  GripVertical,
  Play,
  RotateCcw,
  Share2,
  Eye,
  Code2
} from "lucide-react";
import { Highlight, themes } from "prism-react-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const DEFAULT_CODE = `import { useState } from "react";
import { Button } from "@/components/ui/button";

// Interactive preview widget
export function LiveCounter() {
  const [count, setCount] = useState(0);

  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl border border-border bg-card">
      <h2 className="font-semibold text-lg text-foreground">
        Live preview
      </h2>
      <p className="text-sm text-muted-foreground">
        You clicked {count} times.
      </p>
      <Button size="sm" onClick={() => setCount(count + 1)}>
        Increment count
      </Button>
    </div>
  );
}
`;

interface LayoutsSplitResizableProps {
  code?: string;
  language?: string;
  filename?: string;
  previewContent?: React.ReactNode;
}

export function LayoutsSplitResizable({
  code = DEFAULT_CODE,
  language = "tsx",
  filename = "playground.tsx",
  previewContent,
}: LayoutsSplitResizableProps) {
  const [leftPct, setLeftPct] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<"code" | "preview" | "split">("split");
  const [count, setCount] = useState(0);
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateTheme = () => {
      setIsDarkTheme(!document.documentElement.classList.contains("light"));
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const raw = ((e.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(85, Math.max(15, raw));
      setLeftPct(clamped);
    };
    const onUp = () => setDragging(false);

    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
    };
  }, [dragging]);

  const leftLabel = Math.round(leftPct);
  const rightLabel = 100 - leftLabel;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground rounded-lg border border-border/70">
      {/* Top Header */}
      <header className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-secondary/30 px-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-muted-foreground text-xs">
            {filename}
          </span>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center rounded-md border border-border/60 bg-secondary/60 p-0.5 text-xs">
            <Button
              size="xs"
              variant={activeTab === "code" ? "odysseyui" : "ghost"}
              onClick={() => setActiveTab("code")}
              className="gap-1 text-[11px] font-medium"
            >
              <Code2 className="h-3 w-3" />
              <span>Code</span>
            </Button>
            <Button
              size="xs"
              variant={activeTab === "split" ? "odysseyui" : "ghost"}
              onClick={() => setActiveTab("split")}
              className="gap-1 text-[11px] font-medium"
            >
              <span>Split</span>
            </Button>
            <Button
              size="xs"
              variant={activeTab === "preview" ? "odysseyui" : "ghost"}
              onClick={() => setActiveTab("preview")}
              className="gap-1 text-[11px] font-medium"
            >
              <Eye className="h-3 w-3" />
              <span>Preview</span>
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "split" && (
            <>
              <Badge variant="outline" className="font-mono text-[10px] tracking-wider bg-secondary/50">
                {leftLabel}% / {rightLabel}%
              </Badge>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setLeftPct(50)}
                disabled={leftLabel === 50}
                className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                title="Reset split to 50%"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Main Split Body */}
      <div ref={containerRef} className="relative flex flex-1 overflow-hidden">
        {/* Code Pane */}
        {(activeTab === "code" || activeTab === "split") && (
          <div
            className={`flex shrink-0 flex-col overflow-hidden bg-foreground/[0.02] ${
              activeTab === "code" ? "w-full" : "border-r border-border/70"
            }`}
            style={{ width: activeTab === "code" ? "100%" : `${leftPct}%` }}
          >
            <div className="flex-1 overflow-auto p-2">
              <Highlight code={code.trimEnd()} language={language} theme={isDarkTheme ? themes.vsDark : themes.vsLight}>
                {({ className, style, tokens, getLineProps, getTokenProps }) => (
                  <pre
                    className={`m-0 p-3 font-mono text-[11px] leading-[1.6] rounded-lg border border-border/70 ${className}`}
                    style={{ ...style, backgroundColor: isDarkTheme ? "#0d1117" : "#f8fafc" }}
                  >
                    {tokens.map((line, i) => (
                      <div key={i} {...getLineProps({ line })} className="table-row">
                        <span className="table-cell select-none pr-3 text-right font-mono text-muted-foreground text-[11px] font-medium tabular-nums">
                          {i + 1}
                        </span>
                        <span className="table-cell whitespace-pre font-mono">
                          {line.map((token, key) => (
                            <span key={key} {...getTokenProps({ token })} />
                          ))}
                        </span>
                      </div>
                    ))}
                  </pre>
                )}
              </Highlight>
            </div>
          </div>
        )}

        {/* Draggable Divider Handle */}
        {activeTab === "split" && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-valuenow={leftLabel}
            aria-valuemin={15}
            aria-valuemax={85}
            onMouseDown={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDoubleClick={() => setLeftPct(50)}
            className={`group relative z-10 flex w-1.5 shrink-0 cursor-col-resize items-center justify-center transition-colors hover:bg-primary/40 select-none ${
              dragging ? "bg-primary/60" : "bg-transparent"
            }`}
          >
            <span className="pointer-events-none flex h-8 w-3 items-center justify-center rounded-sm bg-secondary border border-border opacity-0 transition-opacity group-hover:opacity-100 shadow-xs">
              <GripVertical className="size-3 text-muted-foreground" />
            </span>
          </div>
        )}

        {/* Preview Pane */}
        {(activeTab === "preview" || activeTab === "split") && (
          <div className="flex flex-1 flex-col overflow-hidden bg-background min-w-0">
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
              {previewContent ? (
                previewContent
              ) : (
                <div className="flex w-full max-w-sm flex-col gap-3 rounded-xl border border-border/80 bg-card p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-foreground">Live Component Preview</h3>
                    <Badge variant="outline" className="text-[9px] font-mono">Simulated</Badge>
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Interactive state is active in this container. Click count: {count}
                  </p>
                  <div className="flex items-center gap-2 pt-2">
                    <Button size="sm" onClick={() => setCount(c => c + 1)}>
                      Increment ({count})
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setCount(0)}>
                      Reset
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex h-6 shrink-0 items-center justify-between border-t border-border/60 bg-secondary/20 px-3">
              <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
                Preview active
              </span>
              <span className="font-mono text-[9px] text-muted-foreground">
                {filename}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
