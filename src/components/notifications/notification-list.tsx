"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { NeuBadge } from "@/components/ui/neu-badge";
import { PillButton } from "@/components/ui/neu-button";
import { cn } from "@/lib/utils/cn";
import { MOTION_BASE, useEntranceCascade } from "@/lib/utils/motion";

/** Motion spec v4.1 section 1: stagger-tight, the cadence for chips and dense rows. */
const STAGGER_TIGHT_MS = 24;
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
 * V3: rows and the kind chip are Agent 1's primitives and semantic tokens now, no local colors.
 *
 * v4.1 motion (section 2): rows cascade at stagger-tight on the entranceCascade preset. The cascade
 * root mounts with the panel and stays mounted through reads, mark-all, and background refreshes,
 * so the entrance runs once per panel open and never replays on a data change (law 2). Rows that
 * genuinely arrive later animate in individually, which is new content appearing rather than an
 * entrance replaying.
 */
export function NotificationList({ notifications, onNotificationsChange }: NotificationListProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const cascade = useEntranceCascade(STAGGER_TIGHT_MS);
  const reducedMotion = useReducedMotion();
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

    // Deferred import: this component renders inside the app-shell notification popover, so a
    // static import would pull the Supabase SDK into every authenticated route's bundle. Both
    // call sites are already async click handlers. See docs/perf-baseline.md.
    const { createSupabaseBrowserClient } = await import("@/lib/supabase/browser");
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

    // Deferred import: this component renders inside the app-shell notification popover, so a
    // static import would pull the Supabase SDK into every authenticated route's bundle. Both
    // call sites are already async click handlers. See docs/perf-baseline.md.
    const { createSupabaseBrowserClient } = await import("@/lib/supabase/browser");
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
      <div className="rounded-card bg-surface-elevated p-4 text-center text-sm text-text-secondary">
        No notifications yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {unreadCount > 0 ? (
        <div className="flex items-center justify-end px-1 pb-1">
          <PillButton onClick={() => void markAllRead()} size="sm" variant="ghost">
            Mark all as read
          </PillButton>
        </div>
      ) : null}

      {actionError ? <p className="px-2 pb-1 text-xs text-accent-warn">{actionError}</p> : null}

      <motion.ul
        animate="visible"
        className="flex flex-col gap-1"
        initial="hidden"
        role="list"
        variants={cascade.container}
      >
        {notifications.map((notification) => {
          const isUnread = notification.read_at === null;

          return (
            <motion.li key={notification.id} variants={cascade.item}>
              <button
                className={cn(
                  "flex w-full items-start gap-3 rounded-card px-3 py-2.5 text-left outline-none",
                  "transition-colors duration-fast ease-neu-out motion-reduce:transition-none",
                  "hover:bg-surface-elevated focus-visible:shadow-focus-ring",
                  isUnread && "bg-surface-elevated",
                )}
                onClick={() => void markRead(notification.id)}
                type="button"
              >
                {/*
                  Reading a notification is a state change, not an entrance (spec section 7), so
                  the dot fades rather than disappearing between frames. Opacity, not a background
                  swap, per law 1. initial={false} keeps it out of the row's entrance: the cascade
                  already brings the whole row in, and a dot fading in on top of that would be two
                  animations for one arrival.
                */}
                <motion.span
                  animate={{ opacity: isUnread ? 1 : 0 }}
                  aria-hidden
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-accent-primary"
                  initial={false}
                  transition={reducedMotion ? { duration: 0 } : MOTION_BASE}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  {isUnread ? <span className="sr-only">Unread: </span> : null}
                  <KindChip kind={notification.kind} />
                  <span className="font-mono text-xs tabular-nums text-text-secondary">
                    {formatRelativeTime(notification.created_at)}
                  </span>
                </span>
              </button>
            </motion.li>
          );
        })}
      </motion.ul>
    </div>
  );
}

/**
 * The notification's kind label as a quiet chip. NeuBadge's tinted-outline treatment rather than a
 * solid fill: a list of ten rows with ten solid accent chips would put far more than two accents'
 * worth of color weight on one small surface, and the row's own unread dot is already carrying the
 * "needs your attention" signal.
 */
function KindChip({ kind }: { kind: string }) {
  const accent = getNotificationAccent(kind);

  return (
    <NeuBadge
      className="w-fit max-w-full truncate"
      variant={accent === "warn" ? "warning" : accent === "go" ? "purple" : "default"}
    >
      {getNotificationLabel(kind)}
    </NeuBadge>
  );
}
