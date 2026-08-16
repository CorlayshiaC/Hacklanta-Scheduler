import "server-only";

import {
  getAvailabilityEventById,
  getDefaultAvailabilityEvent,
  type AvailabilityEventWindow,
} from "@/lib/availability/event";
import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type AvailabilityWindow = Database["public"]["Tables"]["availability_windows"]["Row"];

export async function getMemberAvailabilityPageData(eventId?: string) {
  const context = await requireAuthenticatedUser();
  const event = eventId ? await getAvailabilityEventById(eventId) : await getDefaultAvailabilityEvent();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("availability_windows")
    .select("*")
    .eq("event_id", event.id)
    .eq("profile_id", context.profile.id)
    .eq("status", "available")
    .order("starts_at", { ascending: true });

  if (error) {
    throw new Error("Unable to load availability.");
  }

  return {
    event,
    profile: context.profile,
    windows: (data ?? []) as AvailabilityWindow[],
  };
}

export type { AvailabilityEventWindow };
