"use client"

import * as React from "react"
import { InfoIcon, XIcon, ExternalLinkIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface ToastInfoBannerProps {
  id?: string
  title: string
  message: string
  banner?: boolean
  actionLabel?: string
  onAction?: () => void
  onDismiss?: () => void
  className?: string
}

export function ToastInfoBanner({
  title,
  message,
  banner = false,
  actionLabel,
  onAction,
  onDismiss,
  className,
}: ToastInfoBannerProps) {
  if (banner) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "sticky top-0 z-50 border-b border-amber-500/40 bg-amber-500/10 backdrop-blur-md dark:bg-amber-500/[0.08] transition-all animate-in fade-in-0 duration-150",
          className
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 sm:px-6 py-2">
          <InfoIcon className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="flex-1 truncate text-xs sm:text-sm text-foreground">
            <strong className="font-semibold text-amber-700 dark:text-amber-300">
              {title}
            </strong>{" "}
            <span className="text-muted-foreground">· {message}</span>
          </p>
          {actionLabel && onAction && (
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={onAction}
              className="h-7 gap-1 px-2.5 text-xs text-amber-700 hover:bg-amber-500/15 dark:text-amber-300 cursor-pointer font-medium"
            >
              <span>{actionLabel}</span>
              <ExternalLinkIcon className="size-3" />
            </Button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss banner"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-amber-500/15 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none cursor-pointer"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    )
  }

  // Floating Card Mode
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-3 rounded-xl border border-amber-500/40 bg-card/95 p-3.5 shadow-xl backdrop-blur-md transition-all animate-in fade-in-0 slide-in-from-bottom-3 w-84 sm:w-96 text-left",
        className
      )}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 mt-0.5">
        <InfoIcon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-heading text-sm font-semibold text-foreground tracking-tight">
          {title}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {message}
        </p>
        {actionLabel && onAction && (
          <div className="mt-2">
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={onAction}
              className="h-6 px-2 text-[11px] font-semibold text-amber-600 hover:bg-amber-500/15 dark:text-amber-400 cursor-pointer"
            >
              {actionLabel}
            </Button>
          </div>
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
