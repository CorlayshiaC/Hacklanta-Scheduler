import { scheduleNotificationEvents } from "@/lib/notifications/types";

/**
 * kind -> short human label, and kind -> accent semantics. One source of truth for both, shared by
 * the in-app notification center (src/components/notifications/) and the transactional email
 * templates (src/lib/notifications/email-template.ts), so a kind that reads as a warning in the bell
 * does not arrive as a neutral email.
 *
 * Lives in lib rather than in the component folder where it started: the email builder is server
 * code and must not import from src/components/. src/components/notifications/utils.ts re-exports
 * these, so existing imports there are unaffected.
 *
 * notifications.kind (and notification_preferences.kind) store scheduleNotificationEvents'
 * SCREAMING_SNAKE_CASE values verbatim (see docs/contracts/schema.md "Notification kinds"), so this
 * maps those exact strings. Deliberately not derived from notifications.payload: that jsonb shape
 * isn't defined anywhere the notification center owns, so guessing at its fields would be fragile.
 */
const KIND_LABELS: Record<string, string> = {
  [scheduleNotificationEvents.assignmentAdded]: "Shift assigned",
  [scheduleNotificationEvents.assignmentChanged]: "Shift changed",
  [scheduleNotificationEvents.assignmentRemoved]: "Shift removed",
  [scheduleNotificationEvents.assignmentApproved]: "Shift confirmed",
  [scheduleNotificationEvents.schedulePublished]: "Schedule published",
  [scheduleNotificationEvents.shiftCancelled]: "Shift cancelled",
  [scheduleNotificationEvents.swapRequested]: "Swap requested",
  [scheduleNotificationEvents.swapClaimed]: "Swap claimed",
  [scheduleNotificationEvents.swapApproved]: "Swap approved",
  [scheduleNotificationEvents.swapDeclined]: "Swap declined",
  [scheduleNotificationEvents.changeRequestOpened]: "Change request opened",
  [scheduleNotificationEvents.changeRequestClaimed]: "Change request claimed",
  [scheduleNotificationEvents.changeRequestApproved]: "Change request approved",
  [scheduleNotificationEvents.changeRequestDeclined]: "Change request declined",
  [scheduleNotificationEvents.announcementPosted]: "Announcement",
  [scheduleNotificationEvents.reminder24h]: "24-hour shift reminder",
  [scheduleNotificationEvents.reminder1h]: "1-hour shift reminder",
};

/**
 * Falls back to a humanized version of the raw kind for any value not in the map above, so an
 * unrecognized kind (a new one added to the enum without an update here) still renders something
 * readable instead of the raw SCREAMING_SNAKE_CASE string.
 */
export function getNotificationLabel(kind: string): string {
  const known = KIND_LABELS[kind];
  if (known) return known;

  const lower = kind.toLowerCase().replace(/_/g, " ");
  return lower.length > 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : kind;
}

export type NotificationAccent = "go" | "warn" | "neutral";

/**
 * Orange for anything that costs someone coverage or turns a request down, or that is waiting on a
 * person to act. Purple for a confirmed positive outcome. Neutral for the rest: an edit, a claim, a
 * reminder, an announcement, none of which are themselves good or bad news.
 *
 * This is the "at most two accents doing semantic work" rule applied to notifications: purple
 * approved, orange needs-attention, neutral otherwise, identical in the bell and in email.
 */
const WARN_KINDS = new Set<string>([
  scheduleNotificationEvents.assignmentRemoved,
  scheduleNotificationEvents.shiftCancelled,
  scheduleNotificationEvents.swapRequested,
  scheduleNotificationEvents.swapDeclined,
  scheduleNotificationEvents.changeRequestOpened,
  scheduleNotificationEvents.changeRequestDeclined,
]);

const GO_KINDS = new Set<string>([
  scheduleNotificationEvents.assignmentAdded,
  scheduleNotificationEvents.assignmentApproved,
  scheduleNotificationEvents.schedulePublished,
  scheduleNotificationEvents.swapApproved,
  scheduleNotificationEvents.changeRequestApproved,
]);

export function getNotificationAccent(kind: string): NotificationAccent {
  if (WARN_KINDS.has(kind)) return "warn";
  if (GO_KINDS.has(kind)) return "go";
  return "neutral";
}
