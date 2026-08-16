import "server-only";

import { formatInputDateInTimeZone } from "@/lib/availability/time";
import { recommendCandidates, type CandidateInput } from "@/lib/scheduling/recommendations";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type EventRow = Database["public"]["Tables"]["events"]["Row"];
export type ShiftRow = Database["public"]["Tables"]["shifts"]["Row"];
export type ShiftRoleRow = Database["public"]["Tables"]["shift_roles"]["Row"];
export type CoverageRoleRow = Database["public"]["Tables"]["coverage_roles"]["Row"];
export type ShiftRequirementRow = Database["public"]["Tables"]["shift_role_requirements"]["Row"];
export type AssignmentRow = Database["public"]["Tables"]["shift_assignments"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type MemberSettingsRow = Database["public"]["Tables"]["member_settings"]["Row"];
export type AvailabilityRow = Database["public"]["Tables"]["availability_windows"]["Row"];
type MemberCoverageRoleRow = Database["public"]["Tables"]["member_coverage_roles"]["Row"];

export type AdminShiftAssignment = AssignmentRow & {
  profile: Pick<ProfileRow, "id" | "full_name" | "email"> | null;
  coverageRole: Pick<CoverageRoleRow, "id" | "name"> | null;
};

export type AdminShift = ShiftRow & {
  shiftRole: ShiftRoleRow | null;
  requirements: (ShiftRequirementRow & { coverageRole: CoverageRoleRow | null })[];
  assignments: AdminShiftAssignment[];
  staffingStatus: "fully_staffed" | "partially_staffed" | "unstaffed";
  requiredTotal: number;
  activeAssignmentCount: number;
};

export type AdminShiftPageData = {
  event: EventRow;
  shiftRoles: ShiftRoleRow[];
  coverageRoles: CoverageRoleRow[];
  memberSettings: MemberSettingsRow[];
  shifts: AdminShift[];
  candidatesByShiftRole: Record<string, ReturnType<typeof recommendCandidates>>;
};

type ShiftRequirementJoin = ShiftRequirementRow & {
  coverage_roles: CoverageRoleRow | null;
};

type AssignmentJoin = AssignmentRow & {
  profiles: Pick<ProfileRow, "id" | "full_name" | "email"> | null;
  coverage_roles: Pick<CoverageRoleRow, "id" | "name"> | null;
};

export async function getHackLantaIIEventForAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("name", "HackLanta II")
    .maybeSingle();

  if (error || !data) {
    throw new Error("HackLanta II event is not configured.");
  }

  return data as EventRow;
}

function getStaffingStatus(input: {
  requiredPeople: number;
  requirements: AdminShift["requirements"];
  assignments: AdminShiftAssignment[];
}): AdminShift["staffingStatus"] {
  const activeAssignments = input.assignments.filter(
    (assignment) => assignment.status === "draft" || assignment.status === "published",
  );
  const roleRequirementsMet = input.requirements.every((requirement) => {
    const assignedForRole = activeAssignments.filter(
      (assignment) => assignment.coverage_role_id === requirement.coverage_role_id,
    ).length;
    return assignedForRole >= requirement.required_people;
  });
  const generalRequirementMet = activeAssignments.length >= input.requiredPeople;

  if (activeAssignments.length === 0) {
    return "unstaffed";
  }

  return roleRequirementsMet && generalRequirementMet ? "fully_staffed" : "partially_staffed";
}

