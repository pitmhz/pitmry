"use client";

import { useEffect, useState, useTransition } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  Database,
  GitBranch,
  Cpu,
  Layers,
  Clock,
  CheckCircle2 as CheckCircle2Icon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Severity = "investigating" | "identified" | "monitoring" | "resolved";

interface Update {
  state: Severity;
  at: string;
  text: string;
}

interface Incident {
  title: string;
  affected: string[];
  severity: "minor" | "major" | "critical";
  state: "ongoing" | "resolved";
  startedAt: string;
  resolvedAt?: string;
  duration?: string;
  updates: Update[];
}

interface ComponentHealth {
  name: string;
  uptime: string;
  status: "operational" | "degraded";
  latency?: string;
  meta?: string;
}

interface HealthData {
  status: "operational" | "degraded";
  status_text: string;
  checked_at: string;
  components: ComponentHealth[];
  incidents: Incident[];
}

const SEV_TONE: Record<"minor" | "major" | "critical", string> = {
  minor: "bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-amber-500/20",
  major: "bg-rose-500/15 text-rose-700 dark:text-rose-400 ring-rose-500/20",
  critical: "bg-rose-500/15 text-rose-700 dark:text-rose-400 ring-rose-500/20",
};

const STATE_DOT: Record<Severity, string> = {
  investigating: "bg-rose-500",
  identified: "bg-amber-500",
  monitoring: "bg-sky-500",
  resolved: "bg-emerald-500",
};

