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
          "sticky top-0 z-50 border-b border-warning bg-warning backdrop-blur-md bg-warning/[0.08] transition-all animate-in fade-in-0 duration-150",
          className
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 sm:px-6 py-2">
          <InfoIcon className="size-4 shrink-0 text-warning text-warning" />
          <p className="flex-1 truncate text-xs sm:text-sm text-foreground">
            <strong className="font-semibold text-warning text-warning">
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
              className="h-7 gap-1 px-2.5 text-xs text-warning hover:bg-warning text-warning cursor-pointer font-medium"
            >
              <span>{actionLabel}</span>
              <ExternalLinkIcon className="size-3" />
            </Button>
          )}
          {onDismiss && (
            <Button
              variant="ghost"
              size="icon-xs"
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss banner"
              className="text-muted-foreground hover:bg-warning hover:text-foreground"
            >
              <XIcon className="size-3.5" />
            </Button>
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
        "flex items-start gap-3 rounded-xl border border-warning bg-card/95 p-3.5 shadow-xl backdrop-blur-md transition-all animate-in fade-in-0 slide-in-from-bottom-3 w-84 sm:w-96 text-left",
        className
      )}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-warning text-warning text-warning mt-0.5">
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
              className="h-6 px-2 text-[11px] font-semibold text-warning hover:bg-warning text-warning cursor-pointer"
            >
              {actionLabel}
            </Button>
          </div>
        )}
      </div>
      {onDismiss && (
        <Button
          variant="ghost"
          size="icon-xs"
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="text-muted-foreground hover:text-foreground"
        >
          <XIcon className="size-3.5" />
        </Button>
      )}
    </div>
  )
}
