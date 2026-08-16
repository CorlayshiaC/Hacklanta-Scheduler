"use client";

import { useState } from "react";
import { NeuButton } from "@/components/ui/neu-button";
import { NeuWell } from "@/components/ui/neu-well";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils/cn";
import {
  formatRelativeTime,
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
      <NeuWell className="text-center text-sm text-text-secondary">No notifications yet.</NeuWell>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {unreadCount > 0 ? (
        <div className="flex items-center justify-end px-1 pb-1">
          <NeuButton onClick={() => void markAllRead()} size="sm" variant="ghost">
            Mark all as read
          </NeuButton>
        </div>
      ) : null}

      {actionError ? <p className="px-2 pb-1 text-xs text-danger">{actionError}</p> : null}

      <ul className="flex flex-col gap-1" role="list">
        {notifications.map((notification) => {
          const isUnread = notification.read_at === null;

          return (
            <li key={notification.id}>
              <button
                className={cn(
                  "flex w-full items-start gap-3 rounded-neu-sm border border-transparent px-3 py-2.5 text-left outline-none transition-colors duration-fast ease-neu-out",
                  "hover:bg-bg-sunken/60 focus-visible:shadow-neu-focus",
                  isUnread && "bg-bg-sunken/40",
                )}
                onClick={() => void markRead(notification.id)}
                type="button"
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                    isUnread ? "bg-purple-500" : "bg-transparent",
                  )}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span
                    className={cn(
                      "truncate text-sm",
                      isUnread ? "font-semibold text-text-primary" : "text-text-secondary",
                    )}
                  >
                    {isUnread ? <span className="sr-only">Unread: </span> : null}
                    {getNotificationLabel(notification.kind)}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-text-muted">
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
