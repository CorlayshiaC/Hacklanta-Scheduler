import "server-only";

import { differenceInHours, listCalendarDaysInRange } from "@/lib/availability/time";
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

type AssignmentRow = Database["public"]["Tables"]["shift_assignments"]["Row"];
type ShiftRow = Database["public"]["Tables"]["shifts"]["Row"];
type CoverageRoleRow = Database["public"]["Tables"]["coverage_roles"]["Row"];

export type AssignmentState = Database["public"]["Enums"]["assignment_state"];

export type MemberScheduleAssignment = Omit<AssignmentRow, "status"> & {
  coverageRole: Pick<CoverageRoleRow, "id" | "name"> | null;
  shift: Pick<ShiftRow, "id" | "event_id" | "title" | "starts_at" | "ends_at" | "location" | "notes">;
};

export type MemberScheduleSummary = {
  assignedShiftCount: number;
  assignedHours: number;
  nextAssignment: MemberScheduleAssignment | null;
};

export type MemberHours = {
  event: number;
  semester: number;
};

export type MemberSchedulePageData = {
  assignments: MemberScheduleAssignment[];
  event: AvailabilityEventWindow;
  profile: AuthenticatedProfile;
  summary: MemberScheduleSummary;
  hours: MemberHours;
};

export function getMemberScheduleSummary(assignments: MemberScheduleAssignment[]): MemberScheduleSummary {
  const now = Date.now();
  const upcomingAssignments = assignments.filter(
    (assignment) => new Date(assignment.shift.starts_at).getTime() >= now,
  );

  return {
    assignedShiftCount: assignments.length,
    assignedHours:
      Math.round(
        assignments.reduce(
          (total, assignment) => total + differenceInHours(assignment.shift.starts_at, assignment.shift.ends_at),
          0,
        ) * 100,
      ) / 100,
    nextAssignment: upcomingAssignments[0] ?? assignments[0] ?? null,
  };
}

export function groupMemberAssignmentsByDay(assignments: MemberScheduleAssignment[], event: AvailabilityEventWindow) {
  const days = listCalendarDaysInRange(event.starts_at, event.ends_at, event.timezone);

  return days.map((dayId) => ({
    label: dayId,
    value: dayId,
    assignments: assignments
      .filter((assignment) => {
        const startDay = new Intl.DateTimeFormat("en-CA", {
          timeZone: event.timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(assignment.shift.starts_at));
        return startDay === dayId;
      })
      .toSorted((first, second) => first.shift.starts_at.localeCompare(second.shift.starts_at)),
  }));
}

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