export async function getAdminShiftPageData(filter: {
  date?: string;
  coverageRoleId?: string;
  staffingStatus?: string;
} = {}): Promise<AdminShiftPageData> {
  const supabase = await createSupabaseServerClient();
  const event = await getHackLantaIIEventForAdmin();
  const [
    { data: shiftRoles, error: shiftRolesError },
    { data: coverageRoles, error: coverageRolesError },
    { data: shifts, error: shiftsError },
    { data: requirements, error: requirementsError },
    { data: assignments, error: assignmentsError },
    { data: profiles, error: profilesError },
    { data: memberCoverageRoles, error: memberCoverageRolesError },
    { data: memberSettings, error: memberSettingsError },
    { data: availabilityWindows, error: availabilityError },
  ] = await Promise.all([
    supabase.from("shift_roles").select("*").eq("event_id", event.id).order("name"),
    supabase.from("coverage_roles").select("*").eq("event_id", event.id).order("name"),
    supabase.from("shifts").select("*").eq("event_id", event.id).order("starts_at"),
    supabase.from("shift_role_requirements").select("*,coverage_roles(*)"),
    supabase
      .from("shift_assignments")
      .select("*,profiles!shift_assignments_profile_id_fkey(id,full_name,email),coverage_roles(id,name)"),
    supabase.from("profiles").select("*"),
    supabase.from("member_coverage_roles").select("*").eq("event_id", event.id),
    supabase.from("member_settings").select("*").eq("event_id", event.id),
    supabase
      .from("availability_windows")
      .select("*")
      .eq("event_id", event.id)
      .eq("status", "available"),
  ]);

  if (
    shiftRolesError ||
    coverageRolesError ||
    shiftsError ||
    requirementsError ||
    assignmentsError ||
    profilesError ||
    memberCoverageRolesError ||
    memberSettingsError ||
    availabilityError
  ) {
    throw new Error("Unable to load shift management data.");
  }

  const shiftRoleRows = (shiftRoles ?? []) as ShiftRoleRow[];
  const shiftRolesById = new Map(shiftRoleRows.map((role) => [role.id, role]));
  const requirementsByShift = new Map<string, AdminShift["requirements"]>();
  for (const requirement of (requirements ?? []) as unknown as ShiftRequirementJoin[]) {
    const rows = requirementsByShift.get(requirement.shift_id) ?? [];
    rows.push({
      ...requirement,
      coverageRole: requirement.coverage_roles,
    });
    requirementsByShift.set(requirement.shift_id, rows);
  }

  const assignmentsByShift = new Map<string, AdminShiftAssignment[]>();
  for (const assignment of (assignments ?? []) as unknown as AssignmentJoin[]) {
    const rows = assignmentsByShift.get(assignment.shift_id) ?? [];
    rows.push({
      ...assignment,
      profile: assignment.profiles,
      coverageRole: assignment.coverage_roles,
    });
    assignmentsByShift.set(assignment.shift_id, rows);
  }

  let adminShifts = ((shifts ?? []) as ShiftRow[]).map((shift) => {
    const shiftRequirements = requirementsByShift.get(shift.id) ?? [];
    const shiftAssignments = assignmentsByShift.get(shift.id) ?? [];
    const activeAssignmentCount = shiftAssignments.filter(
      (assignment) => assignment.status === "draft" || assignment.status === "published",
    ).length;
    const requiredTotal = Math.max(
      shift.required_people,
      shiftRequirements.reduce((total, requirement) => total + requirement.required_people, 0),
    );

    return {
      ...shift,
      shiftRole: shift.shift_role_id ? shiftRolesById.get(shift.shift_role_id) ?? null : null,
      requirements: shiftRequirements,
      assignments: shiftAssignments,
      activeAssignmentCount,
      requiredTotal,
      staffingStatus: getStaffingStatus({
        requiredPeople: shift.required_people,
        requirements: shiftRequirements,
        assignments: shiftAssignments,
      }),
    };
  });

  if (filter.date) {
    adminShifts = adminShifts.filter(
      (shift) => formatInputDateInTimeZone(shift.starts_at, event.timezone) === filter.date,
    );
  }

  if (filter.coverageRoleId) {
    adminShifts = adminShifts.filter((shift) =>
      shift.requirements.some((requirement) => requirement.coverage_role_id === filter.coverageRoleId),
    );
  }

  if (
    filter.staffingStatus === "fully_staffed" ||
    filter.staffingStatus === "partially_staffed" ||
    filter.staffingStatus === "unstaffed"
  ) {
    adminShifts = adminShifts.filter((shift) => shift.staffingStatus === filter.staffingStatus);
  }

  const settingsByProfile = new Map(
    ((memberSettings ?? []) as MemberSettingsRow[]).map((settings) => [settings.profile_id, settings]),
  );
  const rolesByProfile = new Map<string, string[]>();
  for (const role of (memberCoverageRoles ?? []) as MemberCoverageRoleRow[]) {
    const roleIds = rolesByProfile.get(role.profile_id) ?? [];
    roleIds.push(role.coverage_role_id);
    rolesByProfile.set(role.profile_id, roleIds);
  }
  const availabilityByProfile = new Map<string, AvailabilityRow[]>();
  for (const availability of (availabilityWindows ?? []) as AvailabilityRow[]) {
    const rows = availabilityByProfile.get(availability.profile_id) ?? [];
    rows.push(availability);
    availabilityByProfile.set(availability.profile_id, rows);
  }
  const allAssignmentsForRecommendations = (assignments ?? []) as AssignmentJoin[];
  const shiftById = new Map(((shifts ?? []) as ShiftRow[]).map((shift) => [shift.id, shift]));
  const assignmentsByProfile = new Map<string, CandidateInput["assignments"]>();
  for (const assignment of allAssignmentsForRecommendations) {
    const shift = shiftById.get(assignment.shift_id);
    if (!shift) {
      continue;
    }
    const rows = assignmentsByProfile.get(assignment.profile_id) ?? [];
    rows.push({
      id: assignment.id,
      profileId: assignment.profile_id,
      shiftId: assignment.shift_id,
      startsAt: shift.starts_at,
      endsAt: shift.ends_at,
      status: assignment.status,
    });
    assignmentsByProfile.set(assignment.profile_id, rows);
  }

  const candidates: CandidateInput[] = ((profiles ?? []) as ProfileRow[]).map((profile) => {
    const settings = settingsByProfile.get(profile.id);
    return {
      profile: {
        id: profile.id,
        fullName: profile.full_name,
        email: profile.email,
        isActive: profile.is_active,
      },
      coverageRoleIds: rolesByProfile.get(profile.id) ?? [],
      settings: settings
        ? {
            maxHours: Number(settings.max_hours),
            minimumBreakMinutes: settings.minimum_break_minutes,
          }
        : null,
      availabilityWindows: (availabilityByProfile.get(profile.id) ?? []).map((window) => ({
        profileId: window.profile_id,
        startsAt: window.starts_at,
        endsAt: window.ends_at,
      })),
      assignments: assignmentsByProfile.get(profile.id) ?? [],
    };
  });

  const candidatesByShiftRole: AdminShiftPageData["candidatesByShiftRole"] = {};
  for (const shift of adminShifts) {
    const requirementRoles = shift.requirements.length > 0 ? shift.requirements : [null];
    for (const requirement of requirementRoles) {
      const coverageRoleId = requirement?.coverage_role_id ?? null;
      candidatesByShiftRole[`${shift.id}:${coverageRoleId ?? "general"}`] = recommendCandidates({
        shift: { id: shift.id, startsAt: shift.starts_at, endsAt: shift.ends_at },
        coverageRoleId,
        candidates,
      });
    }
  }

  return {
    event,
    shiftRoles: shiftRoleRows,
    coverageRoles: (coverageRoles ?? []) as CoverageRoleRow[],
    memberSettings: (memberSettings ?? []) as MemberSettingsRow[],
    shifts: adminShifts,
    candidatesByShiftRole,
  };
}
