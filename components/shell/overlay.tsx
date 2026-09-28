"use client";

/**
 * Shared overlay primitive.
 *
 * Five dialogs in this app previously each declared their own `role="dialog"`,
 * their own backdrop, their own click-outside handler and their own global
 * Escape listener. That meant five listeners firing on a single Escape press
 * with arbitrary precedence, and no focus management anywhere: a keyboard user
 * could tab straight out of the diff modal into the page behind it.
 *
 * This component handles focus once, correctly:
 * - moves focus into the dialog on open
 * - keeps Tab inside it
 * - restores focus to the element that opened it on close
 * - locks background scroll
 * - closes on Escape, but only for the top-most dialog
 *
 * Escape ordering is solved with a module-level stack, which is the part a
 * plain `onKeyDown` per component cannot do.
 */

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Stack of open overlay ids, most recent last. */
const openOverlays: string[] = [];

export function Overlay({
  open,
  onClose,
  label,
  children,
  className,
  panelClassName,
  showClose = true,
  size = "lg",
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
  className?: string;
  panelClassName?: string;
  showClose?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const id = React.useId();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const restoreRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!open) return;

    restoreRef.current = document.activeElement as HTMLElement | null;
    openOverlays.push(id);

    // Focus the panel itself rather than the first control: a dialog that
    // steals focus into a text field is more surprising than one that just
    // announces itself.
    panelRef.current?.focus();

    const previouslyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Only the top-most overlay reacts, so closing a nested dialog does not
      // also close the one behind it.
      if (openOverlays[openOverlays.length - 1] !== id) return;
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previouslyOverflow;
      const index = openOverlays.lastIndexOf(id);
      if (index !== -1) openOverlays.splice(index, 1);
      restoreRef.current?.focus?.();
    };
  }, [open, id, onClose]);

  // Keep Tab inside the dialog while it is open.
  const onPanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  const maxWidth = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-6xl",
  }[size];

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm sm:p-6",
        className,
      )}
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onPanelKeyDown}
        className={cn(
          "relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl outline-none",
          maxWidth,
          panelClassName,
        )}
      >
        {showClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 z-10 rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        ) : null}
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
