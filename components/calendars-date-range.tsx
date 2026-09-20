"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon, Calendar as CalendarIcon, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface DateRangeValue {
  from?: Date
  to?: Date
  preset?: string
}

interface CalendarsDateRangeProps {
  value?: DateRangeValue
  onApply?: (range: DateRangeValue) => void
  onReset?: () => void
  onClose?: () => void
  className?: string
  showCloseButton?: boolean
}

const PRESETS = [
  "Today",
  "Yesterday",
  "Last 7 days",
  "Last 14 days",
  "Last 30 days",
  "This month",
  "Last month",
  "Last quarter",
  "Year to date",
]

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]

export function CalendarsDateRange({
  value,
  onApply,
  onReset,
  onClose,
  className,
  showCloseButton = false,
}: CalendarsDateRangeProps) {
  const [selectedPreset, setSelectedPreset] = React.useState<string>(
    value?.preset || "Last 30 days"
  )

  // Current view months: left month & right month
  const [baseDate, setBaseDate] = React.useState(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })

  // Date selection state
  const [startDate, setStartDate] = React.useState<Date | null>(() => {
    if (value?.from) return value.from
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d
  })
  const [endDate, setEndDate] = React.useState<Date | null>(() => {
    if (value?.to) return value.to
    return new Date()
  })

  const prevMonth = () => {
    setBaseDate((prev) => {
      const n = new Date(prev)
      n.setMonth(n.getMonth() - 1)
      return n
    })
  }

  const nextMonth = () => {
    setBaseDate((prev) => {
      const n = new Date(prev)
      n.setMonth(n.getMonth() + 1)
      return n
    })
  }

  const applyPreset = (preset: string) => {
    setSelectedPreset(preset)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let from = new Date(today)
    let to = new Date(today)

    switch (preset) {
      case "Today":
        from = today
        to = today
        break
      case "Yesterday":
        from = new Date(today)
        from.setDate(today.getDate() - 1)
        to = new Date(from)
        break
      case "Last 7 days":
        from = new Date(today)
        from.setDate(today.getDate() - 7)
        break
      case "Last 14 days":
        from = new Date(today)
        from.setDate(today.getDate() - 14)
        break
      case "Last 30 days":
        from = new Date(today)
        from.setDate(today.getDate() - 30)
        break
      case "This month":
        from = new Date(today.getFullYear(), today.getMonth(), 1)
        break
      case "Last month":
        from = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        to = new Date(today.getFullYear(), today.getMonth(), 0)
        break
      case "Last quarter":
        from = new Date(today)
        from.setDate(today.getDate() - 90)
        break
      case "Year to date":
        from = new Date(today.getFullYear(), 0, 1)
        break
      default:
        break
    }

    setStartDate(from)
    setEndDate(to)
  }

  const handleDayClick = (d: Date) => {
    setSelectedPreset("Custom")
    if (!startDate || (startDate && endDate)) {
      setStartDate(d)
      setEndDate(null)
    } else if (startDate && !endDate) {
      if (d < startDate) {
        setEndDate(startDate)
        setStartDate(d)
      } else {
        setEndDate(d)
      }
    }
  }

  const handleApply = () => {
    onApply?.({
      from: startDate || undefined,
      to: endDate || undefined,
      preset: selectedPreset,
    })
    onClose?.()
  }

  const handleReset = () => {
    applyPreset("Last 30 days")
    onReset?.()
  }

  // Generate month info for baseDate and baseDate + 1 month
  const month1Date = baseDate
  const month2Date = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1)

  const formatMonthTitle = (d: Date) => {
    return d.toLocaleString("default", { month: "long", year: "numeric" })
  }

  const formatDateLabel = (d: Date | null) => {
    if (!d) return "Select"
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl transition-all",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5 bg-muted/20">
        <div className="flex items-center gap-2 font-mono text-xs font-bold text-foreground">
          <CalendarIcon className="size-3.5 text-primary" />
          <span>Date Range Filter</span>
        </div>
        {showCloseButton && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            aria-label="Close date range calendar"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[170px_1fr]">
        {/* Presets Sidebar */}
        <aside className="border-b md:border-b-0 md:border-r border-border/60 bg-muted/10 p-3 flex flex-col justify-between">
          <div>
            <div className="px-2 py-1 font-mono text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
              Quick Range
            </div>
            <ul className="mt-1.5 flex flex-col gap-0.5">
              {PRESETS.map((p) => {
                const active = selectedPreset === p
                return (
                  <li key={p}>
                    <button
                      type="button"
                      onClick={() => applyPreset(p)}
                      className={cn(
                        "w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors font-medium cursor-pointer",
                        active
                          ? "bg-secondary text-foreground font-semibold"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      )}
                    >
                      {p}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="mt-4 border-t border-border/60 pt-3">
            <div className="px-2 py-1 font-mono text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
              Custom
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5 px-1">
              <div className="rounded-md border border-border/60 bg-background px-2 py-1.5">
                <div className="font-mono text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  From
                </div>
                <div className="mt-0.5 font-mono text-[11px] font-semibold truncate text-foreground">
                  {formatDateLabel(startDate)}
                </div>
              </div>
              <div className="rounded-md border border-border/60 bg-background px-2 py-1.5">
                <div className="font-mono text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  To
                </div>
                <div className="mt-0.5 font-mono text-[11px] font-semibold truncate text-foreground">
                  {formatDateLabel(endDate)}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* 2-Month Calendar Grid */}
        <div className="p-4 flex flex-col justify-between">
          <div>
            {/* Header with Chevrons */}
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={prevMonth}
                aria-label="Previous month"
                className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none cursor-pointer"
              >
                <ChevronLeftIcon className="size-4" />
              </button>
              <div className="grid grid-cols-2 gap-8 text-center flex-1">
                <span className="font-mono text-xs font-bold text-foreground">
                  {formatMonthTitle(month1Date)}
                </span>
                <span className="font-mono text-xs font-bold text-foreground">
                  {formatMonthTitle(month2Date)}
                </span>
              </div>
              <button
                type="button"
                onClick={nextMonth}
                aria-label="Next month"
                className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none cursor-pointer"
              >
                <ChevronRightIcon className="size-4" />
              </button>
            </div>

            {/* Calendars side-by-side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <CalendarMonth
                date={month1Date}
                startDate={startDate}
                endDate={endDate}
                onDayClick={handleDayClick}
              />
              <CalendarMonth
                date={month2Date}
                startDate={startDate}
                endDate={endDate}
                onDayClick={handleDayClick}
              />
            </div>
          </div>

          {/* Footer Bar */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
            <div className="font-mono text-[11px] text-muted-foreground">
              {startDate && endDate
                ? `${Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))} days · ${formatDateLabel(startDate)} → ${formatDateLabel(endDate)}`
                : "Select a start and end date"}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={handleReset}
                className="text-xs"
              >
                Reset
              </Button>
              <Button
                variant="odysseyui"
                size="sm"
                type="button"
                onClick={handleApply}
                className="text-xs font-semibold"
              >
                Apply range
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CalendarMonth({
  date,
  startDate,
  endDate,
  onDayClick,
}: {
  date: Date
  startDate: Date | null
  endDate: Date | null
  onDayClick: (d: Date) => void
}) {
  const year = date.getFullYear()
  const month = date.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // 0 = Sunday, 1 = Monday in JS getDay(). In European DAYS: Monday is 0.
  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7

  const cells = Array.from({ length: firstDayIndex + daysInMonth }, (_, i) => i)

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-1 px-0.5">
        {DAYS.map((d) => (
          <div
            key={d}
            className="text-center font-mono text-[10px] font-bold text-muted-foreground uppercase"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((c) => {
          const day = c - firstDayIndex + 1
          const out = day < 1 || day > daysInMonth
          if (out) return <span key={c} />

          const cellDate = new Date(year, month, day)
          const cellTime = cellDate.getTime()
          const startTime = startDate ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime() : null
          const endTime = endDate ? new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime() : null

          const isStart = startTime !== null && cellTime === startTime
          const isEnd = endTime !== null && cellTime === endTime
          const inRange = startTime !== null && endTime !== null && cellTime > startTime && cellTime < endTime
          const isEdge = isStart || isEnd

          return (
            <div key={c} className="relative py-0.5">
              {inRange && !isEdge && (
                <span className="absolute inset-y-0.5 inset-x-0 bg-primary/10" />
              )}
              {isStart && endTime && startTime !== endTime && (
                <span className="absolute inset-y-0.5 right-0 left-1/2 bg-primary/10" />
              )}
              {isEnd && startTime && startTime !== endTime && (
                <span className="absolute inset-y-0.5 right-1/2 left-0 bg-primary/10" />
              )}
              <button
                type="button"
                onClick={() => onDayClick(cellDate)}
                className={cn(
                  "relative mx-auto grid size-7 place-items-center rounded-full font-mono text-xs transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                  isEdge
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : inRange
                      ? "text-foreground font-semibold hover:bg-primary/20"
                      : "text-foreground/80 hover:bg-muted"
                )}
              >
                {day}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
