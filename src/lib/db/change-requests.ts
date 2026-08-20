import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type OpenChangeRequest = {
  id: string;
  kind: Database["public"]["Enums"]["change_request_kind"];
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
 * getOpenChangeRequests(): every change_requests row still state = 'open' and of a claimable kind
 * (swap_any/swap_with -- drop/cant_make_time/more_hours go straight to director resolution, there's
 * nothing for a peer to claim), shaped for a shared "open swaps" board (both the member self-service
 * claim list and the director/admin approval queue read the same shape). RLS already scopes this to
 * what the calling user is allowed to see (any open swap_any/swap_with row, plus their own rows in any
 * state, plus everything a director/admin has authority over, see 20260817000300); this helper does
 * not add its own scoping on top.
 *
 * V2 rename from getOpenSwaps()/swap_requests: no callers existed anywhere in the codebase at the time
 * of this migration (verified via grep), so this is a clean rename, not a deprecated alias.
 */
export async function getOpenChangeRequests(): Promise<OpenChangeRequest[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("change_requests")
    .select(
      "id, kind, note, created_at, profiles!change_requests_requested_by_fkey(id, full_name), shift_assignments!inner(id, shift_id, coverage_roles(name), shifts(id, event_id, title, starts_at, ends_at, location))",
    )
    .eq("state", "open")
    .in("kind", ["swap_any", "swap_with"])
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("Unable to load open change requests.");
  }

  type Row = {
    id: string;
    kind: Database["public"]["Enums"]["change_request_kind"];
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
