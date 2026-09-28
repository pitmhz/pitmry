"use client";

/**
 * Dashboard header.
 *
 * The view switcher is generated from the same registry the sidebar uses, so
 * both surfaces always offer the same set. It is a real tablist: the previous
 * eight hand-written buttons had no `role="tablist"` and no `aria-pressed`,
 * so a screen reader announced eight undifferentiated buttons.
 *
 * On narrow screens the switcher collapses into a select rather than
 * overflowing: the header previously had eight pills plus a control cluster in
 * a fixed 48px bar with no scroll strategy.
 */

import * as React from "react";
import { Bell, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { DesignTokenController } from "@/components/design-token-controller";
import { CustomSidebarTrigger } from "@/components/custom-sidebar-trigger";
import { TimelinesNotifications, type NotificationItem } from "@/components/timelines-notifications";
import type { MemoryItemType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { VIEWS, VIEW_BY_MODE, type ViewMode } from "./view-registry";

export function DashboardHeader({
  view,
  onSelectView,
  breadcrumb,
  onOpenPalette,
  loading,
  onRefresh,
  notifOpen,
  onToggleNotif,
  unreadCount,
  onSelectNotification,
  onViewAllActivity,
  notifRef,
  children,
}: {
  view: ViewMode;
  onSelectView: (view: ViewMode) => void;
  breadcrumb: string;
  onOpenPalette: () => void;
  loading: boolean;
  onRefresh: () => void;
  notifOpen: boolean;
  onToggleNotif: () => void;
  unreadCount: number;
  onSelectNotification: (item: NotificationItem) => void;
  onViewAllActivity: () => void;
  notifRef: React.RefObject<HTMLDivElement | null>;
  children?: React.ReactNode;
}) {
  const definition = VIEW_BY_MODE[view];
  const [compact, setCompact] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return (
    <header className="relative z-40 flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border/70 bg-background/80 px-3 backdrop-blur">
      <div className="flex min-w-0 items-center gap-2">
        <CustomSidebarTrigger />
        <Separator orientation="vertical" className="hidden h-4 opacity-40 sm:block" />
        <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 font-mono text-xs text-muted-foreground sm:flex">
          <span className="font-semibold text-foreground">pitmry</span>
          <span aria-hidden="true">/</span>
          <span className="truncate font-medium text-primary">{breadcrumb}</span>
        </nav>

        {compact ? (
          <label className="flex items-center gap-2">
            <span className="sr-only">Current view</span>
            <select
              value={view}
              onChange={(event) => onSelectView(event.target.value as ViewMode)}
              className="h-8 rounded-md border border-border bg-card px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {VIEWS.map((entry) => (
                <option key={entry.mode} value={entry.mode}>
                  {entry.title}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div
            role="tablist"
            aria-label="Dashboard views"
            className="flex items-center gap-0.5 rounded-md border border-border/70 bg-secondary/40 p-0.5 text-xs"
          >
            {VIEWS.map((entry) => {
              const Icon = entry.icon;
              const selected = entry.mode === view;
              return (
                <button
                  key={entry.mode}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  onClick={() => onSelectView(entry.mode)}
                  title={entry.description}
                  className={cn(
                    "flex items-center gap-1 rounded px-2 py-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "bg-card font-semibold text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon aria-hidden="true" className="size-3.5" />
                  <span>{entry.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          data-tour="search-palette"
          onClick={onOpenPalette}
          className="hidden w-44 justify-start text-xs font-normal text-muted-foreground hover:text-foreground lg:flex"
        >
          <Search aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">Search memory</span>
          <Kbd className="ml-auto">⌘K</Kbd>
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onOpenPalette}
          aria-label="Search memory"
          title="Search memory"
          className="lg:hidden"
        >
          <Search aria-hidden="true" className="size-3.5" />
        </Button>

        <div className="relative" ref={notifRef}>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={onToggleNotif}
            aria-expanded={notifOpen}
            aria-haspopup="dialog"
            className="relative"
            title="Notifications"
          >
            <Bell aria-hidden="true" className="size-3.5" />
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
                <span className="sr-only"> unread notifications</span>
              </span>
            ) : null}
          </Button>

          {notifOpen ? (
            <div className="absolute right-0 top-full z-50 mt-2 w-80 shadow-2xl sm:w-96">
              <TimelinesNotifications
                onSelectNotification={onSelectNotification}
                onViewAllActivity={onViewAllActivity}
              />
            </div>
          ) : null}
        </div>

        <DesignTokenController />
        {children}

        <Button
          variant="outline"
          size="icon-sm"
          onClick={onRefresh}
          title={`Refresh. Showing ${definition.title.toLowerCase()}.`}
          aria-label="Refresh dashboard data"
        >
          <RefreshCw aria-hidden="true" className={cn("size-3.5", loading && "animate-spin motion-reduce:animate-none")} />
        </Button>
      </div>
    </header>
  );
}

export type { NotificationItem };
export type { MemoryItemType };
