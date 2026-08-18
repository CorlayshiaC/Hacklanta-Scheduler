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

export type NotificationEmail = {
  body: string;
  subject: string;
  to: string;
};

export type NotificationDeliveryResult =
  | { ok: true; status: "sent" }
  | { ok: false; status: "unavailable"; message: string }
  | { ok: false; status: "failed"; message: string };
