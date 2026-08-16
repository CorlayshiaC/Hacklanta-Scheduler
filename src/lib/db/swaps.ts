import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type OpenSwap = {
  id: string;
  kind: Database["public"]["Enums"]["swap_request_kind"];
  note: string | null;
  createdAt: string;
  requestedBy: { id: string; fullName: string };
  assignment: {
    id: string;
    shiftId: string;
    coverageRoleName: string | null;
  };
  shift: {
    id: string;
    eventId: string | null;
    title: string;
    startsAt: string;
    endsAt: string;
    location: string | null;
  };
};

/**
 * getOpenSwaps(): every swap_requests row still status = 'open', shaped for a shared "open swaps" board
 * (both the member self-service claim list and the organizer approval queue read the same shape). RLS
 * already scopes this to what the calling user is allowed to see (own rows, or everything for
 * organizer/admin); this helper does not add its own scoping on top.
 */
export async function getOpenSwaps(): Promise<OpenSwap[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("swap_requests")
    .select(
      "id, kind, note, created_at, profiles!swap_requests_requested_by_fkey(id, full_name), shift_assignments!inner(id, shift_id, coverage_roles(name), shifts(id, event_id, title, starts_at, ends_at, location))",
    )
    .eq("status", "open")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("Unable to load open swap requests.");
  }

  type Row = {
    id: string;
    kind: Database["public"]["Enums"]["swap_request_kind"];
    note: string | null;
    created_at: string;
    profiles: { id: string; full_name: string } | null;
    shift_assignments: {
      id: string;
      shift_id: string;
      coverage_roles: { name: string } | null;
      shifts: {
        id: string;
        event_id: string | null;
        title: string;
        starts_at: string;
        ends_at: string;
        location: string | null;
      };
    };
  };

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    kind: row.kind,
    note: row.note,
    createdAt: row.created_at,
    requestedBy: {
      id: row.profiles?.id ?? "",
      fullName: row.profiles?.full_name ?? "Unknown member",
    },
    assignment: {
      id: row.shift_assignments.id,
      shiftId: row.shift_assignments.shift_id,
      coverageRoleName: row.shift_assignments.coverage_roles?.name ?? null,
    },
    shift: {
      id: row.shift_assignments.shifts.id,
      eventId: row.shift_assignments.shifts.event_id,
      title: row.shift_assignments.shifts.title,
      startsAt: row.shift_assignments.shifts.starts_at,
      endsAt: row.shift_assignments.shifts.ends_at,
      location: row.shift_assignments.shifts.location,
    },
  }));
}
