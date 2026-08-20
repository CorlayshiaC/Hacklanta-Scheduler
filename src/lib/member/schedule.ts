import "server-only";

import {
  getAvailabilityEventById,
  getDefaultAvailabilityEvent,
  type AvailabilityEventWindow,
} from "@/lib/availability/event";
import { requireAuthenticatedUser, type AuthenticatedProfile } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/db/rpc";
import type { Database } from "@/types/database";
import {
  getMemberScheduleSummary,
  groupMemberAssignmentsByDay,
  type MemberHours,
  type MemberScheduleAssignment,
  type MemberScheduleSummary,
} from "@/lib/member/schedule-helpers";

// Re-exported so every existing call site (this file's own callers, tests, and the client-side
// dashboard) keeps importing from "@/lib/member/schedule" unchanged. See schedule-helpers.ts for
// why the pure pieces live in a separate, non-server-only module.
export {
  getMemberScheduleSummary,
  groupMemberAssignmentsByDay,
  type MemberHours,
  type MemberScheduleAssignment,
  type MemberScheduleSummary,
};

type AssignmentRow = Database["public"]["Tables"]["shift_assignments"]["Row"];
type ShiftRow = Database["public"]["Tables"]["shifts"]["Row"];
type CoverageRoleRow = Database["public"]["Tables"]["coverage_roles"]["Row"];

export type AssignmentState = Database["public"]["Enums"]["assignment_state"];

export type MemberSchedulePageData = {
  assignments: MemberScheduleAssignment[];
  event: AvailabilityEventWindow;
  profile: AuthenticatedProfile;
  summary: MemberScheduleSummary;
  hours: MemberHours;
};

export async function getMemberHours(supabase: unknown, profileId: string, eventId: string): Promise<MemberHours> {
  const [eventResult, semesterResult] = await Promise.all([
    callRpc(supabase, "hours_per_event", { p_profile_id: profileId, p_event_id: eventId }),
    callRpc(supabase, "hours_semester", { p_profile_id: profileId }),
  ]);

  if (eventResult.error || semesterResult.error) {
    throw new Error("Unable to load scheduled hours.");
  }

  return { event: eventResult.data ?? 0, semester: semesterResult.data ?? 0 };
}

export async function getMemberSchedulePageData(eventId?: string): Promise<MemberSchedulePageData> {
  const context = await requireAuthenticatedUser();
  const event = eventId ? await getAvailabilityEventById(eventId) : await getDefaultAvailabilityEvent();
  const adminSupabase = createSupabaseAdminClient();
  const supabase = await createSupabaseServerClient();

  // Scope to this event's shifts first, then read the member's assignments against that set.
  const { data: eventShiftRows, error: eventShiftsError } = await adminSupabase
    .from("shifts")
    .select("id,event_id,title,starts_at,ends_at,location,notes")
    .eq("event_id", event.id);

  if (eventShiftsError) {
    throw new Error("Unable to load event shifts.");
  }

  const eventShifts = (eventShiftRows ?? []) as Pick<
    ShiftRow,
    "id" | "event_id" | "title" | "starts_at" | "ends_at" | "location" | "notes"
  >[];
  const eventShiftIds = eventShifts.map((shift) => shift.id);

  const hours = await getMemberHours(supabase, context.profile.id, event.id);

  if (eventShiftIds.length === 0) {
    return {
      assignments: [],
      event,
      profile: context.profile,
      summary: getMemberScheduleSummary([]),
      hours,
    };
  }

  const { data: assignmentRows, error: assignmentsError } = await supabase
    .from("shift_assignments")
    .select("id,shift_id,profile_id,coverage_role_id,assigned_by,state,published_at,created_at,updated_at")
    .eq("profile_id", context.profile.id)
    .in("shift_id", eventShiftIds)
    .in("state", ["in_approval", "approved"]);

  if (assignmentsError) {
    throw new Error("Unable to load assigned shifts.");
  }

  const assignments = (assignmentRows ?? []) as Omit<AssignmentRow, "status">[];
  const coverageRoleIds = Array.from(
    new Set(assignments.map((assignment) => assignment.coverage_role_id).filter((roleId): roleId is string => Boolean(roleId))),
  );
  const { data: coverageRoleRows, error: rolesError } =
    coverageRoleIds.length > 0
      ? await adminSupabase.from("coverage_roles").select("id,name").eq("event_id", event.id).in("id", coverageRoleIds)
      : { data: [] as Pick<CoverageRoleRow, "id" | "name">[], error: null };

  if (rolesError) {
    throw new Error("Unable to load assigned shift details.");
  }

  const shiftsById = new Map(eventShifts.map((shift) => [shift.id, shift]));
  const rolesById = new Map(((coverageRoleRows ?? []) as Pick<CoverageRoleRow, "id" | "name">[]).map((role) => [role.id, role]));
  const memberAssignments = assignments
    .map((assignment) => {
      const shift = shiftsById.get(assignment.shift_id);

      if (!shift) {
        return null;
      }

      return {
        ...assignment,
        coverageRole: assignment.coverage_role_id ? rolesById.get(assignment.coverage_role_id) ?? null : null,
        shift,
      };
    })
    .filter((assignment): assignment is MemberScheduleAssignment => assignment !== null)
    .toSorted((first, second) => first.shift.starts_at.localeCompare(second.shift.starts_at));

  return {
    assignments: memberAssignments,
    event,
    profile: context.profile,
    summary: getMemberScheduleSummary(memberAssignments),
    hours,
  };
}
