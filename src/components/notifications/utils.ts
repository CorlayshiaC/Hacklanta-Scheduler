import type { Tables } from "@/types/database";

/**
 * Shared row type for the notification center. Kept here (rather than redeclared in
 * notification-bell.tsx and notification-list.tsx) so both components agree on one shape.
 */
export type NotificationRow = Tables<"notifications">;

/**
 * Kind labels and accent semantics now live in src/lib/notifications/kinds.ts, so the transactional
 * email templates (server code, which must not import from src/components/) share one mapping with
 * the in-app center. Re-exported here so every existing call site in this folder is unchanged.
 */
export {
  getNotificationLabel,
  getNotificationAccent,
  type NotificationAccent,
} from "@/lib/notifications/kinds";

/**
 * Whether an unread-count change is an arriving batch worth the bell tilt (motion spec v4.1
 * section 2: "a single 8-degree tilt-and-return when a new notification lands, once per batch").
 *
 * Pure and separate from the component because all four branches are behavioral rules Agent 6's
 * sweep enforces, not rendering details:
 * - `lastSeen === null` is the first successful load. An existing backlog is not an arrival, so the
 *   bell must be still on page load no matter how many unread notifications are already there.
 * - A count going down is someone reading a notification. Reading is not an event to celebrate.
 * - An unchanged count is a re-render or a background refresh that found nothing new. Law 2.
 * - Any increase is one tilt, whether one notification landed or six, which is what "once per
 *   batch" means: this watches the count, never individual rows.
 */
export function isArrivingBatch(lastSeen: number | null, unreadCount: number): boolean {
  if (lastSeen === null) return false;
  return unreadCount > lastSeen;
}

const MINUTE_SECONDS = 60;
const HOUR_SECONDS = 60 * MINUTE_SECONDS;
const DAY_SECONDS = 24 * HOUR_SECONDS;
const WEEK_SECONDS = 7 * DAY_SECONDS;

/**
 * "Just now" / "12m ago" / "3h ago" / "5d ago", falling back to "Aug 10" beyond a week. Small and
 * local rather than a date-fns import: the notification center only ever needs this one shape, and
 * the design system requires these render in mono with tabular numerals wherever they're used
 * (handled by the caller's className, not this function).
 */
export function formatRelativeTime(value: string | Date, now: Date = new Date()): string {
  const target = typeof value === "string" ? new Date(value) : value;
  const diffSeconds = Math.max(0, Math.round((now.getTime() - target.getTime()) / 1000));

  if (diffSeconds < 45) return "Just now";
  if (diffSeconds < HOUR_SECONDS) return `${Math.round(diffSeconds / MINUTE_SECONDS)}m ago`;
  if (diffSeconds < DAY_SECONDS) return `${Math.round(diffSeconds / HOUR_SECONDS)}h ago`;
  if (diffSeconds < WEEK_SECONDS) return `${Math.round(diffSeconds / DAY_SECONDS)}d ago`;

  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(target);
}
