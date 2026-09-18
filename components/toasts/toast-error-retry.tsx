"use client"

import * as React from "react"
import { AlertCircleIcon, RotateCcwIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface ToastErrorRetryProps {
  id?: string
  title: string
  message?: string
  status?: number | string
  onRetry?: () => void | Promise<void>
  onDismiss?: () => void
  className?: string
}

export function ToastErrorRetry({
  title,
  message,
  status = "500",
  onRetry,
  onDismiss,
  className,
}: ToastErrorRetryProps) {
  const [retrying, setRetrying] = React.useState(false)

  const handleRetry = async () => {
    if (!onRetry) return
    setRetrying(true)
    try {
      await onRetry()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "rounded-xl border border-destructive/40 bg-card/95 shadow-xl backdrop-blur-md transition-all animate-in fade-in-0 slide-in-from-bottom-3 w-84 sm:w-96 overflow-hidden text-left",
        className
      )}
    >
      <div className="flex items-start gap-3 p-3.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive mt-0.5">
          <AlertCircleIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-heading text-sm font-semibold text-foreground tracking-tight">
              {title}
            </span>
            {status && (
              <Badge
                variant="outline"
                className="rounded bg-destructive/10 border-destructive/30 px-1.5 py-0 font-mono text-[9px] font-bold text-destructive uppercase tracking-wider"
              >
                {status}
              </Badge>
            )}
          </div>
          {message && (
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {message}
            </p>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss error"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none cursor-pointer"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/20 px-3 py-2">
        {onDismiss && (
          <Button
            size="sm"
            variant="ghost"
            type="button"
            onClick={onDismiss}
            className="h-7 text-xs text-muted-foreground"
          >
            Dismiss
          </Button>
        )}
        {onRetry && (
          <Button
            size="sm"
            variant="outline"
            type="button"
            disabled={retrying}
            onClick={handleRetry}
            className="h-7 gap-1.5 text-xs font-semibold border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
          >
            <RotateCcwIcon className={cn("size-3", retrying && "animate-spin")} />
            <span>{retrying ? "Retrying..." : "Retry"}</span>
          </Button>
        )}
      </div>
    </div>
  )
}
