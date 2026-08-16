import "server-only";

import { buildScheduleNotificationEmail } from "@/lib/notifications/content";
import { deliverEmailNotification } from "@/lib/notifications/provider";
import type {
  NotificationDeliveryResult,
  NotificationEmail,
  NotificationRecipient,
  NotificationShift,
  ScheduleNotificationEvent,
} from "@/lib/notifications/types";

type NotificationProvider = (email: NotificationEmail) => Promise<NotificationDeliveryResult>;

export async function sendScheduleNotification(
  input: {
    eventName: string;
    eventType: ScheduleNotificationEvent;
    recipient: NotificationRecipient;
    shift?: NotificationShift;
    timezone: string;
  },
  provider: NotificationProvider = deliverEmailNotification,
): Promise<NotificationDeliveryResult> {
  if (!input.recipient.isActive) {
    return {
      ok: false,
      status: "unavailable",
      message: "Inactive recipients are not notified.",
    };
  }

  const email = buildScheduleNotificationEmail(input);

  try {
    return await provider(email);
  } catch (error) {
    console.error("Schedule notification delivery failed.", {
      eventType: input.eventType,
      recipientId: input.recipient.id,
      error: error instanceof Error ? error.message : "Unknown provider error",
    });

    return {
      ok: false,
      status: "failed",
      message: "Notification delivery failed.",
    };
  }
}
