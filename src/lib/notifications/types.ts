import type { Database } from "@/types/database";

/**
 * Kinds this table's `kind` column and notification_preferences.kind should use verbatim, see
 * docs/contracts/schema.md "Notification kinds". Original eleven keys are unchanged. V2 additive keys:
 * assignmentApproved (the new approval-flow terminal state, distinct from assignmentAdded, which now
 * fires when a proposal first lands in_approval), the five changeRequest* kinds (change_requests
 * replaces swap_requests; swapRequested/swapClaimed/swapApproved/swapDeclined are kept, not removed,
 * since notification-list.tsx's existing label/accent mapping still displays historical rows written
 * before this cutover), and announcementPosted.
 */
export const scheduleNotificationEvents = {
  assignmentAdded: "ASSIGNMENT_ADDED",
  assignmentChanged: "ASSIGNMENT_CHANGED",
  assignmentRemoved: "ASSIGNMENT_REMOVED",
  assignmentApproved: "ASSIGNMENT_APPROVED",
  schedulePublished: "SCHEDULE_PUBLISHED",
  shiftCancelled: "SHIFT_CANCELLED",
  swapRequested: "SWAP_REQUESTED",
  swapClaimed: "SWAP_CLAIMED",
  swapApproved: "SWAP_APPROVED",
  swapDeclined: "SWAP_DECLINED",
  changeRequestOpened: "CHANGE_REQUEST_OPENED",
  changeRequestClaimed: "CHANGE_REQUEST_CLAIMED",
  changeRequestApproved: "CHANGE_REQUEST_APPROVED",
  changeRequestDeclined: "CHANGE_REQUEST_DECLINED",
  announcementPosted: "ANNOUNCEMENT_POSTED",
  reminder24h: "REMINDER_24H",
  reminder1h: "REMINDER_1H",
} as const;

export type ScheduleNotificationEvent =
  (typeof scheduleNotificationEvents)[keyof typeof scheduleNotificationEvents];

export type NotificationRecipient = {
  email: string;
  fullName: string;
  id: string;
  isActive: boolean;
};

export type NotificationShift = {
  coverageRoleName: string | null;
  endsAt: string;
  location: string | null;
  startsAt: string;
  status: Database["public"]["Enums"]["assignment_status"];
  title: string;
};

/**
 * The structured shape every transactional email is built as, before rendering. Content.ts decides
 * what a message says; email-template.ts decides how it looks in text and in HTML. Splitting them
 * is what lets the two parts of a message never drift apart, and what keeps the V3 email restyle
 * out of the copy entirely.
 */
export type NotificationEmailContent = {
  subject: string;
  to: string;
  /** "Hi Jane," or "Hi," when no name is on the profile. */
  greeting: string;
  /** Lead paragraphs, in order. The first also becomes the inbox preheader line. */
  intro: string[];
  /**
   * Set for kinds that cost someone coverage or turn a request down (see getNotificationAccent's
   * warn set). Renders as the one orange element in the message: dark text on a pale orange tint
   * with an orange rule, never white text on an orange fill, which fails the contrast floor.
   */
  warning?: string;
  /** Label/value rows. `mono` marks times, dates, and counts, per the type rules. */
  details: { label: string; value: string; mono?: boolean }[];
  /** `path` is app-relative; both renderers make it absolute against the configured site origin. */
  cta: { label: string; path: string };
};

export type NotificationEmail = {
  body: string;
  /** Rendered HTML part. Always present; the provider sends html and text together. */
  html: string;
  subject: string;
  to: string;
};

export type NotificationDeliveryResult =
  | { ok: true; status: "sent" }
  | { ok: false; status: "unavailable"; message: string }
  | { ok: false; status: "failed"; message: string };
