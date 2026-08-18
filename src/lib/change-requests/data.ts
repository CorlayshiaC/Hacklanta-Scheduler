import "server-only";

import { getAvailabilityEventById, getDefaultAvailabilityEvent, type AvailabilityEventWindow } from "@/lib/availability/event";
import { requireAuthenticatedUser, type AuthenticatedProfile } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ChangeRequestKind, ChangeRequestState } from "@/lib/change-requests/types";

type ChangeRequestRow = {
  id: string;
  event_id: string;
  assignment_id: string | null;
  requested_by: string;
  kind: ChangeRequestKind;
  target_user_id: string | null;
  claimed_by: string | null;
  state: ChangeRequestState;
  note: string | null;
  created_at: string;
};

export type SwapEligibleAssignment = {
  assignmentId: string;
  shiftTitle: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  state: "in_approval" | "approved";
};

export type ChangeRequestSummary = {
  id: string;
  kind: ChangeRequestKind;
  state: ChangeRequestState;
  shiftTitle: string | null;
  startsAt: string | null;
  isRequester: boolean;
  isClaimant: boolean;
};

export type OpenSwapBoardEntry = {
  id: string;
  kind: "swap_any" | "swap_with";
  shiftTitle: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  requestedByName: string;
  note: string | null;
};

export type RosterMember = { id: string; name: string };

export type ChangeRequestsPageData = {
  event: AvailabilityEventWindow;
  profile: AuthenticatedProfile;
  myShifts: SwapEligibleAssignment[];
  myAssignmentIdsWithOpenRequest: Set<string>;
  myRequests: ChangeRequestSummary[];
  openBoard: OpenSwapBoardEntry[];
};

