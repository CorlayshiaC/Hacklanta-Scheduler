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

function shiftEmail(input: {
  recipient: NotificationRecipient;
  subject: string;
  prefix: string;
  shift: NotificationShift;
  timezone: string;
}): NotificationEmail {
  const greeting = input.recipient.fullName.trim()
    ? `Hi ${input.recipient.fullName.trim()},`
    : "Hi,";

  return {
    subject: input.subject,
    to: input.recipient.email,
    body: [
      greeting,
      "",
      input.prefix,
      "",
      shiftSummary(input.shift, input.timezone),
      "",
      `View your schedule: ${memberScheduleUrl}`,
    ].join("\n"),
  };
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
      subject: `${input.eventName} schedule is published`,
      to: input.recipient.email,
      body: [
        greeting,
        "",
        `${input.eventName}'s official schedule is now available.`,
        `Timezone: ${input.timezone}`,
        `View your schedule: ${memberScheduleUrl}`,
      ].join("\n"),
    };
  }

  if (!input.shift) {
    throw new Error("Assignment notifications require shift details.");
  }

  if (input.eventType === scheduleNotificationEvents.assignmentAdded) {
    return shiftEmail({
      recipient: input.recipient,
      subject: `New ${input.eventName} assignment`,
      prefix:
        input.shift.status === "published"
          ? `A new assignment was added to your official ${input.eventName} schedule.`
          : `Your ${input.eventName} draft schedule changed. A draft assignment was added.`,
      shift: input.shift,
      timezone: input.timezone,
    });
  }

  if (input.eventType === scheduleNotificationEvents.assignmentChanged) {
    return shiftEmail({
      recipient: input.recipient,
      subject: `${input.eventName} schedule changed`,
      prefix: `Your ${input.eventName} ${assignmentStatusText(input.shift.status)} changed.`,
      shift: input.shift,
      timezone: input.timezone,
    });
  }

  if (input.eventType === scheduleNotificationEvents.assignmentRemoved) {
    return shiftEmail({
      recipient: input.recipient,
      subject: `${input.eventName} assignment removed`,
      prefix:
        input.shift.status === "published"
          ? `An assignment was removed from your official ${input.eventName} schedule.`
          : `Your ${input.eventName} draft schedule changed. A draft assignment was removed.`,
      shift: input.shift,
      timezone: input.timezone,
    });
  }

  if (input.eventType === scheduleNotificationEvents.shiftCancelled) {
    return shiftEmail({
      recipient: input.recipient,
      subject: `${input.eventName} shift cancelled`,
      prefix: `A shift you were assigned to was cancelled.`,
      shift: input.shift,
      timezone: input.timezone,
    });
  }

  if (input.eventType === scheduleNotificationEvents.swapRequested) {
    return shiftEmail({
      recipient: input.recipient,
      subject: `Open swap request: ${input.eventName}`,
      prefix: "A shift is open for anyone eligible to claim.",
      shift: input.shift,
      timezone: input.timezone,
    });
  }

  if (input.eventType === scheduleNotificationEvents.swapClaimed) {
    return shiftEmail({
      recipient: input.recipient,
      subject: `Your swap request was claimed: ${input.eventName}`,
      prefix: "Another member claimed your open swap request.",
      shift: input.shift,
      timezone: input.timezone,
    });
  }

  if (input.eventType === scheduleNotificationEvents.swapApproved) {
    return shiftEmail({
      recipient: input.recipient,
      subject: `Swap approved: ${input.eventName}`,
      prefix: "An organizer approved your swap request.",
      shift: input.shift,
      timezone: input.timezone,
    });
  }

  if (input.eventType === scheduleNotificationEvents.swapDeclined) {
    return shiftEmail({
      recipient: input.recipient,
      subject: `Swap declined: ${input.eventName}`,
      prefix: "An organizer declined your swap request.",
      shift: input.shift,
      timezone: input.timezone,
    });
  }

  if (input.eventType === scheduleNotificationEvents.reminder24h) {
    return shiftEmail({
      recipient: input.recipient,
      subject: `Reminder: shift tomorrow (${input.eventName})`,
      prefix: "You have a shift coming up in about 24 hours.",
      shift: input.shift,
      timezone: input.timezone,
    });
  }

  return shiftEmail({
    recipient: input.recipient,
    subject: `Reminder: shift in 1 hour (${input.eventName})`,
    prefix: "You have a shift coming up in about an hour.",
    shift: input.shift,
    timezone: input.timezone,
  });
}
