import "server-only";

import type {
  NotificationDeliveryResult,
  NotificationEmail,
} from "@/lib/notifications/types";

export async function deliverEmailNotification(
  email: NotificationEmail,
): Promise<NotificationDeliveryResult> {
  void email;

  return {
    ok: false,
    status: "unavailable",
    message: "Transactional email delivery is not configured.",
  };
}
