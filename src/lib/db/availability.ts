import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type AvailabilityWindowRow = Database["public"]["Tables"]["availability_windows"]["Row"];

export type AvailabilityWindowForEvent = {
  id: string;
  profileId: string;
  startsAt: string;
  endsAt: string;
  note: string | null;
};

/**
 * getAvailabilityForWindow(eventId): every member's submitted availability for one event, organizer/
 * admin only per RLS (availability_windows_select_own_or_admin has no organizer branch yet; broadening
 * that is a schema-request away, not assumed here). Shape matches what the conflict engine
 * (src/lib/scheduling/conflict-engine.ts) and candidate recommendations expect as input.
 */
export async function getAvailabilityForWindow(eventId: string): Promise<AvailabilityWindowForEvent[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("availability_windows")
    .select("id, profile_id, starts_at, ends_at, note")
    .eq("event_id", eventId)
    .eq("status", "available")
    .order("starts_at", { ascending: true });

  if (error) {
    throw new Error("Unable to load availability for this event.");
  }

  return ((data ?? []) as AvailabilityWindowRow[]).map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    note: row.note,
  }));
}
