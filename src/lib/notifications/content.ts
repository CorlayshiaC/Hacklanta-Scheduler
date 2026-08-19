import { formatDateInTimeZone, formatTimeInTimeZone } from "@/lib/availability/time";
import {
  renderNotificationEmailHtml,
  renderNotificationEmailText,
} from "@/lib/notifications/email-template";
import { getNotificationAccent } from "@/lib/notifications/kinds";
import {
  scheduleNotificationEvents,
  type NotificationEmail,
  type NotificationEmailContent,
  type NotificationRecipient,
  type NotificationShift,
  type ScheduleNotificationEvent,
} from "@/lib/notifications/types";

const memberScheduleUrl = "/my-schedule";
const viewScheduleCta = { label: "View your schedule", path: memberScheduleUrl };

function assignmentStatusText(status: NotificationShift["status"]) {
  return status === "published" ? "official schedule" : "draft schedule";
}

function greetingFor(recipient: NotificationRecipient): string {
  const name = recipient.fullName.trim();
  return name ? `Hi ${name},` : "Hi,";
}

/**
 * The shift block every assignment-shaped email carries. Labels are unchanged from the pre-V3 text
 * emails on purpose: members have been reading these for a semester and the redesign is a restyle,
 * not a rewrite of what a notification says.
 */
function shiftDetails(
  shift: NotificationShift,
  timezone: string,
): NotificationEmailContent["details"] {
  const details: NotificationEmailContent["details"] = [
    { label: "Shift", value: shift.title },
    {
      label: "When",
      value: `${formatDateInTimeZone(shift.startsAt, timezone)} · ${formatTimeInTimeZone(shift.startsAt, timezone)}-${formatTimeInTimeZone(shift.endsAt, timezone)}`,
      mono: true,
    },
    { label: "Coverage role", value: shift.coverageRoleName ?? "General coverage" },
  ];

  if (shift.location) {
    details.push({ label: "Location", value: shift.location });
  }

  details.push({ label: "Status", value: assignmentStatusText(shift.status) });
  return details;
}

/**
 * Warn kinds put their lead sentence in the orange callout instead of a plain paragraph, so the one
 * orange element in the message is the thing that actually needs attention. Same sentence either
 * way: the accent carries the emphasis, the copy does not change tone.
 */
function shiftContent(input: {
  recipient: NotificationRecipient;
  eventType: ScheduleNotificationEvent;
  subject: string;
  lead: string;
  shift: NotificationShift;
  timezone: string;
}): NotificationEmailContent {
  const isWarning = getNotificationAccent(input.eventType) === "warn";

  return {
    subject: input.subject,
    to: input.recipient.email,
    greeting: greetingFor(input.recipient),
    intro: isWarning ? [] : [input.lead],
    warning: isWarning ? input.lead : undefined,
    details: shiftDetails(input.shift, input.timezone),
    cta: viewScheduleCta,
  };
}

/** Subject + lead sentence per kind. The only place notification copy lives. */
function leadFor(input: {
  eventName: string;
  eventType: ScheduleNotificationEvent;
  shift: NotificationShift;
}): { subject: string; lead: string } {
  const { eventName, shift } = input;
  const events = scheduleNotificationEvents;

  switch (input.eventType) {
    case events.assignmentAdded:
      return {
        subject: `New ${eventName} assignment`,
        lead:
          shift.status === "published"
            ? `A new assignment was added to your official ${eventName} schedule.`
            : `Your ${eventName} draft schedule changed. A draft assignment was added.`,
      };
    case events.assignmentChanged:
      return {
        subject: `${eventName} schedule changed`,
        lead: `Your ${eventName} ${assignmentStatusText(shift.status)} changed.`,
      };
    case events.assignmentRemoved:
      return {
        subject: `${eventName} assignment removed`,
        lead:
          shift.status === "published"
            ? `An assignment was removed from your official ${eventName} schedule.`
            : `Your ${eventName} draft schedule changed. A draft assignment was removed.`,
      };
    case events.assignmentApproved:
      return {
        subject: `Shift confirmed: ${eventName}`,
        lead: `An admin approved your ${eventName} assignment. It's now confirmed.`,
      };
    case events.shiftCancelled:
      return {
        subject: `${eventName} shift cancelled`,
        lead: "A shift you were assigned to was cancelled.",
      };
    case events.swapRequested:
      return {
        subject: `Open swap request: ${eventName}`,
        lead: "A shift is open for anyone eligible to claim.",
      };
    case events.swapClaimed:
      return {
        subject: `Your swap request was claimed: ${eventName}`,
        lead: "Another member claimed your open swap request.",
      };
    case events.swapApproved:
      return {
        subject: `Swap approved: ${eventName}`,
        lead: "An organizer approved your swap request.",
      };
    case events.swapDeclined:
      return {
        subject: `Swap declined: ${eventName}`,
        lead: "An organizer declined your swap request.",
      };
    case events.changeRequestOpened:
      return {
        subject: `Open change request: ${eventName}`,
        lead: "A shift is open for a change request.",
      };
    case events.changeRequestClaimed:
      return {
        subject: `Your change request was claimed: ${eventName}`,
        lead: "Another member claimed your open change request.",
      };
    case events.changeRequestApproved:
      return {
        subject: `Change request approved: ${eventName}`,
        lead: "A director approved your change request.",
      };
    case events.changeRequestDeclined:
      return {
        subject: `Change request declined: ${eventName}`,
        lead: "A director declined your change request.",
      };
    case events.reminder24h:
      return {
        subject: `Reminder: shift tomorrow (${eventName})`,
        lead: "You have a shift coming up in about 24 hours.",
      };
    default:
      return {
        subject: `Reminder: shift in 1 hour (${eventName})`,
        lead: "You have a shift coming up in about an hour.",
      };
  }
}

/**
 * The structured content behind an email, before rendering. Exported so a caller that wants the
 * pieces (a future digest, a preview screen) does not have to parse a rendered body back apart.
 */
export function buildScheduleNotificationContent(input: {
  eventName: string;
  eventType: ScheduleNotificationEvent;
  recipient: NotificationRecipient;
  shift?: NotificationShift;
  timezone: string;
}): NotificationEmailContent {
  if (input.eventType === scheduleNotificationEvents.schedulePublished) {
    return {
      subject: `${input.eventName} schedule is published`,
      to: input.recipient.email,
      greeting: greetingFor(input.recipient),
      intro: [`${input.eventName}'s official schedule is now available.`],
      details: [{ label: "Timezone", value: input.timezone, mono: true }],
      cta: viewScheduleCta,
    };
  }

  if (!input.shift) {
    throw new Error("Assignment notifications require shift details.");
  }

  const { subject, lead } = leadFor({
    eventName: input.eventName,
    eventType: input.eventType,
    shift: input.shift,
  });

  return shiftContent({
    recipient: input.recipient,
    eventType: input.eventType,
    subject,
    lead,
    shift: input.shift,
    timezone: input.timezone,
  });
}

export function buildScheduleNotificationEmail(input: {
  eventName: string;
  eventType: ScheduleNotificationEvent;
  recipient: NotificationRecipient;
  shift?: NotificationShift;
  timezone: string;
}): NotificationEmail {
  const content = buildScheduleNotificationContent(input);

  return {
    subject: content.subject,
    to: content.to,
    body: renderNotificationEmailText(content),
    html: renderNotificationEmailHtml(content),
  };
}
