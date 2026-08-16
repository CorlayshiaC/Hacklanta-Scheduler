import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/types/database";

export type CalendarTokenResult = {
  token: string;
  /** Relative path, e.g. "/api/feeds/mine/<token>". Callers prefix an origin as needed. */
  url: string;
};

function toResult(token: string): CalendarTokenResult {
  return { token, url: `/api/feeds/mine/${token}` };
}

/**
 * getOrCreateCalendarToken(profileId): the "subscribe to my schedule" entry point for the settings page.
 * Reuses an existing non-revoked calendar_tokens row for the caller if one exists (RLS scopes selects to
 * the caller's own rows, so profileId here must be the signed-in user's own profile id, matching the
 * owner-only insert policy too), otherwise mints a new opaque token. crypto.randomUUID() is fine as the
 * token value: it isn't a session credential, just an unguessable identifier for an inherently low-value
 * feed (a member's own shift schedule), the same trust level as share_tokens.
 */
export async function getOrCreateCalendarToken(profileId: string): Promise<CalendarTokenResult> {
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: selectError } = await supabase
    .from("calendar_tokens")
    .select("token")
    .eq("profile_id", profileId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selectError) {
    throw new Error("Unable to look up an existing calendar token.");
  }

  if (existing) {
    return toResult((existing as { token: string }).token);
  }

  const token = crypto.randomUUID();
  const insert: TablesInsert<"calendar_tokens"> = { profile_id: profileId, token };

  const { data: created, error: insertError } = await supabase
    .from("calendar_tokens")
    .insert(insert as never)
    .select("token")
    .single();

  if (insertError || !created) {
    throw new Error("Unable to create a calendar token.");
  }

  return toResult((created as { token: string }).token);
}

/**
 * revokeCalendarToken(id): sets revoked_at on the caller's own row. RLS's owner-only update policy means
 * this silently affects zero rows (not an error) if `id` doesn't belong to the caller, which is the
 * correct behavior for "revoke my token", not something this function needs to special-case.
 */
export async function revokeCalendarToken(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("calendar_tokens")
    .update({ revoked_at: new Date().toISOString() } as never)
    .eq("id", id);

  if (error) {
    throw new Error("Unable to revoke this calendar token.");
  }
}
