"use client"

import * as React from "react"
import { RotateCcwIcon, XIcon, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface ToastUndoProps {
  id?: string
  title: string
  message?: string
  durationSeconds?: number
  onUndo: () => void | Promise<void>
  onDismiss?: () => void
  className?: string
}

export function ToastUndo({
  title,
  message,
  durationSeconds = 8,
  onUndo,
  onDismiss,
  className,
}: ToastUndoProps) {
  const [remaining, setRemaining] = React.useState(durationSeconds)
  const [undone, setUndone] = React.useState(false)

  React.useEffect(() => {
    if (undone) return
    const interval = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 0.05) {
          clearInterval(interval)
          onDismiss?.()
          return 0
        }
        return r - 0.05
      })
    }, 50)
    return () => window.clearInterval(interval)
  }, [undone, onDismiss])

  const handleUndoClick = async () => {
    setUndone(true)
    try {
      await onUndo()
    } finally {
      setTimeout(() => {
        onDismiss?.()
      }, 1000)
    }
  }

  const pct = Math.max(0, (remaining / durationSeconds) * 100)

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "overflow-hidden rounded-xl border border-foreground/15 bg-foreground text-background shadow-2xl transition-all animate-in fade-in-0 slide-in-from-bottom-3 w-84 sm:w-96 text-left",
        className
      )}
    >
      <div className="flex items-center gap-3 px-3.5 py-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-background/15">
          {undone ? (
            <CheckCircle2 className="size-3.5 text-emerald-400" />
          ) : (
            <RotateCcwIcon className="size-3.5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-heading text-xs sm:text-sm font-semibold tracking-tight">
            {undone ? "Action Undone" : title}
          </div>
          {message && (
            <p className="mt-0.5 truncate text-[11px] opacity-75">
              {message}
            </p>
          )}
        </div>
        {!undone && (
          <Button
            variant="secondary"
            size="xs"
            type="button"
            onClick={handleUndoClick}
            className="font-mono text-xs font-bold h-7 px-2.5"
          >
            Undo
          </Button>
        )}
        {onDismiss && (
          <Button
            variant="ghost"
            size="icon-xs"
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss notification"
            className="opacity-60 hover:opacity-100 text-background"
          >
            <XIcon className="size-3.5" />
          </Button>
        )}
      </div>

      {/* Progress Bar */}
      {!undone && (
        <div className="h-0.5 bg-background/15">
          <div
            className="h-full bg-background/60 transition-[width] duration-100"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {!undone && (
        <div className="px-3 py-1 text-center font-mono text-[10px] font-medium uppercase tracking-wider opacity-75 bg-black/10">
          {remaining > 0 ? `${remaining.toFixed(1)}s left to undo` : "Action confirmed"}
        </div>
      )}
    </div>
  )
}
