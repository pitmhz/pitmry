"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Clock, Database, RefreshCw, Server, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type Check = { status: string; message?: string; [key: string]: unknown };
type Readiness = { version: number; status: "ready" | "degraded" | "critical"; checked_at: string; checks?: Record<string, Check>; error?: string };
const labels: Record<string, string> = { database: "SQLite database", embeddings: "Observation embeddings", worker: "Embedding worker", integrations: "Agent integrations", summaries: "Session continuity", duplicates: "Duplicate records" };

function detail(value: Check) {
  if (value.message) return value.message;
  return Object.entries(value).filter(([key]) => key !== "status").map(([key, item]) => `${key.replaceAll("_", " ")}: ${String(item)}`).join(" · ");
}

export function TimelinesStatusPage({ className }: { className?: string }) {
  const [data, setData] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const fetchReadiness = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/memory?action=readiness", { cache: "no-store" });
      setData(await response.json());
    } catch (error) {
      setData({ version: 1, status: "critical", checked_at: new Date().toISOString(), error: String(error) });
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void fetchReadiness(); }, [fetchReadiness]);

  const status = data?.status ?? "degraded";
  const statusColor = status === "ready" ? "text-emerald-500" : status === "critical" ? "text-rose-500" : "text-amber-500";
  const checks = Object.entries(data?.checks ?? {});

  return (
    <div className={`mx-auto max-w-4xl space-y-6 p-4 md:p-6 ${className || ""}`}>
      <header className="rounded-xl border border-border/60 bg-card/50 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Memory Reliability v1</div>
            <h1 className="mt-2 font-heading text-2xl tracking-tight">Readiness</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">Live evidence that memories are stored, embedded, recoverable after compaction, and available to configured agents.</p>
          </div>
          <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-xs font-semibold uppercase ${statusColor}`}>
            {status === "ready" ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}{loading ? "checking" : status}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => startTransition(() => { void fetchReadiness(); })}
            disabled={loading || isPending}
            className="font-mono text-xs gap-2"
          >
            <RefreshCw className={`size-3.5 ${loading || isPending ? "animate-spin text-primary" : ""}`} />
            Refresh
          </Button>
          {data?.checked_at && <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground"><Clock className="size-3" />{new Date(data.checked_at).toLocaleString()}</span>}
        </div>
      </header>
      {data?.error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-600">{data.error}</div>}
      <section className="grid gap-3 md:grid-cols-2" aria-label="Readiness checks">
        {checks.map(([name, value]) => {
          const healthy = value.status === "ready" || value.status === "ok";
          const Icon = name === "database" ? Database : name === "worker" ? Server : ShieldCheck;
          return <article key={name} className="rounded-xl border border-border/60 bg-card/50 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><Icon className="size-4 text-primary" /><h2 className="text-sm font-semibold">{labels[name] || name.replaceAll("_", " ")}</h2></div><span className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase ${healthy ? "bg-emerald-500/10 text-emerald-600" : value.status === "critical" ? "bg-rose-500/10 text-rose-600" : "bg-amber-500/10 text-amber-600"}`}>{value.status}</span></div>
            <p className="mt-3 break-words font-mono text-[11px] leading-relaxed text-muted-foreground">{detail(value) || "No detail reported"}</p>
          </article>;
        })}
      </section>
      {!loading && checks.length === 0 && !data?.error && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No readiness checks were returned.</div>}
    </div>
  );
}
