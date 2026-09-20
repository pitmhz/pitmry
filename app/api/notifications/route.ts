import { NextRequest, NextResponse } from "next/server"
import { requireMutationAuth, clampLimit } from "@/lib/request-guard"

export interface BackendNotification {
  id: string
  type: "success" | "error_retry" | "info_banner" | "undo" | "rich"
  title: string
  message?: string
  status?: number | string
  banner?: boolean
  durationSeconds?: number
  meta?: string
  avatar?: { initials: string; tone?: string }
  unread: boolean
  createdAt: number
  undoActionId?: string
}

// Global notification queue surviving hot reloads
declare global {
  var __pitmry_notifications__: BackendNotification[] | undefined
  var __pitmry_undo_store__: Map<string, () => void | Promise<void>> | undefined
}

if (!global.__pitmry_notifications__) {
  global.__pitmry_notifications__ = [
    {
      id: "notif_welcome",
      type: "rich",
      title: "Pitmry Observability Online",
      message: "LanceDB and Cavemem databases connected to local dashboard.",
      meta: "just now",
      avatar: { initials: "PI", tone: "bg-primary text-primary-foreground" },
      unread: true,
      createdAt: Date.now(),
    },
  ]
}

if (!global.__pitmry_undo_store__) {
  global.__pitmry_undo_store__ = new Map()
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const unreadOnly = searchParams.get("unread") === "true"
  const limit = clampLimit(searchParams.get("limit"), 20, 50);

  let list = global.__pitmry_notifications__ || []
  if (unreadOnly) {
    list = list.filter((n) => n.unread)
  }

  const unreadCount = (global.__pitmry_notifications__ || []).filter((n) => n.unread).length

  return NextResponse.json({
    notifications: list.slice(0, limit),
    total: list.length,
    unread_count: unreadCount,
  })
}

export async function POST(request: NextRequest) {
  const denied = requireMutationAuth(request);
  if (denied) return denied;
  try {
    const body = await request.json()
    if (!body.title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 })
    }

    const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const notif: BackendNotification = {
      id,
      type: body.type || "success",
      title: body.title,
      message: body.message,
      status: body.status,
      banner: body.banner ?? false,
      durationSeconds: body.durationSeconds,
      meta: body.meta || "just now",
      avatar: body.avatar,
      unread: true,
      createdAt: Date.now(),
    }

    global.__pitmry_notifications__!.unshift(notif)
    if (global.__pitmry_notifications__!.length > 50) {
      global.__pitmry_notifications__!.length = 50
    }

    return NextResponse.json({ success: true, notification: notif }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create notification" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const denied = requireMutationAuth(request);
  if (denied) return denied;
  const { searchParams } = new URL(request.url)
  const undoId = searchParams.get("undo")
  const markRead = searchParams.get("mark_read")
  const id = searchParams.get("id")

  if (undoId) {
    const action = global.__pitmry_undo_store__?.get(undoId)
    if (action) {
      await action()
      global.__pitmry_undo_store__?.delete(undoId)
      return NextResponse.json({ success: true, undone: true })
    }
    return NextResponse.json({ success: false, message: "Undo action expired" })
  }

  if (markRead === "all") {
    for (const n of global.__pitmry_notifications__ || []) {
      n.unread = false
    }
    return NextResponse.json({ success: true, marked_all_read: true })
  }

  if (id) {
    const target = global.__pitmry_notifications__?.find((n) => n.id === id)
    if (target) target.unread = false
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: "Missing action parameter" }, { status: 400 })
}

export async function DELETE(request: NextRequest) {
  const denied = requireMutationAuth(request);
  if (denied) return denied;
  global.__pitmry_notifications__ = []
  return NextResponse.json({ success: true, message: "Notifications cleared" })
}
