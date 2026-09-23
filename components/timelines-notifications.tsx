"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  CheckCircle2,
  GitCommit,
  MessageCircle,
  Settings,
  ExternalLink,
  Check,
  Filter,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export interface NotificationItem {
  id: string;
  who: string;
  initials: string;
  what: string;
  context?: string;
  time: string;
  Icon: string;
  unread?: boolean;
  category: "all" | "decisions" | "commits" | "system";
  action_type: "inspect" | "diff" | "view";
  item_type: "adr" | "commit" | "grill";
  item_id: number;
  project: string;
  timestamp: string;
}

interface NotificationsResponse {
  notifications: NotificationItem[];
  unread_count: number;
}

function NotifIcon({ name, className }: { name: string; className?: string }) {
  if (name === "GitCommitIcon") return <GitCommit className={className} />;
  if (name === "MessageCircleIcon") return <MessageCircle className={className} />;
  if (name === "SettingsIcon") return <Settings className={className} />;
  return <CheckCircle2 className={className} />;
}

export function TimelinesNotifications({
  onSelectNotification,
  onViewAllActivity,
  className,
}: {
  onSelectNotification?: (item: NotificationItem) => void;
  onViewAllActivity?: () => void;
  className?: string;
}) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "decisions" | "commits">("all");
  const [loading, setLoading] = useState(true);

  const fetchNotifs = async () => {
    try {
      const res = await fetch("/api/memory?action=notifications");
      if (res.ok) {
        const data: NotificationsResponse = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchNotifs() }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const filtered = notifications.filter((n) => {
    if (activeTab === "unread") return n.unread;
    if (activeTab === "decisions") return n.category === "decisions";
    if (activeTab === "commits") return n.category === "commits";
    return true;
  });

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <div className={`overflow-hidden rounded-xl border border-border/70 bg-card/95 backdrop-blur-md shadow-lg ${className || ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 bg-muted/20">
        <div className="flex items-center gap-2">
          <Bell className="size-4 text-primary" />
          <span className="font-heading text-sm font-semibold text-foreground">Notifications</span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-primary px-1.5 py-0.2 font-mono text-[10px] font-semibold text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={handleMarkAllRead}
          className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em] hover:text-foreground h-7 px-2"
        >
          Mark all as read
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border/60 px-3 py-2 bg-card/50">
        {[
          { id: "all", label: "All" },
          { id: "unread", label: "Unread" },
          { id: "decisions", label: "Decisions" },
          { id: "commits", label: "Commits" },
        ].map((tab) => (
          <Button
            key={tab.id}
            type="button"
            variant={activeTab === tab.id ? "odysseyui" : "ghost"}
            size="xs"
            onClick={() => setActiveTab(tab.id as any)}
            className="h-7 text-xs"
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* List */}
      <div className="max-h-[380px] overflow-y-auto divide-y divide-border/40">
        {filtered.length > 0 ? (
          filtered.map((n) => (
            <div
              key={n.id}
              onClick={() => {
                // mark as read
                setNotifications((prev) =>
                  prev.map((item) => (item.id === n.id ? { ...item, unread: false } : item))
                );
                onSelectNotification?.(n);
              }}
              className={`relative flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-muted/40 ${
                n.unread ? "bg-primary/[0.04]" : ""
              }`}
            >
              {n.unread && (
                <span className="absolute top-4 left-1.5 size-1.5 rounded-full bg-primary shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
              )}
              <div className="relative shrink-0">
                <Avatar className="size-8">
                  <AvatarFallback className="text-[10px] font-semibold bg-muted text-foreground">
                    {n.initials}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full bg-card ring-1 ring-border">
                  <span className="grid size-3 place-items-center rounded-full bg-foreground text-background">
                    <NotifIcon name={n.Icon} className="size-2" />
                  </span>
                </span>
              </div>
              <div className="min-w-0 flex-1 leading-snug">
                <div className="text-xs text-foreground">
                  <span className="font-semibold text-foreground">{n.who}</span>{" "}
                  <span className="text-muted-foreground">{n.what}</span>
                </div>
                {n.context && (
                  <div className="mt-0.5 text-xs font-medium text-foreground/90 truncate">
                    {n.context}
                  </div>
                )}
                <div className="mt-1 flex items-center gap-2 font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
                  <span className="text-foreground/70 font-semibold">{n.project}</span>
                  <span>·</span>
                  <span>{n.time} ago</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No notifications in this tab.
          </div>
        )}
      </div>

      {/* Footer */}
      {onViewAllActivity && (
        <div className="border-t border-border/60 px-4 py-2 text-center bg-muted/10">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onViewAllActivity}
            className="w-full font-mono text-[10px] text-primary uppercase tracking-[0.25em] hover:text-primary font-medium h-7"
          >
            View all activity →
          </Button>
        </div>
      )}
    </div>
  );
}
