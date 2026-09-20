"use client"

import * as React from "react"
import { XIcon, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface ToastRichAction {
  label: string
  primary?: boolean
  onClick?: () => void
}

export interface ToastRichProps {
  id?: string
  Icon?: React.ComponentType<{ className?: string }>
  badgeTone?: string
  title: string
  body: string
  meta?: string
  actions?: ToastRichAction[]
  avatar?: { initials: string; tone?: string }
  onDismiss?: () => void
  className?: string
}

export function ToastRich({
  Icon = Bell,
  badgeTone = "bg-secondary text-foreground",
  title,
  body,
  meta = "just now",
  actions,
  avatar,
  onDismiss,
  className,
}: ToastRichProps) {
  return (
    <article
      role="status"
      aria-live="polite"
      className={cn(
        "rounded-xl border border-border/80 bg-card/95 p-3.5 shadow-xl backdrop-blur-md transition-all animate-in fade-in-0 slide-in-from-bottom-3 w-84 sm:w-96 text-left",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {avatar && (
          <div
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full font-mono font-bold text-[11px] shadow-xs select-none",
              avatar.tone || "bg-primary text-primary-foreground"
            )}
          >
            {avatar.initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full",
                badgeTone
              )}
            >
              <Icon className="size-3" />
            </span>
            <span className="truncate font-heading text-sm font-semibold text-foreground tracking-tight">
              {title}
            </span>
          </div>

          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {body}
          </p>

          <div className="mt-2.5 flex items-center justify-between gap-2 pt-1 border-t border-border/40">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              {meta}
            </span>
            {actions && actions.length > 0 && (
              <div className="flex items-center gap-1.5">
                {actions.map((a) => (
                  <Button
                    key={a.label}
                    size="xs"
                    variant={a.primary ? "odysseyui" : "ghost"}
                    type="button"
                    onClick={() => {
                      a.onClick?.()
                      onDismiss?.()
                    }}
                    className="h-6 px-2 text-[11px] font-semibold cursor-pointer"
                  >
                    {a.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>

        {onDismiss && (
          <Button
            variant="ghost"
            size="icon-xs"
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss notification"
            className="-mr-1 -mt-1 text-muted-foreground hover:text-foreground"
          >
            <XIcon className="size-3.5" />
          </Button>
        )}
      </div>
    </article>
  )
}
