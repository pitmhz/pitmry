"use client";

/**
 * Record dossier side panel.
 *
 * The designated Project Intelligence inspector. On a wide screen it docks
 * beside the content; below `xl` it becomes a bottom sheet on mobile and a
 * right overlay on tablet.
 *
 * This replaces `RelationalInspector`, which was a fixed 480px `shrink-0`
 * column. In the flex row it left the record list roughly zero pixels wide on
 * a 390px viewport, so selecting a record made the app unusable on a phone.
 * A docked panel must never be able to squeeze the list it belongs to.
 */

import * as React from "react";
import { GitCompareArrows, X } from "lucide-react";
import type { MemoryItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DossierBody } from "@/components/console/dossier-panel";

function useDismissable(open: boolean, onClose: () => void) {
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const restoreRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  return closeRef;
}

function PanelChrome({
  item,
  onClose,
  closeRef,
  onOpenDiff,
}: {
  item: MemoryItem;
  onClose: () => void;
  closeRef: React.RefObject<HTMLButtonElement | null>;
  onOpenDiff?: (item: MemoryItem) => void;
}) {
  // A diff only exists for records the backend captured a commit for. Anything
  // else must not offer the action, rather than opening a viewer that can only
  // report that there is nothing to show.
  const canDiff = Boolean(item.commit_hash) && onOpenDiff !== undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        {canDiff ? (
          <button
            type="button"
            onClick={() => onOpenDiff(item)}
            className="inline-flex items-center gap-1.5 rounded border border-border/70 bg-card px-2 py-1 text-[0.6875rem] font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <GitCompareArrows aria-hidden="true" className="size-3" />
            View diff
          </button>
        ) : (
          <span />
        )}
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close record panel"
          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <DossierBody item={item} />
      </div>
    </div>
  );
}

export function RecordDossierPanel({
  item,
  onClose,
  onOpenDiff,
  className,
}: {
  item: MemoryItem | null;
  onClose: () => void;
  onOpenDiff?: (item: MemoryItem) => void;
  className?: string;
}) {
  const closeRef = useDismissable(Boolean(item), onClose);

  if (!item) {
    return (
      <aside
        aria-label="Record details"
        className={cn(
          "hidden w-80 shrink-0 flex-col border-l border-border/60 bg-card/40 xl:flex",
          className,
        )}
      >
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <p className="text-sm font-medium text-foreground">No record selected</p>
          <p className="mt-1.5 max-w-[26ch] text-xs leading-relaxed text-muted-foreground">
            Pick a record to read its identity, lifecycle, evidence and risk in one schema.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <>
      {/* Small screens: a bottom sheet, so the list above stays visible and
          the panel never competes with it for horizontal space. */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] rounded-t-xl border-t border-border bg-card shadow-2xl md:hidden"
        role="dialog"
        aria-modal="false"
        aria-label="Record details"
      >
        <div className="flex justify-center pt-2">
          <span aria-hidden="true" className="h-1 w-9 rounded-full bg-muted-foreground/40" />
        </div>
        <PanelChrome item={item} onClose={onClose} closeRef={closeRef} onOpenDiff={onOpenDiff} />
      </div>

      {/* Medium screens: a right overlay. */}
      <div
        className="fixed inset-0 z-50 hidden justify-end bg-background/70 backdrop-blur-sm md:flex xl:hidden"
        onClick={onClose}
        role="presentation"
      >
        <div
          className="flex h-full w-full max-w-md flex-col border-l border-border bg-card"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Record details"
        >
          <PanelChrome item={item} onClose={onClose} closeRef={closeRef} onOpenDiff={onOpenDiff} />
        </div>
      </div>

      {/* Wide screens: docked. */}
      <aside
        aria-label="Record details"
        className={cn("hidden w-[22rem] shrink-0 flex-col border-l border-border/60 bg-card/40 xl:flex", className)}
      >
        <PanelChrome item={item} onClose={onClose} closeRef={closeRef} onOpenDiff={onOpenDiff} />
      </aside>
    </>
  );
}
