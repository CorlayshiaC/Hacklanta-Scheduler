import type { Tables } from "@/types/database";
import { scheduleNotificationEvents } from "@/lib/notifications/types";

/**
 * Shared row type for the notification center. Kept here (rather than redeclared in
 * notification-bell.tsx and notification-list.tsx) so both components agree on one shape.
 */
export type NotificationRow = Tables<"notifications">;

/**
 * kind -> short human label. notifications.kind (and notification_preferences.kind) store
 * scheduleNotificationEvents' SCREAMING_SNAKE_CASE values verbatim (see docs/contracts/schema.md
 * "Notification kinds"), so this maps those exact strings. Deliberately not derived from
 * notifications.payload: that jsonb shape isn't defined anywhere the notification center owns, so
 * guessing at its fields would be fragile.
 */
const KIND_LABELS: Record<string, string> = {
  [scheduleNotificationEvents.assignmentAdded]: "Shift assigned",
  [scheduleNotificationEvents.assignmentChanged]: "Shift changed",
  [scheduleNotificationEvents.assignmentRemoved]: "Shift removed",
  [scheduleNotificationEvents.schedulePublished]: "Schedule published",
  [scheduleNotificationEvents.shiftCancelled]: "Shift cancelled",
  [scheduleNotificationEvents.swapRequested]: "Swap requested",
  [scheduleNotificationEvents.swapClaimed]: "Swap claimed",
  [scheduleNotificationEvents.swapApproved]: "Swap approved",
  [scheduleNotificationEvents.swapDeclined]: "Swap declined",
  [scheduleNotificationEvents.reminder24h]: "24-hour shift reminder",
  [scheduleNotificationEvents.reminder1h]: "1-hour shift reminder",
};

/** Falls back to a humanized version of the raw kind for any value not in the map above, so an
 * unrecognized kind (a new one added to the enum without an update here) still renders something
 * readable instead of the raw SCREAMING_SNAKE_CASE string. */
export function getNotificationLabel(kind: string): string {
  const known = KIND_LABELS[kind];
  if (known) return known;

  const lower = kind.toLowerCase().replace(/_/g, " ");
  return lower.length > 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : kind;
}

export type NotificationAccent = "go" | "warn" | "neutral";

/**
 * Kind chip color per the pill/bento redesign brief's explicit examples: orange for a request that
 * needs someone's attention or a loss of coverage (swap requested, shift cancelled), purple for a
 * confirmed positive outcome (a new assignment, an approved swap), neutral for everything else
 * (changes/removals/claims/declines/reminders, none of which are themselves good or bad news).
 */
const WARN_KINDS = new Set<string>([
  scheduleNotificationEvents.swapRequested,
  scheduleNotificationEvents.shiftCancelled,
]);

const GO_KINDS = new Set<string>([
  scheduleNotificationEvents.assignmentAdded,
  scheduleNotificationEvents.swapApproved,
]);

export function getNotificationAccent(kind: string): NotificationAccent {
  if (WARN_KINDS.has(kind)) return "warn";
  if (GO_KINDS.has(kind)) return "go";
  return "neutral";
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
