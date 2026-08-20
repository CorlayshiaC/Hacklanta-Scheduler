import "server-only";

import webpush from "web-push";
import { getPushProviderEnv } from "@/lib/env.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PushDeliveryResult =
  | { ok: true; sent: number }
  | { ok: false; reason: "not_configured"; message: string };

/**
 * Sends a Web Push notification to every subscription on file for a user, gated behind
 * VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY the same way Resend/Gemini gate on their own keys: unset means
 * "not configured," not an error. Reminder kinds (24h/1h) are the intended caller (the shared V2
 * brief: "sendPush helper wired into the reminder kinds"), but this takes a plain title/body so any
 * future kind can reuse it without a new function.
 *
 * A subscription that the browser has revoked responds with 404/410; those rows are deleted here
 * rather than left to fail forever on every future push.
 */
export async function sendPush(
  userId: string,
  payload: { title: string; body: string; url?: string },
): Promise<PushDeliveryResult> {
  const env = getPushProviderEnv();

  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    return { ok: false, reason: "not_configured", message: "Push notifications are not configured." };
  }

  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);

  const supabase = createSupabaseAdminClient();
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, keys")
    .eq("user_id", userId);

  const rows = (subscriptions ?? []) as { id: string; endpoint: string; keys: unknown }[];
  const body = JSON.stringify(payload);
  let sent = 0;
  const staleIds: string[] = [];

  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: row.keys as { p256dh: string; auth: string },
          },
          body,
        );
        sent += 1;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          staleIds.push(row.id);
        } else {
          console.warn("sendPush(): delivery failed.", {
            userId,
            error: error instanceof Error ? error.message : "Unknown push error",
          });
        }
      }
    }),
  );

  if (staleIds.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", staleIds);
  }

  return { ok: true, sent };
}
