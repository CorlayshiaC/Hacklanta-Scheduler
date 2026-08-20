import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type MyScheduleAssignment = {
  id: string;
  shiftId: string;
  status: Database["public"]["Enums"]["assignment_status"];
  origin: string;
  shift: {
    id: string;
    eventId: string | null;
    eventName: string | null;
    title: string;
    startsAt: string;
    endsAt: string;
    location: string | null;
  };
  coverageRoleName: string | null;
};

/**
 * getMySchedule(profileId, range): a member's active assignments (draft/published/swap_pending, never
 * removed) whose shift starts within [range.from, range.to). Event-agnostic by design, unlike
 * src/lib/member/schedule.ts's HackLanta-II-only getMemberSchedulePageData: this is the multi-event
 * replacement other agents should code new my-schedule views against.
 */
export async function getMySchedule(
  profileId: string,
  range: { from: string; to: string },
): Promise<MyScheduleAssignment[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("shift_assignments")
    .select(
      "id, shift_id, status, origin, coverage_roles(name), shifts!inner(id, event_id, title, starts_at, ends_at, location, events(name))",
    )
    .eq("profile_id", profileId)
    .in("status", ["draft", "published", "swap_pending"])
    .gte("shifts.starts_at", range.from)
    .lt("shifts.starts_at", range.to)
    .order("starts_at", { referencedTable: "shifts", ascending: true });

  if (error) {
    throw new Error("Unable to load schedule.");
  }

  type Row = {
    id: string;
    shift_id: string;
    status: Database["public"]["Enums"]["assignment_status"];
    origin: string;
    coverage_roles: { name: string } | null;
    shifts: {
      id: string;
      event_id: string | null;
      title: string;
      starts_at: string;
      ends_at: string;
      location: string | null;
      events: { name: string } | null;
    };
  };

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    shiftId: row.shift_id,
    status: row.status,
    origin: row.origin,
    shift: {
      id: row.shifts.id,
      eventId: row.shifts.event_id,
      eventName: row.shifts.events?.name ?? null,
      title: row.shifts.title,
      startsAt: row.shifts.starts_at,
      endsAt: row.shifts.ends_at,
      location: row.shifts.location,
    },
    coverageRoleName: row.coverage_roles?.name ?? null,
  }));
}
