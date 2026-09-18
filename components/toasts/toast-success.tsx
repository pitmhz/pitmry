"use client"

import * as React from "react"
import { CheckIcon, XIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ToastSuccessProps {
  id?: string
  title: string
  message?: string
  onDismiss?: () => void
  className?: string
}

export function ToastSuccess({
  title,
  message,
  onDismiss,
  className,
}: ToastSuccessProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border/80 bg-card/95 p-3.5 shadow-xl backdrop-blur-md transition-all animate-in fade-in-0 slide-in-from-bottom-3 w-80 sm:w-96 text-left",
        className
      )}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        <CheckIcon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-heading text-sm font-semibold text-foreground tracking-tight">
          {title}
        </div>
        {message && (
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {message}
          </p>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none cursor-pointer"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  )
}
