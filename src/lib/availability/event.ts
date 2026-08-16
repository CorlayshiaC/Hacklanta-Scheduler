import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

export type HackLantaAvailabilityEvent = Pick<
  EventRow,
  "id" | "name" | "starts_at" | "ends_at" | "timezone" | "status"
>;

export async function getHackLantaIIAvailabilityEvent(): Promise<HackLantaAvailabilityEvent> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("events")
    .select("id,name,starts_at,ends_at,timezone,status")
    .eq("name", "HackLanta II")
    .maybeSingle();

  if (error || !data) {
    throw new Error("HackLanta II event is not configured.");
  }

  return data as HackLantaAvailabilityEvent;
}
