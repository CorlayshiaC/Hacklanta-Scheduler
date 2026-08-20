"use server";

import { revalidatePath } from "next/cache";
import { requireDirectorOf } from "@/lib/auth/authorization";
import { buildDiscordMessage, postToDiscord } from "@/lib/notifications/discord";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/types/database";

export type AnnouncementActionResult = { ok: true } | { ok: false; message: string };

/**
 * Posts an announcement and, when the org has a webhook configured and ANNOUNCEMENT_POSTED in its
 * discord_notify_kinds allowlist, fires the Discord post directly (announcements aren't shift-shaped,
 * so this doesn't go through notify()/buildScheduleNotificationEmail the way assignment/schedule kinds
 * do, see src/lib/notifications/notify.ts's postToDiscordIfEnabled for that path). RLS
 * (announcements_admin_or_director_insert) is the real authorization boundary; requireDirectorOf()
 * here is the redirect-on-unauthorized UX layer in front of it.
 */
export async function createAnnouncementAction(
  eventId: string,
  body: string,
): Promise<AnnouncementActionResult> {
  await requireDirectorOf(eventId);

  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return { ok: false, message: "Announcement cannot be empty." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return { ok: false, message: "You need to sign in again." };
  }

  const insert: TablesInsert<"announcements"> = {
    event_id: eventId,
    author_id: authData.user.id,
    body: trimmed,
  };

  const { data: inserted, error } = await supabase
    .from("announcements")
    .insert(insert as never)
    .select("id, events(name)")
    .single();

  if (error || !inserted) {
    return { ok: false, message: "Unable to post announcement." };
  }

  await maybePostAnnouncementToDiscord(
    (inserted as unknown as { id: string; events: { name: string } | null }).id,
    (inserted as unknown as { id: string; events: { name: string } | null }).events?.name ??
      "Event",
    trimmed,
    eventId,
  );

  revalidatePath(`/events/${eventId}`);
  return { ok: true };
}

async function maybePostAnnouncementToDiscord(
  announcementId: string,
  eventName: string,
  body: string,
  eventId: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();

  const { data: settings } = await admin
    .from("org_settings")
    .select("webhook_url, discord_notify_kinds")
    .eq("id", true)
    .maybeSingle();

  if (!settings?.webhook_url) {
    return;
  }

  const enabledKinds = Array.isArray(settings.discord_notify_kinds)
    ? settings.discord_notify_kinds
    : [];
  if (!enabledKinds.includes("ANNOUNCEMENT_POSTED")) {
    return;
  }

  const result = await postToDiscord(
    settings.webhook_url,
    buildDiscordMessage({ kind: "ANNOUNCEMENT_POSTED", eventName, detail: body }),
  );

  if (result.ok) {
    await admin
      .from("announcements")
      .update({ discord_posted_at: new Date().toISOString() } as never)
      .eq("id", announcementId);
  } else {
    console.warn("createAnnouncementAction(): Discord post failed.", {
      eventId,
      announcementId,
      message: result.message,
    });
  }
}
