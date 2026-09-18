import { NextRequest, NextResponse } from "next/server"
import { getServerLogs, logServerEvent, clearServerLogs } from "@/lib/server-logger"
import os from "os"
import fs from "fs"
import path from "path"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const severity = searchParams.get("severity") || undefined
  const service = searchParams.get("service") || undefined
  const query = searchParams.get("query") || undefined
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50

  const logs = getServerLogs({
    severity,
    service,
    query,
    limit,
  })

  // Basic localhost health status
  const cavememDb = process.env.CAVEMEM_DB_PATH || path.join(os.homedir(), ".cavemem", "data.db")
  const lancedbDir = process.env.LANCEDB_DIR || path.join(os.homedir(), ".strategic_memory", "lancedb")

  const health = {
    status: "healthy",
    uptime_seconds: Math.round(process.uptime()),
    memory: {
      heap_used_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      system_free_mb: Math.round(os.freemem() / 1024 / 1024),
    },
    storage: {
      cavemem_connected: fs.existsSync(cavememDb),
      lancedb_connected: fs.existsSync(lancedbDir),
    },
    active_connections: 1,
    checked_at: new Date().toISOString(),
  }

  return NextResponse.json({
    logs,
    total: logs.length,
    health,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 })
    }

    const entry = logServerEvent(body)
    return NextResponse.json({ success: true, entry }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to log event" }, { status: 500 })
  }
}

export async function DELETE() {
  const previousLogs = [...(global.__pitmry_logs__ || [])]
  clearServerLogs()

  const undoId = `undo_logs_${Date.now()}`
  if (global.__pitmry_undo_store__) {
    global.__pitmry_undo_store__.set(undoId, () => {
      global.__pitmry_logs__ = previousLogs
    })
  }

  if (global.__pitmry_notifications__) {
    global.__pitmry_notifications__.unshift({
      id: undoId,
      type: "undo",
      title: "Server Logs Cleared",
      message: `${previousLogs.length} log events cleared from buffer`,
      durationSeconds: 8,
      unread: true,
      createdAt: Date.now(),
      undoActionId: undoId,
    })
  }

  return NextResponse.json({
    success: true,
    message: "Server logs cleared",
    undoId,
  })
}
