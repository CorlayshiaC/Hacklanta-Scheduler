import "server-only";

import { Resend } from "resend";
import { getEmailProviderEnv } from "@/lib/env.server";
import type {
  NotificationDeliveryResult,
  NotificationEmail,
} from "@/lib/notifications/types";

/**
 * Real delivery via Resend, gated behind RESEND_API_KEY the same way Agent 6's Gemini wrapper gates on
 * GEMINI_API_KEY: unset means "not configured," not an error, and the caller (sendScheduleNotification)
 * already treats "unavailable" as a normal, loggable-but-non-fatal outcome.
 */
export async function deliverEmailNotification(
  email: NotificationEmail,
): Promise<NotificationDeliveryResult> {
  const env = getEmailProviderEnv();

  if (!env.RESEND_API_KEY || !env.NOTIFICATIONS_FROM_EMAIL) {
    return {
      ok: false,
      status: "unavailable",
      message: "Transactional email delivery is not configured.",
    };
  }

  const resend = new Resend(env.RESEND_API_KEY);
  // Both parts on every send (multipart/alternative): the HTML part is what almost everyone sees,
  // the text part is what a text-only client renders and what spam filters score. Sending HTML
  // alone measurably hurts deliverability, and this content has a real text rendering already.
  const { error } = await resend.emails.send({
    from: env.NOTIFICATIONS_FROM_EMAIL,
    to: email.to,
    subject: email.subject,
    html: email.html,
    text: email.body,
  });

  if (error) {
    return {
      ok: false,
      status: "failed",
      message: error.message,
    };
  }

  return { ok: true, status: "sent" };
}
