import "server-only";

import { getAvailabilityEventById, getDefaultAvailabilityEvent } from "@/lib/availability/event";
import { requireAuthenticatedUser, type AuthenticatedProfile } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AvailabilityEventWindow } from "@/lib/availability/event";
import type { Database } from "@/types/database";

export type SwapEligibleAssignment = {
  assignmentId: string;
  shiftTitle: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  status: "draft" | "published";
};

export type MySwapRequest = {
  id: string;
  shiftTitle: string;
  startsAt: string;
  kind: Database["public"]["Enums"]["swap_request_kind"];
  status: Database["public"]["Enums"]["swap_request_status"];
  isRequester: boolean;
};

export type SwapsPageData = {
  event: AvailabilityEventWindow;
  profile: AuthenticatedProfile;
  myShifts: SwapEligibleAssignment[];
  myAssignmentIdsWithOpenRequest: Set<string>;
  mySwapRequests: MySwapRequest[];
};

/**
 * STUB(agent-2): "my shifts" and "my swap requests" are real reads (own rows, RLS allows them).
 * The open-swap board (other members' open requests) is not built here: the current
 * swap_requests SELECT policy only allows the requester, claimant, or organizer to read a row,
 * so a browsing member cannot see requests they have not touched yet. Filed in
 * docs/contracts/requests.md, asking Agent 2 to widen SELECT to any authenticated member when
 * status = 'open'. Tracking removal: grep STUB(agent-2).
 */
export async function getSwapsPageData(eventId?: string): Promise<SwapsPageData> {
  const context = await requireAuthenticatedUser();
  const event = eventId ? await getAvailabilityEventById(eventId) : await getDefaultAvailabilityEvent();
  const adminSupabase = createSupabaseAdminClient();

  const { data: eventShiftRows, error: eventShiftsError } = await adminSupabase
    .from("shifts")
    .select("id")
    .eq("event_id", event.id);

  if (eventShiftsError) {
    throw new Error("Unable to load event shifts.");
  }

  const eventShiftIds = ((eventShiftRows ?? []) as { id: string }[]).map((row) => row.id);
  const supabase = await createSupabaseServerClient();

  const [assignmentsResult, swapRequestsResult] = await Promise.all([
    eventShiftIds.length > 0
      ? supabase
          .from("shift_assignments")
          .select("id,shift_id,status")
          .eq("profile_id", context.profile.id)
          .in("shift_id", eventShiftIds)
          .in("status", ["draft", "published"])
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("swap_requests")
      .select("id,shift_assignment_id,requested_by,claimed_by,kind,status")
      .order("created_at", { ascending: false }),
  ]);

  if (assignmentsResult.error) {
    throw new Error("Unable to load your shifts.");
  }

  if (swapRequestsResult.error) {
    throw new Error("Unable to load your swap requests.");
  }

  const assignments = (assignmentsResult.data ?? []) as { id: string; shift_id: string; status: "draft" | "published" }[];
  const shiftIds = assignments.map((assignment) => assignment.shift_id);

  const { data: shiftRows, error: shiftsError } =
    shiftIds.length > 0
      ? await adminSupabase.from("shifts").select("id,title,starts_at,ends_at,location").in("id", shiftIds)
      : { data: [] as { id: string; title: string; starts_at: string; ends_at: string; location: string | null }[], error: null };

  if (shiftsError) {
    throw new Error("Unable to load shift details.");
  }

  const shiftsById = new Map(
    ((shiftRows ?? []) as { id: string; title: string; starts_at: string; ends_at: string; location: string | null }[]).map(
      (shift) => [shift.id, shift],
    ),
  );

  const myShifts: SwapEligibleAssignment[] = assignments
    .map((assignment) => {
      const shift = shiftsById.get(assignment.shift_id);
      if (!shift) return null;
      return {
        assignmentId: assignment.id,
        shiftTitle: shift.title,
        startsAt: shift.starts_at,
        endsAt: shift.ends_at,
        location: shift.location,
        status: assignment.status,
      };
    })
    .filter((row): row is SwapEligibleAssignment => row !== null)
    .toSorted((first, second) => first.startsAt.localeCompare(second.startsAt));

  const swapRequestRows = (swapRequestsResult.data ?? []) as {
    id: string;
    shift_assignment_id: string;
    requested_by: string;
    claimed_by: string | null;
    kind: Database["public"]["Enums"]["swap_request_kind"];
    status: Database["public"]["Enums"]["swap_request_status"];
  }[];
  const assignmentIdsForSwapLookup = Array.from(new Set(swapRequestRows.map((row) => row.shift_assignment_id)));
  const { data: swapAssignmentRows } =
    assignmentIdsForSwapLookup.length > 0
      ? await adminSupabase.from("shift_assignments").select("id,shift_id").in("id", assignmentIdsForSwapLookup)
      : { data: [] as { id: string; shift_id: string }[] };
  const shiftIdByAssignmentId = new Map(((swapAssignmentRows ?? []) as { id: string; shift_id: string }[]).map((row) => [row.id, row.shift_id]));
  const swapShiftIds = Array.from(new Set(Array.from(shiftIdByAssignmentId.values())));
  const { data: swapShiftRows } =
    swapShiftIds.length > 0
      ? await adminSupabase.from("shifts").select("id,title,starts_at").in("id", swapShiftIds)
      : { data: [] as { id: string; title: string; starts_at: string }[] };
  const swapShiftById = new Map(
    ((swapShiftRows ?? []) as { id: string; title: string; starts_at: string }[]).map((row) => [row.id, row]),
  );

  const mySwapRequests: MySwapRequest[] = swapRequestRows.map((row) => {
    const shiftId = shiftIdByAssignmentId.get(row.shift_assignment_id);
    const shift = shiftId ? swapShiftById.get(shiftId) : undefined;
    return {
      id: row.id,
      shiftTitle: shift?.title ?? "Shift",
      startsAt: shift?.starts_at ?? "",
      kind: row.kind,
      status: row.status,
      isRequester: row.requested_by === context.profile.id,
    };
  });

  return {
    event,
    profile: context.profile,
    myShifts,
    myAssignmentIdsWithOpenRequest: new Set(
      swapRequestRows.filter((row) => row.status === "open").map((row) => row.shift_assignment_id),
    ),
    mySwapRequests,
  };
}
