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
  Sparkles,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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
    <div className={`p-4 md:p-6 max-w-3xl mx-auto space-y-6 ${className || ""}`}>
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
          <div className="flex items-center rounded-lg border border-border/70 bg-card/60 p-0.5">
            {[
              { label: "All", value: "all" },
              { label: "Decisions", value: "adr" },
              { label: "Commits", value: "commit" },
              { label: "Discussions", value: "grill" },
            ].map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setFilterType(tab.value)}
                className={`rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors cursor-pointer ${
                  filterType === tab.value
                    ? "bg-foreground text-background font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => startTransition(() => fetchActivity())}
            disabled={loading || isPending}
            className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-card/80 p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Refresh feed"
          >
            <RefreshCw className={`size-3.5 ${loading || isPending ? "animate-spin text-primary" : ""}`} />
          </button>
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
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em] font-semibold">
          {label}
        </span>
        <span className="h-px flex-1 bg-border/40" />
        <span className="font-mono text-[10px] text-muted-foreground tabular-nums px-2 py-0.5 rounded-full bg-muted/60">
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
                onClick={() => onSelectItem?.(e.type, e.raw_id)}
                className="group flex flex-col sm:flex-row sm:items-start justify-between gap-3 rounded-xl border border-border/60 bg-card/40 hover:border-border hover:bg-card/70 px-4 py-3 shadow-2xs transition-all cursor-pointer"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <Avatar className="size-7 mt-0.5 shrink-0">
                    <AvatarFallback className="text-[10px] font-semibold bg-muted text-foreground">
                      {e.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs md:text-sm text-foreground leading-snug">
                      <span className="font-semibold text-foreground">{e.who}</span>{" "}
                      <span className="text-muted-foreground">{e.what}</span>
                    </div>
                    {e.context && (
                      <div className="mt-1 text-xs md:text-sm font-medium text-foreground/90 leading-relaxed group-hover:text-primary transition-colors">
                        {e.context}
                      </div>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted-foreground">
                      <span className="text-foreground/75 font-medium">{e.project}</span>
                      <span>·</span>
                      <span>{e.time}</span>
                      {e.meta && (
                        <>
                          <span>·</span>
                          <span className="text-muted-foreground/80">{e.meta}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 self-end sm:self-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="font-mono text-[10px] text-primary inline-flex items-center gap-1">
                    View <ExternalLink className="size-2.5" />
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
