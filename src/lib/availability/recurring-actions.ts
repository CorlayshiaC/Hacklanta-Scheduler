"use server";

import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/types/database";

export type SyncRecurringAvailabilityResult = { ok: true } | { ok: false; message: string };

/**
 * Replaces the member's full recurring-availability set in one call, same replace-not-diff
 * shape as syncEventAvailabilityAction and for the same reason: the grid owns the whole
 * selection, and a full replace avoids partial-failure inconsistency from a delta of adds/removes.
 */
export async function syncRecurringAvailabilityAction(
  windows: { dayOfWeek: number; startsAtLocal: string; endsAtLocal: string }[],
): Promise<SyncRecurringAvailabilityResult> {
  const context = await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();

  const { error: deleteError } = await supabase
    .from("recurring_availability_windows")
    .delete()
    .eq("profile_id", context.profile.id);

  if (deleteError) {
    return { ok: false, message: "Unable to save recurring availability." };
  }

  if (windows.length === 0) {
    return { ok: true };
  }

  const inserts: TablesInsert<"recurring_availability_windows">[] = windows.map((window) => ({
    profile_id: context.profile.id,
    day_of_week: window.dayOfWeek,
    starts_at_local: window.startsAtLocal,
    ends_at_local: window.endsAtLocal,
  }));

  const { error: insertError } = await supabase.from("recurring_availability_windows").insert(inserts as never);

  if (insertError) {
    return { ok: false, message: "Unable to save recurring availability." };
  }

  return { ok: true };
}
