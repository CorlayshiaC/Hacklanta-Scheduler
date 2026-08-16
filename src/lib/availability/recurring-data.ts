import "server-only";

import { requireAuthenticatedUser, type AuthenticatedProfile } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type RecurringAvailabilityWindow = Database["public"]["Tables"]["recurring_availability_windows"]["Row"];

export type RecurringAvailabilityPageData = {
  profile: AuthenticatedProfile;
  windows: RecurringAvailabilityWindow[];
};

export async function getRecurringAvailabilityPageData(): Promise<RecurringAvailabilityPageData> {
  const context = await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("recurring_availability_windows")
    .select("*")
    .eq("profile_id", context.profile.id);

  if (error) {
    throw new Error("Unable to load recurring availability.");
  }

  return { profile: context.profile, windows: (data ?? []) as RecurringAvailabilityWindow[] };
}
