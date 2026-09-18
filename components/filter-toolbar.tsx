"use client"

import * as React from "react"
import {
  CalendarIcon,
  LayoutGridIcon,
  RowsIcon,
  SearchIcon,
  XIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { CalendarsDateRange, type DateRangeValue } from "@/components/calendars-date-range"
import { cn } from "@/lib/utils"

export interface FilterToolbarState {
  query: string
  type: string
  project: string
  dateRange: DateRangeValue
  density: "rows" | "grid"
}

interface FilterToolbarProps {
  projects?: string[]
  totalCount: number
  filteredCount: number
  state: FilterToolbarState
  onChange: (state: FilterToolbarState) => void
  onReset: () => void
  className?: string
}

const TYPE_OPTIONS = [
  { label: "All types", value: "all" },
  { label: "Decisions (ADR)", value: "adr" },
  { label: "Commits", value: "commit" },
  { label: "Discussions", value: "grill" },
  { label: "Deployments", value: "deploy" },
]

export function FilterToolbar({
  projects = [],
  totalCount,
  filteredCount,
  state,
  onChange,
  onReset,
  className,
}: FilterToolbarProps) {
  const [showCalendarModal, setShowCalendarModal] = React.useState(false)
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  // Keyboard shortcut '/' to focus search input
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const projectOptions = React.useMemo(() => {
    const opts = [{ label: "All projects", value: "all" }]
    for (const p of projects) {
      opts.push({ label: p, value: p })
    }
    return opts
  }, [projects])

  const activeFilterCount =
    (state.query ? 1 : 0) +
    (state.type !== "all" ? 1 : 0) +
    (state.project !== "all" ? 1 : 0) +
    (state.dateRange.preset !== "Last 30 days" && state.dateRange.preset !== "Any time" ? 1 : 0)

  const dateRangeLabel = React.useMemo(() => {
    if (state.dateRange.preset && state.dateRange.preset !== "Custom") {
      return state.dateRange.preset
    }
    if (state.dateRange.from && state.dateRange.to) {
      const f = state.dateRange.from.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      const t = state.dateRange.to.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      return `${f} - ${t}`
    }
    return "Date range"
  }, [state.dateRange])

  const setSavedView = (view: "all" | "adrs" | "commits" | "discussions") => {
    switch (view) {
      case "all":
        onReset()
        break
      case "adrs":
        onChange({ ...state, type: "adr", query: "" })
        break
      case "commits":
        onChange({ ...state, type: "commit", query: "" })
        break
      case "discussions":
        onChange({ ...state, type: "grill", query: "" })
        break
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-xl border border-border/80 bg-card p-3 shadow-xs",
        className
      )}
    >
      {/* Primary Toolbar Row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search Input */}
        <InputGroup className="w-full sm:w-60 md:w-64">
          <InputGroupAddon>
            <SearchIcon className="size-3.5 text-muted-foreground" />
          </InputGroupAddon>
          <InputGroupInput
            ref={searchInputRef}
            placeholder="Filter memories, commits..."
            value={state.query}
            onChange={(e) => onChange({ ...state, query: e.target.value })}
            aria-label="Search filter query"
          />
          <InputGroupAddon align="inline-end">
            <Kbd>/</Kbd>
          </InputGroupAddon>
        </InputGroup>

        <Separator orientation="vertical" className="hidden sm:block mx-0.5 h-6" />

        {/* Type Select */}
        <Select
          items={TYPE_OPTIONS}
          value={state.type}
          onValueChange={(v) => onChange({ ...state, type: v ?? "all" })}
        >
          <SelectTrigger className="w-36 h-8 text-xs" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            {TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>

        {/* Project Select */}
        <Select
          items={projectOptions}
          value={state.project}
          onValueChange={(v) => onChange({ ...state, project: v ?? "all" })}
        >
          <SelectTrigger className="w-36 h-8 text-xs" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectPopup>
            {projectOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>

        {/* Date Range Popover Button */}
        <Button
          size="sm"
          variant="outline"
          type="button"
          onClick={() => setShowCalendarModal(true)}
          className={cn(
            "h-8 gap-1.5 px-2.5 text-xs font-medium cursor-pointer",
            state.dateRange.preset !== "Last 30 days" && state.dateRange.preset !== "Any time"
              ? "border-primary/50 bg-primary/10 text-primary font-semibold"
              : "text-foreground"
          )}
        >
          <CalendarIcon className="size-3.5 text-muted-foreground shrink-0" />
          <span className="truncate max-w-[110px]">{dateRangeLabel}</span>
        </Button>

        {/* Density Toggle (Rows vs Grid) */}
        <div className="ms-auto flex items-center gap-1.5">
          <ToggleGroup
            value={[state.density]}
            onValueChange={(v) => {
              const next = (v as string[])[0]
              if (next === "rows" || next === "grid") {
                onChange({ ...state, density: next })
              }
            }}
            aria-label="View Density"
          >
            <ToggleGroupItem value="rows" size="sm" aria-label="Compact rows view">
              <RowsIcon className="size-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem value="grid" size="sm" aria-label="Bento grid view">
              <LayoutGridIcon className="size-3.5" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <Separator />

      {/* Secondary Row: Saved Views & Active Counter */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Presets:
          </span>
          <Button
            size="sm"
            variant={activeFilterCount === 0 ? "secondary" : "ghost"}
            onClick={() => setSavedView("all")}
            className="h-6 px-2 text-[11px] font-mono"
          >
            All
          </Button>
          <Button
            size="sm"
            variant={state.type === "adr" ? "secondary" : "ghost"}
            onClick={() => setSavedView("adrs")}
            className="h-6 px-2 text-[11px] font-mono"
          >
            Decisions
          </Button>
          <Button
            size="sm"
            variant={state.type === "commit" ? "secondary" : "ghost"}
            onClick={() => setSavedView("commits")}
            className="h-6 px-2 text-[11px] font-mono"
          >
            Commits
          </Button>
          <Button
            size="sm"
            variant={state.type === "grill" ? "secondary" : "ghost"}
            onClick={() => setSavedView("discussions")}
            className="h-6 px-2 text-[11px] font-mono"
          >
            Discussions
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <span
              className={cn(
                "size-1.5 rounded-full",
                filteredCount === 0 ? "bg-destructive" : "bg-emerald-500"
              )}
            />
            Showing <strong className="text-foreground">{filteredCount}</strong> of {totalCount} records
          </span>

          {activeFilterCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onReset}
              className="h-6 gap-1 px-1.5 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <XIcon className="size-3" />
              <span>Clear ({activeFilterCount})</span>
            </Button>
          )}
        </div>
      </div>

      {/* Date Range Modal / Overlay */}
      {showCalendarModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs cursor-pointer"
          onClick={() => setShowCalendarModal(false)}
        >
          <div
            className="cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <CalendarsDateRange
              value={state.dateRange}
              showCloseButton
              onClose={() => setShowCalendarModal(false)}
              onApply={(range) => {
                onChange({ ...state, dateRange: range })
                setShowCalendarModal(false)
              }}
              onReset={() => {
                onChange({
                  ...state,
                  dateRange: { preset: "Last 30 days" },
                })
                setShowCalendarModal(false)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
