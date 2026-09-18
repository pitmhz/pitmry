"use client"

import * as React from "react"
import { type ToastRichAction } from "@/components/toasts/toast-rich"

export type ToastType = "success" | "error_retry" | "info_banner" | "undo" | "rich"

export interface ToastItem {
  id: string
  type: ToastType
  title: string
  message?: string
  body?: string
  status?: number | string
  onRetry?: () => void | Promise<void>
  banner?: boolean
  actionLabel?: string
  onAction?: () => void
  durationSeconds?: number
  onUndo?: () => void | Promise<void>
  meta?: string
  avatar?: { initials: string; tone?: string }
  actions?: ToastRichAction[]
  duration?: number
  createdAt: number
}

interface ToastContextValue {
  toasts: ToastItem[]
  dismissToast: (id: string) => void
  clearAllToasts: () => void
  toast: {
    success: (title: string, message?: string, options?: Partial<ToastItem>) => string
    error: (
      title: string,
      message?: string,
      options?: { status?: number | string; onRetry?: () => void | Promise<void> } & Partial<ToastItem>
    ) => string
    info: (
      title: string,
      message?: string,
      options?: { banner?: boolean; actionLabel?: string; onAction?: () => void } & Partial<ToastItem>
    ) => string
    undo: (
      title: string,
      message: string,
      options: { durationSeconds?: number; onUndo: () => void | Promise<void> } & Partial<ToastItem>
    ) => string
    rich: (
      title: string,
      body: string,
      options?: { meta?: string; avatar?: { initials: string; tone?: string }; actions?: ToastRichAction[] } & Partial<ToastItem>
    ) => string
  }
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

export function NotificationToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([])

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const clearAllToasts = React.useCallback(() => {
    setToasts([])
  }, [])

  const addToast = React.useCallback(
    (item: Omit<ToastItem, "id" | "createdAt">): string => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      const fullItem: ToastItem = {
        ...item,
        id,
        createdAt: Date.now(),
      }

      setToasts((prev) => [fullItem, ...prev.slice(0, 4)]) // Keep maximum 5 active toasts

      // Auto-dismiss standard toasts (success, info when not banner, rich)
      const duration = item.duration ?? 6500
      if (item.type !== "undo" && !item.banner && duration > 0) {
        setTimeout(() => {
          dismissToast(id)
        }, duration)
      }

      return id
    },
    [dismissToast]
  )

  const toastMethods = React.useMemo(
    () => ({
      success: (title: string, message?: string, options?: Partial<ToastItem>) =>
        addToast({
          type: "success",
          title,
          message,
          ...options,
        }),
      error: (
        title: string,
        message?: string,
        options?: { status?: number | string; onRetry?: () => void | Promise<void> } & Partial<ToastItem>
      ) => {
        const { status = 500, onRetry, duration = 9000, ...rest } = options || {}
        return addToast({
          type: "error_retry",
          title,
          message,
          status,
          onRetry,
          duration,
          ...rest,
        })
      },
      info: (
        title: string,
        message?: string,
        options?: { banner?: boolean; actionLabel?: string; onAction?: () => void } & Partial<ToastItem>
      ) => {
        const { banner = false, actionLabel, onAction, duration, ...rest } = options || {}
        return addToast({
          type: "info_banner",
          title,
          message: message || "",
          banner,
          actionLabel,
          onAction,
          duration: duration ?? (banner ? 0 : 7000),
          ...rest,
        })
      },
      undo: (
        title: string,
        message: string,
        options: { durationSeconds?: number; onUndo: () => void | Promise<void> } & Partial<ToastItem>
      ) => {
        const { durationSeconds = 8, onUndo, duration, ...rest } = options
        return addToast({
          type: "undo",
          title,
          message,
          durationSeconds,
          onUndo,
          duration: duration ?? (durationSeconds * 1000 + 1500),
          ...rest,
        })
      },
      rich: (
        title: string,
        body: string,
        options?: { meta?: string; avatar?: { initials: string; tone?: string }; actions?: ToastRichAction[] } & Partial<ToastItem>
      ) => {
        const { meta = "just now", avatar, actions, duration = 8000, ...rest } = options || {}
        return addToast({
          type: "rich",
          title,
          body,
          meta,
          avatar,
          actions,
          duration,
          ...rest,
        })
      },
    }),
    [addToast]
  )

  return (
    <ToastContext.Provider
      value={{
        toasts,
        dismissToast,
        clearAllToasts,
        toast: toastMethods,
      }}
    >
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a NotificationToastProvider")
  }
  return context
}
