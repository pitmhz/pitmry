import fs from "fs"
import path from "path"
import os from "os"

export type Severity = "debug" | "info" | "warn" | "error"

export interface LogEntry {
  id: string
  ts: string
  iso: string
  severity: Severity
  service: string
  serviceVersion: string
  request: string
  traceId: string
  message: string
  status?: number
  duration?: number
  region: string
  context: { label: string; value: string }[]
  payload?: { kind: "json" | "text"; body: string }
  timing?: { label: string; ms: number; share: number }[]
  stack?: string[]
}

const MAX_LOGS = 200
const LOG_DIR = path.join(process.cwd(), ".pitmry")
const LOG_FILE = path.join(LOG_DIR, "server.log")

// Global in-memory ring buffer surviving hot reloads
declare global {
  var __pitmry_logs__: LogEntry[] | undefined
  var __pitmry_initialized__: boolean | undefined
}

if (!global.__pitmry_logs__) {
  global.__pitmry_logs__ = []
}

function formatTs(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0")
  const mins = String(date.getMinutes()).padStart(2, "0")
  const secs = String(date.getSeconds()).padStart(2, "0")
  const ms = String(date.getMilliseconds()).padStart(3, "0")
  return `${hours}:${mins}:${secs}.${ms}`
}

function ensureLogDir() {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true })
    }
  } catch {
    /* ignore */
  }
}

export function logServerEvent(entry: Partial<LogEntry> & { message: string }): LogEntry {
  const now = new Date()
  const fullEntry: LogEntry = {
    id: entry.id || `e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ts: entry.ts || formatTs(now),
    iso: entry.iso || now.toISOString(),
    severity: entry.severity || "info",
    service: entry.service || "api",
    serviceVersion: entry.serviceVersion || "v0.1.0",
    request: entry.request || `req_${Math.random().toString(36).slice(2, 7)}`,
    traceId: entry.traceId || `tr_${Math.random().toString(36).slice(2, 10)}`,
    message: entry.message,
    status: entry.status,
    duration: entry.duration,
    region: entry.region || "localhost:4242",
    context: entry.context || [],
    payload: entry.payload,
    timing: entry.timing,
    stack: entry.stack,
  }

  // Add to in-memory buffer (newest first)
  const logs = global.__pitmry_logs__!
  logs.unshift(fullEntry)
  if (logs.length > MAX_LOGS) {
    logs.length = MAX_LOGS
  }

  // Persist asynchronously to local log file
  ensureLogDir()
  try {
    fs.appendFile(LOG_FILE, JSON.stringify(fullEntry) + "\n", () => {})
  } catch {
    /* ignore */
  }

  return fullEntry
}

export function getServerLogs(filters?: {
  severity?: string
  service?: string
  query?: string
  limit?: number
}): LogEntry[] {
  // Initialize sample logs if empty
  if (!global.__pitmry_initialized__) {
    initializeStartupLogs()
  }

  let result = [...global.__pitmry_logs__!]

  if (filters?.severity && filters.severity !== "all") {
    result = result.filter((l) => l.severity === filters.severity)
  }

  if (filters?.service && filters.service !== "all") {
    result = result.filter((l) => l.service.toLowerCase().includes(filters.service!.toLowerCase()))
  }

  if (filters?.query) {
    const q = filters.query.toLowerCase().trim()
    result = result.filter(
      (l) =>
        l.message.toLowerCase().includes(q) ||
        l.service.toLowerCase().includes(q) ||
        l.request.toLowerCase().includes(q) ||
        l.context.some((c) => c.value.toLowerCase().includes(q))
    )
  }

  const limit = Math.min(filters?.limit || 50, MAX_LOGS)
  return result.slice(0, limit)
}

export function clearServerLogs() {
  global.__pitmry_logs__ = []
  try {
    ensureLogDir()
    fs.writeFileSync(LOG_FILE, "")
  } catch {
    /* ignore */
  }
}

function initializeStartupLogs() {
  global.__pitmry_initialized__ = true

  // 1. System boot log
  logServerEvent({
    severity: "info",
    service: "system",
    message: `Pitmry server boot: Node ${process.version}, platform ${process.platform} (${os.arch()})`,
    context: [
      { label: "node", value: process.version },
      { label: "platform", value: process.platform },
      { label: "arch", value: os.arch() },
      { label: "cpus", value: String(os.cpus().length) },
      { label: "total_mem", value: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB` },
    ],
  })

  // 2. Storage check log
  const cavememDb = process.env.CAVEMEM_DB_PATH || path.join(os.homedir(), ".cavemem", "data.db")
  const cavememExists = fs.existsSync(cavememDb)
  logServerEvent({
    severity: cavememExists ? "info" : "warn",
    service: "sqlite",
    message: cavememExists
      ? `Cavemem SQLite database connected: ${cavememDb} (${(fs.statSync(cavememDb).size / 1024).toFixed(1)} KB)`
      : `Cavemem database not found at ${cavememDb} — running demo mode fallback`,
    context: [
      { label: "path", value: cavememDb },
      { label: "status", value: cavememExists ? "ready" : "missing" },
    ],
  })

  // 3. LanceDB check log
  const lancedbDir = process.env.LANCEDB_DIR || path.join(os.homedir(), ".strategic_memory", "lancedb")
  const lancedbExists = fs.existsSync(lancedbDir)
  logServerEvent({
    severity: lancedbExists ? "info" : "warn",
    service: "lancedb",
    message: lancedbExists
      ? `LanceDB columnar vector store connected at ${lancedbDir}`
      : `LanceDB directory not found at ${lancedbDir}`,
    context: [
      { label: "directory", value: lancedbDir },
      { label: "storage", value: "lancedb-columnar" },
    ],
  })

  // 4. Localhost health log
  logServerEvent({
    severity: "debug",
    service: "health-monitor",
    message: "Localhost health diagnostics daemon initialized on port 4242",
    context: [
      { label: "port", value: "4242" },
      { label: "hostname", value: "localhost" },
      { label: "probe_interval", value: "60s" },
    ],
  })
}
