import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

export type AvailabilityEventWindow = Pick<
  EventRow,
  "id" | "name" | "starts_at" | "ends_at" | "timezone" | "status"
>;

export async function getAvailabilityEventById(eventId: string): Promise<AvailabilityEventWindow> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("events")
    .select("id,name,starts_at,ends_at,timezone,status")
    .eq("id", eventId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Event was not found.");
  }

  return data as AvailabilityEventWindow;
}

/**
 * Interim "which event" resolution for pages that don't yet have an event picker: no
 * event-switching UI exists yet (see docs/audit.md). Picks the most recently created
 * published event, falling back to the most recently created event of any status. Same
 * heuristic shape already used elsewhere in admin code. Replace call sites with an explicit
 * eventId once Agent 3 publishes a real event-context contract.
 */
export async function getDefaultAvailabilityEvent(): Promise<AvailabilityEventWindow> {
  const supabase = createSupabaseAdminClient();
  const { data: publishedRows, error: publishedError } = await supabase
    .from("events")
    .select("id,name,starts_at,ends_at,timezone,status")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(1);

  if (publishedError) {
    throw new Error("Unable to resolve the current event.");
  }

  const published = (publishedRows as AvailabilityEventWindow[] | null)?.[0];

  if (published) {
    return published;
  }

  const { data: fallbackRows, error: fallbackError } = await supabase
    .from("events")
    .select("id,name,starts_at,ends_at,timezone,status")
    .order("created_at", { ascending: false })
    .limit(1);

  const fallback = (fallbackRows as AvailabilityEventWindow[] | null)?.[0];

  if (fallbackError || !fallback) {
    throw new Error("No event is configured yet.");
  }

  return fallback;
}
