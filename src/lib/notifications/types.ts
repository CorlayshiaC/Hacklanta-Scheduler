export const scheduleNotificationEvents = {
  assignmentAdded: "ASSIGNMENT_ADDED",
  assignmentChanged: "ASSIGNMENT_CHANGED",
  assignmentRemoved: "ASSIGNMENT_REMOVED",
  schedulePublished: "SCHEDULE_PUBLISHED",
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
  status: "draft" | "published";
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
