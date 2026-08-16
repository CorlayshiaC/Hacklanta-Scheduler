import "server-only";

import { formatInputDateInTimeZone, differenceInHours } from "@/lib/availability/time";
import { getHackLantaIIAvailabilityEvent, type HackLantaAvailabilityEvent } from "@/lib/availability/event";
import { requireAuthenticatedUser, type AuthenticatedProfile } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type AssignmentRow = Database["public"]["Tables"]["shift_assignments"]["Row"];
type ShiftRow = Database["public"]["Tables"]["shifts"]["Row"];
type CoverageRoleRow = Database["public"]["Tables"]["coverage_roles"]["Row"];
type PublicationRow = Database["public"]["Tables"]["schedule_publications"]["Row"];

export type ActiveAssignmentStatus = "draft" | "published";

export type MemberScheduleAssignment = Omit<AssignmentRow, "status"> & {
  coverageRole: Pick<CoverageRoleRow, "id" | "name"> | null;
  shift: Pick<
    ShiftRow,
    "id" | "event_id" | "title" | "starts_at" | "ends_at" | "location" | "notes"
  >;
  status: ActiveAssignmentStatus;
};

export type MemberScheduleSummary = {
  assignedShiftCount: number;
  assignedHours: number;
  nextAssignment: MemberScheduleAssignment | null;
};

export type MemberSchedulePageData = {
  assignments: MemberScheduleAssignment[];
  event: HackLantaAvailabilityEvent;
  publication: Pick<PublicationRow, "id" | "published_at"> | null;
  profile: AuthenticatedProfile;
  summary: MemberScheduleSummary;
};

export const memberScheduleDays = [
  { label: "Friday, October 9", value: "2026-10-09" },
  { label: "Saturday, October 10", value: "2026-10-10" },
  { label: "Sunday, October 11", value: "2026-10-11" },
];

function activeAssignmentStatus(status: string): status is ActiveAssignmentStatus {
  return status === "draft" || status === "published";
}

export function getMemberScheduleSummary(assignments: MemberScheduleAssignment[]): MemberScheduleSummary {
  const now = Date.now();
  const upcomingAssignments = assignments.filter(
    (assignment) => new Date(assignment.shift.starts_at).getTime() >= now,
  );

  return {
    assignedShiftCount: assignments.length,
    assignedHours: Math.round(
      assignments.reduce(
        (total, assignment) =>
          total + differenceInHours(assignment.shift.starts_at, assignment.shift.ends_at),
        0,
      ) * 100,
    ) / 100,
    nextAssignment: upcomingAssignments[0] ?? assignments[0] ?? null,
  };
}

export function groupMemberAssignmentsByDay(
  assignments: MemberScheduleAssignment[],
  eventTimezone: string,
) {
  return memberScheduleDays.map((day) => ({
    ...day,
    assignments: assignments
      .filter((assignment) => formatInputDateInTimeZone(assignment.shift.starts_at, eventTimezone) === day.value)
      .toSorted((first, second) => first.shift.starts_at.localeCompare(second.shift.starts_at)),
  }));
}

export async function getMemberSchedulePageData(): Promise<MemberSchedulePageData> {
  const context = await requireAuthenticatedUser();
  const event = await getHackLantaIIAvailabilityEvent();
  const supabase = await createSupabaseServerClient();
  const { data: assignmentRows, error: assignmentsError } = await supabase
    .from("shift_assignments")
    .select("id,shift_id,profile_id,coverage_role_id,assigned_by,status,published_at,created_at,updated_at")
    .eq("profile_id", context.profile.id)
    .in("status", ["draft", "published"]);

  if (assignmentsError) {
    throw new Error("Unable to load assigned shifts.");
  }

  const assignments = ((assignmentRows ?? []) as AssignmentRow[]).filter(
    (assignment): assignment is AssignmentRow & { status: ActiveAssignmentStatus } =>
      activeAssignmentStatus(assignment.status),
  );
  const shiftIds = Array.from(new Set(assignments.map((assignment) => assignment.shift_id)));
  const coverageRoleIds = Array.from(
    new Set(
      assignments
        .map((assignment) => assignment.coverage_role_id)
        .filter((roleId): roleId is string => Boolean(roleId)),
    ),
  );

  const adminSupabase = createSupabaseAdminClient();
  const { data: publicationRows, error: publicationError } = await adminSupabase
    .from("schedule_publications")
    .select("id,published_at")
    .eq("event_id", event.id)
    .order("published_at", { ascending: false })
    .limit(1);

  if (publicationError) {
    throw new Error("Unable to load schedule publication state.");
  }

  const publication = (publicationRows?.[0] as Pick<PublicationRow, "id" | "published_at"> | undefined) ?? null;

  if (shiftIds.length === 0) {
    return {
      assignments: [],
      event,
      publication,
      profile: context.profile,
      summary: getMemberScheduleSummary([]),
    };
  }

  const [{ data: shiftRows, error: shiftsError }, { data: coverageRoleRows, error: rolesError }] =
    await Promise.all([
      adminSupabase
        .from("shifts")
        .select("id,event_id,title,starts_at,ends_at,location,notes")
        .eq("event_id", event.id)
        .in("id", shiftIds),
      coverageRoleIds.length > 0
        ? adminSupabase
            .from("coverage_roles")
            .select("id,name")
            .eq("event_id", event.id)
            .in("id", coverageRoleIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (shiftsError || rolesError) {
    throw new Error("Unable to load assigned shift details.");
  }

  const shiftsById = new Map(
    ((shiftRows ?? []) as Pick<
      ShiftRow,
      "id" | "event_id" | "title" | "starts_at" | "ends_at" | "location" | "notes"
    >[]).map((shift) => [shift.id, shift]),
  );
  const rolesById = new Map(
    ((coverageRoleRows ?? []) as Pick<CoverageRoleRow, "id" | "name">[]).map((role) => [role.id, role]),
  );
  const memberAssignments = assignments
    .map((assignment) => {
      const shift = shiftsById.get(assignment.shift_id);

      if (!shift) {
        return null;
      }

      return {
        ...assignment,
        coverageRole: assignment.coverage_role_id
          ? rolesById.get(assignment.coverage_role_id) ?? null
          : null,
        shift,
      };
    })
    .filter((assignment): assignment is MemberScheduleAssignment => assignment !== null)
    .toSorted((first, second) => first.shift.starts_at.localeCompare(second.shift.starts_at));

  return {
    assignments: memberAssignments,
    event,
    publication,
    profile: context.profile,
    summary: getMemberScheduleSummary(memberAssignments),
  };
}
