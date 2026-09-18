"use client";

import { useState, useEffect } from "react";
import { Bell, X, ExternalLink, Sparkles, CheckCircle2, GitCommit } from "lucide-react";
import { NotificationItem } from "@/components/timelines-notifications";

interface ToastProps {
  notification: NotificationItem;
  onDismiss: () => void;
  onInspect: () => void;
}

function NotificationToast({ notification, onDismiss, onInspect }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 8000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const isCommit = notification.category === "commits" || notification.item_type === "commit";

  return (
    <div className="group relative flex items-start gap-3 rounded-xl border border-primary/30 bg-card/95 p-4 shadow-xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 w-84 sm:w-96 text-left">
      <div className="mt-0.5 grid size-8 place-items-center rounded-lg bg-primary/10 text-primary shrink-0 border border-primary/20">
        {isCommit ? <GitCommit className="size-4" /> : <Sparkles className="size-4" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-wider text-primary font-semibold">
            {notification.project} · New Update
          </span>
          <button
            onClick={onDismiss}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded cursor-pointer"
            title="Close"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <h4 className="mt-1 text-xs font-semibold text-foreground truncate">
          {notification.who} {notification.what}
        </h4>

        {notification.context && (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {notification.context}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between pt-1 border-t border-border/40">
          <span className="font-mono text-[9px] text-muted-foreground">
            Just now
          </span>
          <button
            type="button"
            onClick={onInspect}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary px-2 py-1 font-mono text-[10px] uppercase tracking-wider font-semibold transition-colors cursor-pointer"
          >
            View <ExternalLink className="size-2.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function NotificationToastContainer({
  onInspectNotification,
}: {
  onInspectNotification?: (item: NotificationItem) => void;
}) {
  const [activeToasts, setActiveToasts] = useState<NotificationItem[]>([]);

  useEffect(() => {
    let lastKnownId: string | null = null;
    let isInitial = true;

    const pollNotifications = async () => {
      try {
        const res = await fetch("/api/memory?action=notifications");
        if (!res.ok) return;
        const data = await res.json();
        const items: NotificationItem[] = data.notifications || [];

        if (items.length > 0) {
          const newest = items[0];
          if (isInitial) {
            lastKnownId = newest.id;
            isInitial = false;
          } else if (lastKnownId && newest.id !== lastKnownId) {
            // New items arrived!
            const newItems: NotificationItem[] = [];
            for (const it of items) {
              if (it.id === lastKnownId) break;
              newItems.push(it);
            }
            lastKnownId = newest.id;

            // Trigger toasts for newly arrived items (max 2 at a time)
            if (newItems.length > 0) {
              setActiveToasts((prev) => [...prev, ...newItems.slice(0, 2)]);
            }
          }
        }
      } catch (e) {
        // Silently catch background poll error
      }
    };

    // Initial poll
    pollNotifications();

    // 20 second background interval
    const interval = setInterval(pollNotifications, 20000);
    return () => clearInterval(interval);
  }, []);

  const dismissToast = (id: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (activeToasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[90] flex flex-col gap-3 pointer-events-none">
      {activeToasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <NotificationToast
            notification={toast}
            onDismiss={() => dismissToast(toast.id)}
            onInspect={() => {
              dismissToast(toast.id);
              onInspectNotification?.(toast);
            }}
          />
        </div>
      ))}
    </div>
  );
}
