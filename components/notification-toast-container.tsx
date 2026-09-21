"use client"

import * as React from "react"
import { useToast, type ToastItem } from "@/lib/notification-toast-context"
import type { BackendNotification } from "@/app/api/notifications/route"
import type { NotificationItem } from "@/components/timelines-notifications"
import type { MemoryItem } from "@/lib/types"
import { ToastSuccess } from "@/components/toasts/toast-success"
import { ToastErrorRetry } from "@/components/toasts/toast-error-retry"
import { ToastInfoBanner } from "@/components/toasts/toast-info-banner"
import { ToastUndo } from "@/components/toasts/toast-undo"
import { ToastRich } from "@/components/toasts/toast-rich"

export function NotificationToastContainer({
  onInspectNotification,
}: {
  onInspectNotification?: (item: NotificationItem | MemoryItem) => void
} = {}) {
  const { toasts, dismissToast, toast } = useToast()
  const lastProcessedIdRef = React.useRef<string | null>(null)
  const lastMemoryIdRef = React.useRef<string | null>(null)

  // Listen for Escape key to dismiss the latest toast
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && toasts.length > 0) {
        dismissToast(toasts[0].id)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [toasts, dismissToast])

  // Periodic polling for backend-emitted notifications and memory updates
  React.useEffect(() => {
    let active = true

    const pollBackendNotifications = async () => {
      try {
        const res = await fetch("/api/notifications?unread=true&limit=5", { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        const items = (data.notifications || []) as BackendNotification[]

        if (items.length > 0 && active) {
          const newest = items[0]
          if (!lastProcessedIdRef.current) {
            // First run, initialize pointer without toast spam
            lastProcessedIdRef.current = newest.id
          } else if (newest.id !== lastProcessedIdRef.current) {
            // New notification from backend
            for (const item of items) {
              if (item.id === lastProcessedIdRef.current) break
              // Dispatch to appropriate toast variant
              if (item.type === "success") {
                toast.success(item.title, item.message ?? undefined)
              } else if (item.type === "error_retry") {
                toast.error(item.title, item.message ?? undefined, { status: item.status })
              } else if (item.type === "info_banner") {
                toast.info(item.title, item.message ?? undefined, { banner: item.banner })
              } else if (item.type === "undo") {
                toast.undo(item.title, item.message ?? "", {
                  durationSeconds: item.durationSeconds || 8,
                  onUndo: async () => {
                    await fetch(`/api/notifications?undo=${item.id}`, { method: "PUT" })
                  },
                })
              } else {
                const actions: Array<{ label: string; primary?: boolean; onClick: () => void }> = []
                if (item.item_id && onInspectNotification) {
                  actions.push({
                    label: "Inspect",
                    primary: true,
                    onClick: () => onInspectNotification(item as unknown as NotificationItem),
                  })
                }
                toast.rich(item.title, item.message || "", {
                  meta: item.meta || "just now",
                  avatar: item.avatar,
                  actions: actions.length > 0 ? actions : undefined,
                })
              }
            }
            lastProcessedIdRef.current = newest.id
          }
        }
      } catch {
        /* ignore */
      }
    }

    const pollMemoryNotifications = async () => {
      try {
        const res = await fetch("/api/memory?action=notifications", { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        const items = (data.notifications || []) as MemoryItem[]

        if (items.length > 0 && active) {
          const newest = items[0]
          if (!lastMemoryIdRef.current) {
            lastMemoryIdRef.current = newest.id
          } else if (newest.id !== lastMemoryIdRef.current) {
            const newItems: MemoryItem[] = []
            for (const it of items) {
              if (it.id === lastMemoryIdRef.current) break
              newItems.push(it)
            }
            lastMemoryIdRef.current = newest.id

            for (const it of newItems.slice(0, 2)) {
              toast.rich(
                `${it.who || "Agent"} ${it.what || "updated item"}`,
                it.context || `${it.project || "pitmry"} update`,
                {
                  meta: it.project || "just now",
                  avatar: { initials: (it.who || "AG").slice(0, 2).toUpperCase() },
                  actions: onInspectNotification
                    ? [
                        {
                          label: "Inspect",
                          primary: true,
                          onClick: () => onInspectNotification(it as NotificationItem | MemoryItem),
                        },
                      ]
                    : undefined,
                }
              )
            }
          }
        }
      } catch {
        /* ignore */
      }
    }

    pollBackendNotifications()
    pollMemoryNotifications()

    const interval = setInterval(() => {
      pollBackendNotifications()
      pollMemoryNotifications()
    }, 8000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [toast, onInspectNotification])

  const stickyBanners = toasts.filter((t) => t.type === "info_banner" && t.banner === true)
  const floatingToasts = toasts.filter((t) => !(t.type === "info_banner" && t.banner === true))

  return (
    <>
      {/* Top Sticky Banners */}
      {stickyBanners.length > 0 && (
        <div className="fixed top-0 inset-x-0 z-50 flex flex-col pointer-events-auto">
          {stickyBanners.map((t) => (
            <ToastInfoBanner
              key={t.id}
              title={t.title}
              message={t.message || ""}
              banner={true}
              actionLabel={t.actionLabel}
              onAction={t.onAction}
              onDismiss={() => dismissToast(t.id)}
            />
          ))}
        </div>
      )}

      {/* Floating Notifications Stack (Bottom-Right) */}
      <div
        role="region"
        aria-label="Notifications"
        className="fixed bottom-5 right-5 z-50 flex flex-col-reverse gap-2.5 pointer-events-auto max-w-full"
      >
        {floatingToasts.map((t) => {
          switch (t.type) {
            case "success":
              return (
                <ToastSuccess
                  key={t.id}
                  title={t.title}
                  message={t.message}
                  onDismiss={() => dismissToast(t.id)}
                />
              )
            case "error_retry":
              return (
                <ToastErrorRetry
                  key={t.id}
                  title={t.title}
                  message={t.message}
                  status={t.status}
                  onRetry={t.onRetry}
                  onDismiss={() => dismissToast(t.id)}
                />
              )
            case "info_banner":
              return (
                <ToastInfoBanner
                  key={t.id}
                  title={t.title}
                  message={t.message || ""}
                  banner={false}
                  actionLabel={t.actionLabel}
                  onAction={t.onAction}
                  onDismiss={() => dismissToast(t.id)}
                />
              )
            case "undo":
              return (
                <ToastUndo
                  key={t.id}
                  title={t.title}
                  message={t.message}
                  durationSeconds={t.durationSeconds}
                  onUndo={t.onUndo || (() => {})}
                  onDismiss={() => dismissToast(t.id)}
                />
              )
            case "rich":
              return (
                <ToastRich
                  key={t.id}
                  title={t.title}
                  body={t.message || ""}
                  meta={t.meta}
                  avatar={t.avatar}
                  actions={t.actions}
                  onDismiss={() => dismissToast(t.id)}
                />
              )
            default:
              return null
          }
        })}
      </div>
    </>
  )
}
