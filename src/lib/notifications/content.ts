import {
  formatDateInTimeZone,
  formatTimeInTimeZone,
} from "@/lib/availability/time";
import {
  scheduleNotificationEvents,
  type NotificationEmail,
  type NotificationRecipient,
  type NotificationShift,
  type ScheduleNotificationEvent,
} from "@/lib/notifications/types";

const memberScheduleUrl = "/my-schedule";
const eventDates = "October 9-11, 2026";

function assignmentStatusText(status: NotificationShift["status"]) {
  return status === "published" ? "official schedule" : "draft schedule";
}

function shiftSummary(shift: NotificationShift, timezone: string) {
  const lines = [
    `Shift: ${shift.title}`,
    `When: ${formatDateInTimeZone(shift.startsAt, timezone)} · ${formatTimeInTimeZone(shift.startsAt, timezone)}-${formatTimeInTimeZone(shift.endsAt, timezone)}`,
    `Coverage role: ${shift.coverageRoleName ?? "General coverage"}`,
  ];

  if (shift.location) {
    lines.push(`Location: ${shift.location}`);
  }

  lines.push(`Status: ${assignmentStatusText(shift.status)}`);
  return lines.join("\n");
}

export function buildScheduleNotificationEmail(input: {
  eventName: string;
  eventType: ScheduleNotificationEvent;
  recipient: NotificationRecipient;
  shift?: NotificationShift;
  timezone: string;
}): NotificationEmail {
  const greeting = input.recipient.fullName.trim()
    ? `Hi ${input.recipient.fullName.trim()},`
    : "Hi,";

  if (input.eventType === scheduleNotificationEvents.schedulePublished) {
    return {
      subject: "HackLanta II schedule is published",
      to: input.recipient.email,
      body: [
        greeting,
        "",
        `${input.eventName}'s official schedule is now available.`,
        `Event dates: ${eventDates}`,
        `Timezone: ${input.timezone}`,
        `View your schedule: ${memberScheduleUrl}`,
      ].join("\n"),
    };
  }

  if (!input.shift) {
    throw new Error("Assignment notifications require shift details.");
  }

  if (input.eventType === scheduleNotificationEvents.assignmentAdded) {
    const prefix =
      input.shift.status === "published"
        ? "A new assignment was added to your official HackLanta II schedule."
        : "Your HackLanta II draft schedule changed. A draft assignment was added.";

    return {
      subject: "New HackLanta II assignment",
      to: input.recipient.email,
      body: [greeting, "", prefix, "", shiftSummary(input.shift, input.timezone), "", `View your schedule: ${memberScheduleUrl}`].join("\n"),
    };
  }

  if (input.eventType === scheduleNotificationEvents.assignmentChanged) {
    return {
      subject: "HackLanta II schedule changed",
      to: input.recipient.email,
      body: [
        greeting,
        "",
        `Your HackLanta II ${assignmentStatusText(input.shift.status)} changed.`,
        "",
        shiftSummary(input.shift, input.timezone),
        "",
        `View your schedule: ${memberScheduleUrl}`,
      ].join("\n"),
    };
  }

  return {
    subject: "HackLanta II assignment removed",
    to: input.recipient.email,
    body: [
      greeting,
      "",
      input.shift.status === "published"
        ? "An assignment was removed from your official HackLanta II schedule."
        : "Your HackLanta II draft schedule changed. A draft assignment was removed.",
      "",
      shiftSummary(input.shift, input.timezone),
      "",
      `View your schedule: ${memberScheduleUrl}`,
    ].join("\n"),
  };
}
