"use client"

import * as React from "react"
import {
  CircleAlertIcon,
  CopyIcon,
  FlameIcon,
  InfoIcon,
  PauseIcon,
  PlayIcon,
  RefreshCwIcon,
  TerminalIcon,
  Trash2Icon,
  CheckIcon,
  ServerIcon,
  ActivityIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { type LogEntry, type Severity } from "@/lib/server-logger"
import { useToast } from "@/lib/notification-toast-context"
import { cn } from "@/lib/utils"

const SEVERITY_STYLES: Record<Severity, { dot: string; label: string }> = {
  debug: { dot: "bg-muted-foreground/40", label: "text-muted-foreground" },
  info: { dot: "bg-sky-500", label: "text-sky-600 dark:text-sky-400 font-semibold" },
  warn: { dot: "bg-amber-500", label: "text-amber-600 dark:text-amber-400 font-semibold" },
  error: { dot: "bg-destructive", label: "text-destructive font-bold" },
}

interface ServerHealthSnapshot {
  status: string
  uptime_seconds: number
  memory: {
    heap_used_mb: number
    heap_total_mb: number
    system_free_mb: number
  }
  storage: {
    cavemem_connected: boolean
    lancedb_connected: boolean
  }
  checked_at: string
}

export function TableLogs() {
  const [logs, setLogs] = React.useState<LogEntry[]>([])
  const [health, setHealth] = React.useState<ServerHealthSnapshot | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [paused, setPaused] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  const fetchLogs = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/logs?limit=100`, { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
        setHealth(data.health || null)
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  React.useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Polling interval when live (not paused)
  React.useEffect(() => {
    if (paused) return
    const interval = setInterval(() => {
      fetchLogs()
    }, 3500)
    return () => clearInterval(interval)
  }, [paused, fetchLogs])

  const filteredLogs = React.useMemo(() => {
    if (!query.trim()) return logs
    const q = query.toLowerCase().trim()
    return logs.filter(
      (l) =>
        l.message.toLowerCase().includes(q) ||
        l.service.toLowerCase().includes(q) ||
        l.severity.toLowerCase().includes(q) ||
        l.request.toLowerCase().includes(q) ||
        (l.status && String(l.status).includes(q))
    )
  }, [logs, query])

  const selected = logs.find((e) => e.id === selectedId) ?? null

  const { toast } = useToast()

  const handleClearLogs = async () => {
    const previousLogs = [...logs]
    try {
      const res = await fetch("/api/logs", { method: "DELETE" })
      const data = await res.json()
      setLogs([])
      setSelectedId(null)

      toast.undo("Server Logs Cleared", `${previousLogs.length} events removed from buffer`, {
        durationSeconds: 8,
        onUndo: async () => {
          if (data?.undoId) {
            await fetch(`/api/notifications?undo=${data.undoId}`, { method: "PUT" })
          }
          fetchLogs()
        },
      })
    } catch {
      toast.error("Failed to Clear Logs", "Server encountered an error while clearing buffer.", {
        status: 500,
        onRetry: () => handleClearLogs(),
      })
    }
  }

  const triggerHealthLog = async () => {
    try {
      const res = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          severity: "info",
          service: "health-probe",
          message: "Manual localhost health probe triggered by user",
          context: [
            { label: "initiator", value: "user-dashboard" },
            { label: "timestamp", value: new Date().toISOString() },
          ],
        }),
      })
      if (!res.ok) throw new Error("Health probe request failed")
      toast.success("Health Probe Executed", "Localhost server pinged successfully")
      fetchLogs()
    } catch {
      toast.error("Health Probe Failed", "Unable to ping localhost server API.", {
        status: 503,
        onRetry: () => triggerHealthLog(),
      })
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-6 space-y-4">
      {/* Header & Localhost Status Cockpit */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <TerminalIcon className="size-5 text-primary" />
            <h1 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Server Logs & Localhost Status
            </h1>
            <Badge variant="outline" className="ml-1 gap-1.5 font-mono text-[10px]">
              <span
                className={cn(
                  "size-2 rounded-full",
                  paused ? "bg-muted-foreground/60" : "animate-pulse bg-emerald-500"
                )}
              />
              {paused ? "paused" : "live"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Captures localhost API requests, database queries, vector syncs, and system reliability.
          </p>
        </div>

        {/* Health Telemetry Snapshot */}
        {health && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/80 bg-card/60 p-2 font-mono text-[11px]">
            <div className="flex items-center gap-1.5 px-1.5 text-muted-foreground">
              <ServerIcon className="size-3.5 text-primary" />
              <span>Heap: <strong className="text-foreground">{health.memory.heap_used_mb} MB</strong></span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-1.5 px-1.5 text-muted-foreground">
              <ActivityIcon className="size-3.5 text-emerald-500" />
              <span>Uptime: <strong className="text-foreground">{Math.round(health.uptime_seconds / 60)}m</strong></span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-1.5 px-1.5 text-muted-foreground">
              <span>Cavemem: <strong className={health.storage.cavemem_connected ? "text-emerald-500" : "text-amber-500"}>{health.storage.cavemem_connected ? "Ready" : "Demo"}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <InputGroup className="w-full sm:w-80">
          <InputGroupAddon>
            <span className="font-mono text-xs text-muted-foreground">$</span>
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Filter severity:error or service:api..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="font-mono text-xs"
            aria-label="Filter server logs"
          />
          <InputGroupAddon align="inline-end">
            <Kbd>Esc to clear</Kbd>
          </InputGroupAddon>
        </InputGroup>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPaused(!paused)}
            className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
          >
            {paused ? <PlayIcon className="size-3.5" /> : <PauseIcon className="size-3.5" />}
            <span>{paused ? "Resume" : "Pause"}</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={fetchLogs}
            disabled={loading}
            className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
          >
            <RefreshCwIcon className={cn("size-3.5", loading && "animate-spin")} />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={triggerHealthLog}
            className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
          >
            <span>Probe Health</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleClearLogs}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive cursor-pointer"
          >
            <Trash2Icon className="size-3.5" />
            <span>Clear</span>
          </Button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="overflow-hidden rounded-xl border border-border/80 bg-card font-mono shadow-xs">
        <Table className="text-xs">
          <TableHeader>
            <TableRow className="border-b border-border/60 bg-muted/20">
              <TableHead className="w-24 ps-4">Time</TableHead>
              <TableHead className="w-20">Level</TableHead>
              <TableHead className="w-28">Service</TableHead>
              <TableHead className="w-28">Request</TableHead>
              <TableHead>Message</TableHead>
              <TableHead className="w-16 pe-4 text-right">ms</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  No log entries matched this filter.
                </TableCell>
              </TableRow>
            ) : (
              filteredLogs.map((e) => {
                const s = SEVERITY_STYLES[e.severity] || SEVERITY_STYLES.info
                const active = selectedId === e.id
                return (
                  <TableRow
                    key={e.id}
                    onClick={() => setSelectedId(e.id)}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(evt) => {
                      if (evt.key === "Enter" || evt.key === " ") {
                        evt.preventDefault()
                        setSelectedId(e.id)
                      }
                    }}
                    className={cn(
                      "cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                      active
                        ? "bg-primary/10"
                        : e.severity === "error"
                          ? "bg-destructive/5 hover:bg-destructive/10"
                          : "hover:bg-muted/40"
                    )}
                  >
                    <TableCell className="ps-4 text-muted-foreground tabular-nums text-[11px]">
                      {e.ts}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        <span className={cn("size-1.5 rounded-full shrink-0", s.dot)} />
                        <span className={cn("text-[10px] uppercase tracking-wider", s.label)}>
                          {e.severity}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-foreground/90 font-medium">
                      {e.service}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-[11px]">
                      {e.request}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <span className="flex items-center gap-2">
                        {e.severity === "error" ? (
                          <CircleAlertIcon className="size-3.5 shrink-0 text-destructive" />
                        ) : e.severity === "warn" ? (
                          <FlameIcon className="size-3.5 shrink-0 text-amber-500" />
                        ) : (
                          <InfoIcon className="size-3.5 shrink-0 text-sky-500/80" />
                        )}
                        <span className="truncate font-sans font-medium text-foreground">
                          {e.message}
                        </span>
                        {e.status && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "ml-auto shrink-0 font-mono text-[9px] px-1.5 py-0",
                              e.status >= 400
                                ? "border-destructive/40 text-destructive bg-destructive/5"
                                : "text-muted-foreground"
                            )}
                          >
                            {e.status}
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="pe-4 text-right text-muted-foreground tabular-nums text-[11px]">
                      {e.duration !== undefined ? `${e.duration}` : "—"}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
        <span>
          Showing {filteredLogs.length} of {logs.length} logged events · streaming from localhost:4242
        </span>
        <span className="text-foreground/80">Click any row for detail inspector</span>
      </div>

      {/* Slide-Over Detail Sheet */}
      <LogDetailSheet
        entry={selected}
        onClose={() => setSelectedId(null)}
      />
    </div>
  )
}

function LogDetailSheet({
  entry,
  onClose,
}: {
  entry: LogEntry | null
  onClose: () => void
}) {
  return (
    <Sheet open={!!entry} onOpenChange={(open) => !open && onClose()}>
      <SheetPopup side="right" className="!max-w-xl border-l border-border bg-card p-0 shadow-2xl">
        {entry && (
          <>
            <SheetHeader className="border-b border-border/60 p-4 bg-muted/20">
              <SheetTitle className="flex items-center gap-2 font-mono text-sm">
                <span
                  className={cn(
                    "size-2 rounded-full shrink-0",
                    SEVERITY_STYLES[entry.severity].dot
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-wider",
                    SEVERITY_STYLES[entry.severity].label
                  )}
                >
                  {entry.severity}
                </span>
                <span className="text-foreground font-bold">{entry.request}</span>
                {entry.status && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-mono text-[10px]",
                      entry.status >= 400 ? "border-destructive/30 text-destructive" : ""
                    )}
                  >
                    {entry.status}
                  </Badge>
                )}
              </SheetTitle>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                {entry.iso} · {entry.service} {entry.serviceVersion} · {entry.region}
              </p>
            </SheetHeader>

            <SheetPanel className="flex flex-col gap-5 overflow-y-auto p-5">
              {/* Message Section */}
              <LogSection title="Message" copyValue={entry.message}>
                <pre className="whitespace-pre-wrap rounded-md border border-border/60 bg-muted/30 p-3 font-mono text-[12px] leading-relaxed text-foreground">
                  {entry.message}
                </pre>
              </LogSection>

              {/* Identifiers Section */}
              <LogSection title="Identifiers">
                <LogKeyVal label="Request" value={entry.request} mono copy />
                <LogKeyVal label="Trace ID" value={entry.traceId} mono copy />
                <LogKeyVal label="Service" value={`${entry.service} (${entry.serviceVersion})`} mono />
                <LogKeyVal label="Region / Host" value={entry.region} mono />
              </LogSection>

              {/* Context Key-Values */}
              {entry.context && entry.context.length > 0 && (
                <LogSection title="Context Metadata">
                  {entry.context.map((c) => (
                    <LogKeyVal key={c.label} label={c.label} value={c.value} mono />
                  ))}
                </LogSection>
              )}

              {/* Timing Breakdown */}
              {entry.timing && entry.timing.length > 0 && (
                <LogSection title="Timing Breakdown" hint={`${entry.duration ?? 0}ms total`}>
                  <ul className="flex flex-col gap-2">
                    {entry.timing.map((t) => (
                      <li key={t.label}>
                        <div className="flex items-baseline justify-between font-mono text-[11px]">
                          <span className="text-muted-foreground">{t.label}</span>
                          <span className="tabular-nums font-semibold">{t.ms}ms</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.max(4, t.share)}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </LogSection>
              )}

              {/* Payload Viewer */}
              {entry.payload && (
                <LogSection title="Payload" copyValue={entry.payload.body}>
                  <pre className="overflow-x-auto rounded-md border border-border/60 bg-muted/30 p-3 font-mono text-[11px] leading-relaxed text-foreground">
                    {entry.payload.body}
                  </pre>
                </LogSection>
              )}

              {/* Stack Trace */}
              {entry.stack && entry.stack.length > 0 && (
                <LogSection title="Stack Trace">
                  <ol className="overflow-hidden rounded-md border border-border/60 bg-muted/30">
                    {entry.stack.map((line, i) => (
                      <li
                        key={i}
                        className="flex items-baseline gap-3 border-b border-border/40 px-3 py-1.5 font-mono text-[11px] last:border-b-0 text-foreground/90"
                      >
                        <span className="w-5 text-right text-muted-foreground/60 tabular-nums">
                          {i + 1}
                        </span>
                        <span className="flex-1 truncate">{line}</span>
                      </li>
                    ))}
                  </ol>
                </LogSection>
              )}
            </SheetPanel>
          </>
        )}
      </SheetPopup>
    </Sheet>
  )
}

function LogSection({
  title,
  hint,
  copyValue,
  children,
}: {
  title: string
  hint?: string
  copyValue?: string
  children: React.ReactNode
}) {
  const [copied, setCopied] = React.useState(false)

  return (
    <section className="space-y-1.5">
      <header className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h3 className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {title}
          </h3>
          {hint && (
            <span className="font-mono text-[10px] text-muted-foreground/70">
              ({hint})
            </span>
          )}
        </div>
        {copyValue && (
          <button
            type="button"
            onClick={() => {
              try {
                navigator.clipboard.writeText(copyValue)
                setCopied(true)
                setTimeout(() => setCopied(false), 1200)
              } catch {
                /* ignore */
              }
            }}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
          >
            {copied ? <CheckIcon className="size-3 text-emerald-500" /> : <CopyIcon className="size-3" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        )}
      </header>
      <div className="space-y-1">{children}</div>
    </section>
  )
}

function LogKeyVal({
  label,
  value,
  mono,
  copy,
}: {
  label: string
  value: string
  mono?: boolean
  copy?: boolean
}) {
  const [copied, setCopied] = React.useState(false)

  return (
    <div className="group flex items-baseline justify-between gap-3 rounded-md px-2 py-1 transition-colors hover:bg-muted/40">
      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className={cn(
            "max-w-[280px] truncate text-foreground",
            mono ? "font-mono text-[11px]" : "text-xs font-medium"
          )}
        >
          {value}
        </span>
        {copy && (
          <button
            type="button"
            onClick={() => {
              try {
                navigator.clipboard.writeText(value)
                setCopied(true)
                setTimeout(() => setCopied(false), 1200)
              } catch {
                /* ignore */
              }
            }}
            aria-label={`Copy ${label}`}
            className="inline-flex size-5 items-center justify-center rounded text-muted-foreground/50 opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 cursor-pointer"
          >
            {copied ? <CheckIcon className="size-3 text-emerald-500" /> : <CopyIcon className="size-3" />}
          </button>
        )}
      </span>
    </div>
  )
}