export async function getChangeRequestsPageData(eventId?: string): Promise<ChangeRequestsPageData> {
  const context = await requireAuthenticatedUser();
  const event = eventId ? await getAvailabilityEventById(eventId) : await getDefaultAvailabilityEvent();
  const adminSupabase = createSupabaseAdminClient();
  const supabase = await createSupabaseServerClient();

  const { data: eventShiftRows, error: eventShiftsError } = await adminSupabase
    .from("shifts")
    .select("id,title,starts_at,ends_at,location")
    .eq("event_id", event.id);

  if (eventShiftsError) {
    throw new Error("Unable to load event shifts.");
  }

  const eventShifts = (eventShiftRows ?? []) as { id: string; title: string; starts_at: string; ends_at: string; location: string | null }[];
  const eventShiftIds = eventShifts.map((shift) => shift.id);
  const shiftsById = new Map(eventShifts.map((shift) => [shift.id, shift]));

  const [assignmentsResult, changeRequestsResult] = await Promise.all([
    eventShiftIds.length > 0
      ? supabase
          .from("shift_assignments")
          .select("id,shift_id,state")
          .eq("profile_id", context.profile.id)
          .in("shift_id", eventShiftIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("change_requests")
      .select("id,event_id,assignment_id,requested_by,kind,target_user_id,claimed_by,state,note,created_at")
      .eq("event_id", event.id)
      .order("created_at", { ascending: false }),
  ]);

  if (assignmentsResult.error) {
    throw new Error("Unable to load your shifts.");
  }

  if (changeRequestsResult.error) {
    throw new Error("Unable to load change requests.");
  }

  const assignments = (assignmentsResult.data ?? []) as { id: string; shift_id: string; state: string }[];
  const myShifts: SwapEligibleAssignment[] = assignments
    .filter((assignment) => assignment.state === "in_approval" || assignment.state === "approved")
    .map((assignment) => {
      const shift = shiftsById.get(assignment.shift_id);
      if (!shift) return null;
      return {
        assignmentId: assignment.id,
        shiftTitle: shift.title,
        startsAt: shift.starts_at,
        endsAt: shift.ends_at,
        location: shift.location,
        state: assignment.state as "in_approval" | "approved",
      };
    })
    .filter((row): row is SwapEligibleAssignment => row !== null)
    .toSorted((first, second) => first.startsAt.localeCompare(second.startsAt));

  const requestRows = (changeRequestsResult.data ?? []) as ChangeRequestRow[];
  const myRows = requestRows.filter(
    (row) => row.requested_by === context.profile.id || row.claimed_by === context.profile.id,
  );
  const openBoardRows = requestRows.filter(
    (row) =>
      row.state === "open" &&
      (row.kind === "swap_any" || row.kind === "swap_with") &&
      row.requested_by !== context.profile.id &&
      (row.kind !== "swap_with" || row.target_user_id === context.profile.id),
  );

  const assignmentIdsToResolve = Array.from(
    new Set([...myRows, ...openBoardRows].map((row) => row.assignment_id).filter((id): id is string => Boolean(id))),
  );
  const { data: linkedAssignmentRows } =
    assignmentIdsToResolve.length > 0
      ? await adminSupabase.from("shift_assignments").select("id,shift_id").in("id", assignmentIdsToResolve)
      : { data: [] as { id: string; shift_id: string }[] };
  const shiftIdByAssignmentId = new Map(((linkedAssignmentRows ?? []) as { id: string; shift_id: string }[]).map((row) => [row.id, row.shift_id]));

  const requesterIds = Array.from(new Set(openBoardRows.map((row) => row.requested_by)));
  const { data: requesterProfileRows } =
    requesterIds.length > 0
      ? await adminSupabase.from("profiles").select("id,full_name").in("id", requesterIds)
      : { data: [] as { id: string; full_name: string }[] };
  const requesterNameById = new Map(((requesterProfileRows ?? []) as { id: string; full_name: string }[]).map((row) => [row.id, row.full_name]));

  const myRequests: ChangeRequestSummary[] = myRows.map((row) => {
    const shiftId = row.assignment_id ? shiftIdByAssignmentId.get(row.assignment_id) : null;
    const shift = shiftId ? shiftsById.get(shiftId) : null;
    return {
      id: row.id,
      kind: row.kind,
      state: row.state,
      shiftTitle: shift?.title ?? (row.kind === "more_hours" ? event.name : "Shift"),
      startsAt: shift?.starts_at ?? null,
      isRequester: row.requested_by === context.profile.id,
      isClaimant: row.claimed_by === context.profile.id,
    };
  });

  const openBoard: OpenSwapBoardEntry[] = openBoardRows
    .map((row) => {
      const shiftId = row.assignment_id ? shiftIdByAssignmentId.get(row.assignment_id) : null;
      const shift = shiftId ? shiftsById.get(shiftId) : null;
      if (!shift) return null;
      return {
        id: row.id,
        kind: row.kind as "swap_any" | "swap_with",
        shiftTitle: shift.title,
        startsAt: shift.starts_at,
        endsAt: shift.ends_at,
        location: shift.location,
        requestedByName: requesterNameById.get(row.requested_by) ?? "A member",
        note: row.note,
      };
    })
    .filter((row): row is OpenSwapBoardEntry => row !== null)
    .toSorted((first, second) => first.startsAt.localeCompare(second.startsAt));

  return {
    event,
    profile: context.profile,
    myShifts,
    myAssignmentIdsWithOpenRequest: new Set(
      myRows
        .filter((row) => row.state === "open" && row.requested_by === context.profile.id)
        .map((row) => row.assignment_id)
        .filter((id): id is string => Boolean(id)),
    ),
    myRequests,
    openBoard,
  };
}

/** Co-workers on this event (excluding the caller), for the "swap with a specific person" picker. Uses the admin client since a member's own `profiles` row is the only one RLS lets them read directly. */
export async function getEventRosterForSwap(eventId: string, excludeProfileId: string): Promise<RosterMember[]> {
  const adminSupabase = createSupabaseAdminClient();

  const { data: shiftRows, error: shiftsError } = await adminSupabase.from("shifts").select("id").eq("event_id", eventId);
  if (shiftsError) {
    throw new Error("Unable to load event roster.");
  }

  const shiftIds = ((shiftRows ?? []) as { id: string }[]).map((row) => row.id);
  if (shiftIds.length === 0) {
    return [];
  }

  const { data: assignmentRows, error: assignmentsError } = await adminSupabase
    .from("shift_assignments")
    .select("profile_id,state")
    .in("shift_id", shiftIds);

  if (assignmentsError) {
    throw new Error("Unable to load event roster.");
  }

  const profileIds = Array.from(
    new Set(
      ((assignmentRows ?? []) as { profile_id: string; state: string }[])
        .filter((row) => (row.state === "in_approval" || row.state === "approved") && row.profile_id !== excludeProfileId)
        .map((row) => row.profile_id),
    ),
  );

  if (profileIds.length === 0) {
    return [];
  }

  const { data: profileRows, error: profilesError } = await adminSupabase
    .from("profiles")
    .select("id,full_name")
    .in("id", profileIds)
    .order("full_name", { ascending: true });

  if (profilesError) {
    throw new Error("Unable to load event roster.");
  }

  return ((profileRows ?? []) as { id: string; full_name: string }[]).map((row) => ({ id: row.id, name: row.full_name }));
}
