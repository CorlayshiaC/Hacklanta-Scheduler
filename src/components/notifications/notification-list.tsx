"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils/cn";
import {
  formatRelativeTime,
  getNotificationAccent,
  getNotificationLabel,
  type NotificationRow,
} from "@/components/notifications/utils";

export type NotificationListProps = {
  notifications: NotificationRow[];
  /** Called with the updated array after every optimistic change (mark one/all as read), so a
   * parent (e.g. notification-bell.tsx) can keep its own copy of the list, and derive things like
   * an unread badge count, in sync. */
  onNotificationsChange: (next: NotificationRow[]) => void;
};

/**
 * Renders a list of already-loaded notifications (loading/fetch-error states belong to the caller,
 * see notification-bell.tsx). Owns the read/unread interactions itself: clicking a row, or "mark all
 * as read", writes read_at directly through the browser client. RLS restricts updates to the owning
 * profile and, via the prevent_notification_content_edit trigger, to the read_at column only, so
 * there is nothing else this component could accidentally overwrite.
 *
 * STUB(agent-1): rows and the kind chip are hand-styled to the pill/bento palette (exact hexes, not
 * Agent 1's old neu tokens) since Card/PillButton don't exist yet. Swap in the real primitives once
 * published; see docs/contracts/pending.md.
 */
export function NotificationList({ notifications, onNotificationsChange }: NotificationListProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const unreadCount = notifications.filter((notification) => notification.read_at === null).length;

  async function markRead(id: string) {
    const target = notifications.find((notification) => notification.id === id);
    if (!target || target.read_at !== null) return;

    const previous = notifications;
    const readAt = new Date().toISOString();
    onNotificationsChange(
      notifications.map((notification) =>
        notification.id === id ? { ...notification, read_at: readAt } : notification,
      ),
    );
    setActionError(null);

    const supabase = createSupabaseBrowserClient();
    // Cast matches the rest of the codebase's established workaround for this Supabase client's
    // mutation-argument inference (see e.g. src/lib/settings/notification-actions.ts, src/lib/
    // swaps/actions.ts): without it, .update()'s argument type collapses to `never`.
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt } as never)
      .eq("id", id);

    if (error) {
      onNotificationsChange(previous);
      setActionError("Could not mark as read.");
    }
  }

  async function markAllRead() {
    const unreadIds = notifications
      .filter((notification) => notification.read_at === null)
      .map((notification) => notification.id);
    if (unreadIds.length === 0) return;

    const previous = notifications;
    const readAt = new Date().toISOString();
    onNotificationsChange(
      notifications.map((notification) =>
        notification.read_at === null ? { ...notification, read_at: readAt } : notification,
      ),
    );
    setActionError(null);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt } as never)
      .in("id", unreadIds);

    if (error) {
      onNotificationsChange(previous);
      setActionError("Could not mark all as read.");
    }
  }

  if (notifications.length === 0) {
    return (
      <div className="rounded-2xl bg-[#1E1E1E] p-4 text-center text-sm text-[#9A9A9A]">
        No notifications yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {unreadCount > 0 ? (
        <div className="flex items-center justify-end px-1 pb-1">
          <button
            className="rounded-full px-3 py-1 text-xs font-medium text-[#9A9A9A] transition-colors duration-150 ease-out hover:bg-[#1E1E1E] hover:text-[#F5F5F5]"
            onClick={() => void markAllRead()}
            type="button"
          >
            Mark all as read
          </button>
        </div>
      ) : null}

      {actionError ? <p className="px-2 pb-1 text-xs text-[#FF9F2E]">{actionError}</p> : null}

      <ul className="flex flex-col gap-1" role="list">
        {notifications.map((notification) => {
          const isUnread = notification.read_at === null;

          return (
            <li key={notification.id}>
              <button
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left outline-none transition-colors duration-150 ease-out",
                  "hover:bg-[#1E1E1E] focus-visible:ring-2 focus-visible:ring-[#A78BFA]",
                  isUnread && "bg-[#1E1E1E]/60",
                )}
                onClick={() => void markRead(notification.id)}
                type="button"
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                    isUnread ? "bg-[#A78BFA]" : "bg-transparent",
                  )}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  {isUnread ? <span className="sr-only">Unread: </span> : null}
                  <KindChip kind={notification.kind} />
                  <span className="font-mono text-xs tabular-nums text-[#5E5E5E]">
                    {formatRelativeTime(notification.created_at)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Tiny status pill carrying the notification's kind label, colored per getNotificationAccent. */
function KindChip({ kind }: { kind: string }) {
  const accent = getNotificationAccent(kind);

  return (
    <span
      className={cn(
        "inline-block w-fit truncate rounded-full px-2.5 py-1 text-xs font-medium",
        accent === "warn" && "bg-[#FF9F2E] text-[#0A0A0A]",
        accent === "go" && "bg-[#A78BFA] text-[#0A0A0A]",
        accent === "neutral" && "bg-[#1E1E1E] text-[#9A9A9A]",
      )}
    >
      {getNotificationLabel(kind)}
    </span>
  );
}
