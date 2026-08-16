import type { Database } from "@/types/database";

/**
 * Kinds this table's `kind` column and notification_preferences.kind should use verbatim, see
 * docs/contracts/schema.md "Notification kinds". Existing four keys are unchanged, new ones are
 * additive: shiftCancelled (Agent 3 request 6), the four swap lifecycle kinds (Agent 3 flagging for
 * Agent 4), and the two reminder kinds from Agent 2's own deliverable list.
 */
export const scheduleNotificationEvents = {
  assignmentAdded: "ASSIGNMENT_ADDED",
  assignmentChanged: "ASSIGNMENT_CHANGED",
  assignmentRemoved: "ASSIGNMENT_REMOVED",
  schedulePublished: "SCHEDULE_PUBLISHED",
  shiftCancelled: "SHIFT_CANCELLED",
  swapRequested: "SWAP_REQUESTED",
  swapClaimed: "SWAP_CLAIMED",
  swapApproved: "SWAP_APPROVED",
  swapDeclined: "SWAP_DECLINED",
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
