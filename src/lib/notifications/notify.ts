import "server-only";

import { buildDiscordMessage, postToDiscord } from "@/lib/notifications/discord";
import { sendScheduleNotification } from "@/lib/notifications/service";
import type { NotificationShift, ScheduleNotificationEvent } from "@/lib/notifications/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json, TablesInsert } from "@/types/database";

type ProfileRow = { id: string; full_name: string; email: string; is_active: boolean };

export type NotifyInput = {
  /** profiles.id, not auth.users.id (same value, but this is the FK notify() actually writes). */
  profileIds: string[];
  kind: ScheduleNotificationEvent;
  eventName: string;
  timezone: string;
  /** Required for every kind except SCHEDULE_PUBLISHED, which has no single shift to describe. */
  shift?: NotificationShift;
  /**
   * Extra data for in-app rendering beyond what shift/eventName already carry. Merged into the
   * notifications.payload jsonb; the shift/eventName/timezone above are always included automatically.
   */
  extra?: Record<string, Json>;
};

/**
 * notify(): the dispatch function docs/contracts/schema.md commits to. Writes one notifications row per
 * recipient (in-app) and attempts email via the existing sendScheduleNotification/deliverEmailNotification
 * seam, both gated per-recipient by notification_preferences (a kind/channel with no row defaults to
 * enabled, matching "opt-out" rather than "opt-in"). Runs on the service-role client: notifications rows
 * are written outside RLS by design (see 20260816131400_notifications.sql), the same pattern
 * src/lib/member/schedule.ts already uses for cross-user reads.
 *
 * Deliberately takes one options object rather than notify(userIds, kind, payload) positionally: kind
 * alone isn't enough to build the email (eventName/timezone/shift are also required by
 * buildScheduleNotificationEmail), and a wide positional signature would just push those into an
 * ad-hoc payload shape anyway.
 */
export async function notify(input: NotifyInput): Promise<void> {
  if (input.profileIds.length === 0) {
    return;
  }

  const supabase = createSupabaseAdminClient();

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active")
    .in("id", input.profileIds);

  if (profilesError) {
    console.error("notify(): unable to load recipient profiles.", {
      kind: input.kind,
      error: profilesError.message,
    });
    return;
  }

  const activeProfiles = ((profiles ?? []) as ProfileRow[]).filter((profile) => profile.is_active);

  if (activeProfiles.length === 0) {
    return;
  }

  const { data: preferenceRows, error: preferencesError } = await supabase
    .from("notification_preferences")
    .select("profile_id, channel, enabled")
    .in(
      "profile_id",
      activeProfiles.map((profile) => profile.id),
    )
    .eq("kind", input.kind);

  if (preferencesError) {
    console.error("notify(): unable to load notification preferences, defaulting to enabled.", {
      kind: input.kind,
      error: preferencesError.message,
    });
  }

  const disabled = new Set(
    (preferenceRows ?? [])
      .filter((row) => !row.enabled)
      .map((row) => `${row.profile_id}:${row.channel}`),
  );
  const channelEnabled = (profileId: string, channel: "email" | "in_app") =>
    !disabled.has(`${profileId}:${channel}`);

  const payload: Json = {
    eventName: input.eventName,
    timezone: input.timezone,
    shift: (input.shift ?? null) as Json,
    ...input.extra,
  };

  const inAppRows: TablesInsert<"notifications">[] = activeProfiles
    .filter((profile) => channelEnabled(profile.id, "in_app"))
    .map((profile) => ({ profile_id: profile.id, kind: input.kind, payload }));

  if (inAppRows.length > 0) {
    const { error: insertError } = await supabase.from("notifications").insert(inAppRows as never);

    if (insertError) {
      console.error("notify(): failed to write in-app notifications.", {
        kind: input.kind,
        error: insertError.message,
      });
    }
  }

  await postToDiscordIfEnabled(supabase, input.kind, input.eventName, input.shift);

  await Promise.all(
    activeProfiles
      .filter((profile) => channelEnabled(profile.id, "email"))
      .map(async (profile) => {
        try {
          const result = await sendScheduleNotification({
            eventName: input.eventName,
            eventType: input.kind,
            recipient: {
              id: profile.id,
              email: profile.email,
              fullName: profile.full_name,
              isActive: profile.is_active,
            },
            shift: input.shift,
            timezone: input.timezone,
          });

          if (!result.ok) {
            console.warn("notify(): email not delivered.", {
              kind: input.kind,
              profileId: profile.id,
              status: result.status,
              message: result.message,
            });
          }
        } catch (error) {
          // buildScheduleNotificationEmail throws synchronously (outside sendScheduleNotification's own
          // try/catch) when a non-SCHEDULE_PUBLISHED kind is called without shift details. One caller
          // passing a bad kind/shift combination should not take down every other recipient's dispatch.
          console.error("notify(): building the email threw, in-app row was still written.", {
            kind: input.kind,
            profileId: profile.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }),
  );
}

/**
 * V2 Discord channel: org_settings.webhook_url must be set, and the kind must be in the org's
 * discord_notify_kinds allowlist ("respect a per-kind org toggle" per the shared brief; an unset or
 * empty allowlist means Discord posting is off entirely even with a webhook configured). One shared
 * check for every notify() call rather than each call site remembering to opt in.
 */
async function postToDiscordIfEnabled(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  kind: ScheduleNotificationEvent,
  eventName: string,
  shift?: NotificationShift,
): Promise<void> {
  const { data, error } = await supabase
    .from("org_settings")
    .select("webhook_url, discord_notify_kinds")
    .eq("id", true)
    .maybeSingle();

  if (error || !data?.webhook_url) {
    return;
  }

  const enabledKinds = Array.isArray(data.discord_notify_kinds) ? data.discord_notify_kinds : [];
  if (!enabledKinds.includes(kind)) {
    return;
  }

  const detail = shift ? `${shift.title}` : undefined;
  const result = await postToDiscord(
    data.webhook_url,
    buildDiscordMessage({ kind, eventName, detail }),
  );

  if (!result.ok) {
    console.warn("notify(): Discord post failed.", { kind, message: result.message });
  }
}
