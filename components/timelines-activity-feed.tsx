"use client";

import { useEffect, useState, useTransition } from "react";
import {
  CheckCircle2,
  GitCommit,
  Heart,
  MessageCircle,
  Palette,
  Rocket,
  RefreshCw,
  ExternalLink,
  Filter,
  Layers,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface Event {
  id: string;
  raw_id: number;
  type: "adr" | "commit" | "grill";
  who: string;
  initials: string;
  what: string;
  context?: string;
  project: string;
  Icon: string;
  tone: string;
  time: string;
  meta?: string;
  bullets?: string[];
  timestamp: string;
}

interface ActivityData {
  today: Event[];
  yesterday: Event[];
  earlier: Event[];
  total: number;
}

const TONE_CLASSES: Record<string, { bg: string; text: string; ring: string }> = {
  emerald: {
    bg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    text: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/20",
  },
  indigo: {
    bg: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
    text: "text-indigo-600 dark:text-indigo-400",
    ring: "ring-indigo-500/20",
  },
  sky: {
    bg: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    text: "text-sky-600 dark:text-sky-400",
    ring: "ring-sky-500/20",
  },
  violet: {
    bg: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    text: "text-violet-600 dark:text-violet-400",
    ring: "ring-violet-500/20",
  },
  rose: {
    bg: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    text: "text-rose-600 dark:text-rose-400",
    ring: "ring-rose-500/20",
  },
  pink: {
    bg: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
    text: "text-pink-600 dark:text-pink-400",
    ring: "ring-pink-500/20",
  },
};

function EventIcon({ name, className }: { name: string; className?: string }) {
  if (name === "GitCommitIcon") return <GitCommit className={className} />;
  if (name === "MessageCircleIcon") return <MessageCircle className={className} />;
  if (name === "PaletteIcon") return <Palette className={className} />;
  if (name === "RocketIcon") return <Rocket className={className} />;
  return <CheckCircle2 className={className} />;
}

export function TimelinesActivityFeed({
  onSelectItem,
  className,
}: {
  onSelectItem?: (type: "adr" | "commit" | "grill", id: number) => void;
  className?: string;
}) {
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  const fetchActivity = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/memory?action=activity");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch activity:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity();
  }, []);

  const filterEvents = (events: Event[] = []) => {
    if (filterType === "all") return events;
    return events.filter((e) => e.type === filterType);
  };

  const todayFiltered = filterEvents(data?.today);
  const yesterdayFiltered = filterEvents(data?.yesterday);
  const earlierFiltered = filterEvents(data?.earlier);

  return (
    <div className={`w-full p-4 md:p-6 space-y-6 ${className || ""}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
            Activity History
          </div>
          <h1 className="mt-1 font-heading text-2xl md:text-3xl text-foreground font-semibold">
            Recent Activity
          </h1>
          <p className="mt-1 text-xs md:text-sm text-muted-foreground">
            A timeline of saved decisions, git commits, and design discussions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div role="tablist" aria-label="Activity type filters" className="flex items-center rounded-lg border border-border/70 bg-card/60 p-0.5 gap-1">
            {[
              { label: "All", value: "all" },
              { label: "Decisions", value: "adr" },
              { label: "Commits", value: "commit" },
              { label: "Discussions", value: "grill" },
            ].map((tab) => (
              <Button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={filterType === tab.value}
                variant={filterType === tab.value ? "odysseyui" : "ghost"}
                size="xs"
                onClick={() => setFilterType(tab.value)}
                className="font-mono text-[11px] uppercase tracking-wider h-7"
              >
                {tab.label}
              </Button>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => startTransition(() => fetchActivity())}
            disabled={loading || isPending}
            className="shadow-xs"
            title="Refresh feed"
            aria-label="Refresh activity feed"
          >
            <RefreshCw className={`size-3.5 ${loading || isPending ? "animate-spin text-primary" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Grouped Day Sections */}
      <div className="space-y-6">
        {todayFiltered.length > 0 && (
          <DaySection
            label="Today"
            count={todayFiltered.length}
            events={todayFiltered}
            onSelectItem={onSelectItem}
          />
        )}

        {yesterdayFiltered.length > 0 && (
          <DaySection
            label="Yesterday"
            count={yesterdayFiltered.length}
            events={yesterdayFiltered}
            onSelectItem={onSelectItem}
          />
        )}

        {earlierFiltered.length > 0 && (
          <DaySection
            label="Earlier This Week"
            count={earlierFiltered.length}
            events={earlierFiltered}
            onSelectItem={onSelectItem}
          />
        )}

        {todayFiltered.length === 0 && yesterdayFiltered.length === 0 && earlierFiltered.length === 0 && !loading && (
          <div className="py-12 text-center rounded-xl border border-dashed border-border/60 bg-card/20">
            <Layers className="size-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No events found matching this filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DaySection({
  label,
  count,
  events,
  onSelectItem,
}: {
  label: string;
  count: number;
  events: Event[];
  onSelectItem?: (type: "adr" | "commit" | "grill", id: number) => void;
}) {
  return (
    <section className="mt-6">
      <div className="sticky top-2 z-10 mb-3 flex items-center gap-3 bg-background/90 py-2 backdrop-blur-md">
        <h2 className="font-mono text-xs text-primary uppercase tracking-widest font-bold">
          {label}
        </h2>
        <span className="h-px flex-1 bg-border/40" />
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums px-2.5 py-0.5 rounded-full bg-secondary font-bold">
          {count}
        </span>
      </div>

      <ol className="relative pl-8">
        <span
          aria-hidden
          className="absolute top-2 bottom-2 left-[15px] w-px bg-border/40"
        />
        {events.map((e) => {
          const tone = TONE_CLASSES[e.tone] || TONE_CLASSES.emerald;
          return (
            <li key={e.id} className="relative grid grid-cols-1 gap-3 py-2.5">
              <span
                className={`absolute -left-8 top-3 z-10 grid size-[32px] place-items-center rounded-full ring-4 ring-background shadow-xs ${tone.bg}`}
              >
                <EventIcon name={e.Icon} className="size-3.5" />
              </span>

              <div
                tabIndex={0}
                role="button"
                onClick={() => onSelectItem?.(e.type, e.raw_id)}
                onKeyDown={(evt) => {
                  if (evt.key === "Enter" || evt.key === " ") {
                    evt.preventDefault();
                    onSelectItem?.(e.type, e.raw_id);
                  }
                }}
                className="group flex flex-col sm:flex-row sm:items-start justify-between gap-3 rounded-xl border border-border/60 bg-card/40 hover:border-primary/40 hover:bg-card/70 px-4 py-3 shadow-2xs transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <Avatar className="size-7 mt-0.5 shrink-0">
                    <AvatarFallback className="text-[11px] font-bold bg-muted text-foreground">
                      {e.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs md:text-sm text-foreground leading-snug">
                      <span className="font-bold text-foreground">{e.who}</span>{" "}
                      <span className="text-muted-foreground">{e.what}</span>
                    </div>
                    {e.context && (
                      <div className="mt-1 font-heading text-sm md:text-[15px] font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
                        {e.context}
                      </div>
                    )}
                    {e.bullets && e.bullets.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground font-medium">
                          <Layers className="size-3" />
                          <span>{e.bullets.length} change highlights:</span>
                        </div>
                        <ul className="space-y-1 pl-1">
                          {e.bullets.slice(0, 3).map((b, i) => (
                            <li key={i} className="text-xs text-foreground/90 font-medium flex items-start gap-1.5 leading-relaxed">
                              <span className="text-muted-foreground font-bold mt-0.5">•</span>
                              <span className="line-clamp-2">{b}</span>
                            </li>
                          ))}
                          {e.bullets.length > 3 && (
                            <li className="text-[11px] font-mono text-muted-foreground font-medium">
                              +{e.bullets.length - 3} more points...
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
                      <span className="text-foreground font-bold">{e.project}</span>
                      <span>·</span>
                      <span>{e.time}</span>
                      {e.meta && (
                        <>
                          <span>·</span>
                          <span className="text-muted-foreground font-medium">{e.meta}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 self-end sm:self-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="font-mono text-xs text-primary font-bold inline-flex items-center gap-1">
                    View <ExternalLink className="size-3" />
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