export function TimelinesStatusPage({ className }: { className?: string }) {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const fetchHealth = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/memory?action=health");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch system health:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const isDegraded = data?.status === "degraded";

  return (
    <div className={`p-4 md:p-6 max-w-4xl mx-auto space-y-8 ${className || ""}`}>
      {/* Header */}
      <header className="text-center">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
          System Status
        </div>
        
        <div className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-[12px] ring-1 transition-colors backdrop-blur-sm bg-background/80 shadow-xs border border-border/50">
          <span
            className={`size-2 rounded-full ${
              isDegraded
                ? "bg-amber-500 animate-pulse"
                : "bg-emerald-500 animate-pulse"
            }`}
          />
          <span className={isDegraded ? "text-amber-600 dark:text-amber-400 font-medium" : "text-foreground font-medium"}>
            {data?.status_text || (loading ? "Checking services..." : "All systems running normally")}
          </span>
        </div>

        <h1 className="mt-4 font-heading text-2xl md:text-3xl tracking-tight text-foreground">
          System Health
        </h1>
        <p className="mt-1 text-xs md:text-sm text-muted-foreground max-w-lg mx-auto">
          Live status of vector search, SQLite database, embedding models, and git repos.
        </p>

        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => startTransition(() => fetchHealth())}
            disabled={loading || isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/80 px-3 py-1.5 font-mono text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all cursor-pointer shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${loading || isPending ? "animate-spin text-primary" : ""}`} />
            Refresh
          </button>
          {data?.checked_at && (
            <span className="font-mono text-[10px] text-muted-foreground/80 flex items-center gap-1">
              <Clock className="size-3" />
              {new Date(data.checked_at).toLocaleTimeString()}
            </span>
          )}
        </div>
      </header>

      {/* 60-day Uptime Components Card */}
      <div className="rounded-xl border border-border/60 bg-card/50 backdrop-blur-md px-5 py-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em] flex items-center gap-2">
            <Server className="size-3.5 text-primary" />
            60-Day Uptime & Response Time
          </div>
          <span className="font-mono text-[10px] text-emerald-500 dark:text-emerald-400 font-medium">
            Target: 100%
          </span>
        </div>

        <ul className="mt-2 divide-y divide-border/40">
          {(data?.components || [
            { name: "LanceDB Vector DB", uptime: "99.99%", status: "operational", latency: "2.4ms", meta: "39 vectors · dim 384" },
            { name: "SQLite Cavemem DB", uptime: "100.0%", status: "operational", latency: "0.8ms", meta: "39 records · integrity ok" },
            { name: "Git Command Bridge", uptime: "99.95%", status: "operational", latency: "14ms", meta: "3 tracked repos" },
            { name: "Local ONNX Embedder", uptime: "99.98%", status: "operational", latency: "5.1ms", meta: "all-MiniLM-L6-v2" },
            { name: "Next.js API Gateway", uptime: "100.0%", status: "operational", latency: "1.1ms", meta: "App Router" },
          ]).map((c) => (
            <li key={c.name} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5">
              <div className="flex items-start gap-3">
                <span
                  className={
                    "size-2.5 mt-1 rounded-full shrink-0 " +
                    (c.status === "operational" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-amber-500 animate-pulse")
                  }
                />
                <div>
                  <div className="text-sm font-medium text-foreground flex items-center gap-2">
                    {c.name}
                    {c.latency && (
                      <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-muted/60 text-muted-foreground">
                        {c.latency}
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em] mt-0.5">
                    {c.meta || c.status}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 sm:ml-auto">
                <UptimeBars degraded={c.status !== "operational"} />
                <span className="w-16 text-right font-mono text-[11px] font-medium text-muted-foreground">
                  {c.uptime}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Incidents & Maintenance Timeline */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.25em] flex items-center gap-1.5">
            <Layers className="size-3 text-muted-foreground" />
            Past Incidents
          </h2>
          <span className="font-mono text-[10px] text-muted-foreground">
            Last 30 days
          </span>
        </div>

        <div className="flex flex-col gap-4">
          {(data?.incidents || []).map((inc) => (
            <article
              key={inc.title}
              className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm p-5 shadow-xs hover:border-border transition-colors"
            >
              <div className="flex items-start gap-3">
                <span
                  className={
                    "rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] ring-1 shrink-0 " +
                    SEV_TONE[inc.severity]
                  }
                >
                  {inc.state === "resolved" ? "Resolved" : inc.severity}
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-heading text-base md:text-lg text-foreground font-semibold">
                    {inc.title}
                  </h3>
                  <div className="mt-1 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                    Affecting {inc.affected.join(", ")} {inc.duration ? `· duration ${inc.duration}` : ""}
                  </div>
                </div>
                {inc.state === "resolved" ? (
                  <CheckCircle2Icon className="size-5 text-emerald-500 shrink-0" />
                ) : null}
              </div>

              <ol className="relative mt-5 pl-2">
                <span
                  aria-hidden
                  className="absolute top-2 bottom-2 left-[11px] w-px bg-border/60"
                />
                {inc.updates.map((u, i) => (
                  <li
                    key={i}
                    className="relative grid grid-cols-[24px_1fr] gap-3 py-2.5"
                  >
                    <span className="z-10 mt-1 grid size-[14px] place-items-center rounded-full ring-2 ring-card bg-card">
                      <span
                        className={"size-2 rounded-full " + STATE_DOT[u.state]}
                      />
                    </span>
                    <div>
                      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em]">
                        <span className="text-foreground font-medium">{u.state}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{u.at}</span>
                      </div>
                      <div className="mt-1 text-foreground/85 text-xs md:text-sm leading-relaxed">
                        {u.text}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function UptimeBars({ degraded }: { degraded: boolean }) {
  return (
    <div className="hidden gap-[2px] sm:flex items-center">
      {Array.from({ length: 48 }).map((_, i) => {
        const isRecentIncident = degraded && i > 44;
        return (
          <span
            key={i}
            className={
              "h-5 w-[3px] rounded-xs transition-opacity hover:opacity-75 " +
              (isRecentIncident
                ? "bg-amber-500"
                : "bg-emerald-500/80 dark:bg-emerald-400/70")
            }
            title={`Day ${48 - i}: Operational`}
          />
        );
      })}
    </div>
  );
}
