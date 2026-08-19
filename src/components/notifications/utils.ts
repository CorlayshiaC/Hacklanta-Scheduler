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
