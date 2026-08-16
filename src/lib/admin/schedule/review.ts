import "server-only";

import { differenceInHours } from "@/lib/availability/time";
import { windowsOverlap } from "@/lib/scheduling/recommendations";
import { getHackLantaIIEventForAdmin } from "@/lib/admin/shifts/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type ShiftRow = Database["public"]["Tables"]["shifts"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["shift_assignments"]["Row"];
type CoverageRoleRow = Database["public"]["Tables"]["coverage_roles"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type RequirementRow = Database["public"]["Tables"]["shift_role_requirements"]["Row"];
type AvailabilityRow = Database["public"]["Tables"]["availability_windows"]["Row"];
type MemberCoverageRoleRow = Database["public"]["Tables"]["member_coverage_roles"]["Row"];
type MemberSettingsRow = Database["public"]["Tables"]["member_settings"]["Row"];
type PublicationRow = Database["public"]["Tables"]["schedule_publications"]["Row"];

export type ReviewSeverity = "blocker" | "warning";

export type ReviewIssue = {
  assignmentId?: string;
  details: string;
  entityHref?: string;
  id: string;
  severity: ReviewSeverity;
  shiftId?: string;
  title: string;
  type:
    | "availability_violation"
    | "inactive_member"
    | "invalid_assignment"
    | "invalid_coverage_role"
    | "max_hours"
    | "minimum_break"
    | "open_positions"
    | "overlap"
    | "partially_staffed";
};

export type ReviewShift = ShiftRow & {
  activeAssignmentCount: number;
  openPositions: number;
  requiredTotal: number;
  staffingStatus: "fully_staffed" | "partially_staffed" | "unstaffed";
};

export type ScheduleReviewSummary = {
  draftAssignments: number;
  fullyStaffedShifts: number;
  openPositions: number;
  partiallyStaffedShifts: number;
  publishedAssignments: number;
  totalAssignedPositions: number;
  totalRequiredPositions: number;
  totalShifts: number;
  unstaffedShifts: number;
};

export type ScheduleReviewData = {
  alreadyPublished: boolean;
  draftAssignments: ScheduleReviewAssignment[];
  event: EventRow;
  issues: ReviewIssue[];
  latestPublication: PublicationRow | null;
  shifts: ReviewShift[];
  summary: ScheduleReviewSummary;
};

export type ScheduleReviewAssignment = AssignmentRow & {
  coverage_roles?: Pick<CoverageRoleRow, "id" | "name"> | null;
  profiles?: Pick<ProfileRow, "id" | "full_name" | "email" | "is_active"> | null;
};

type RequirementWithRole = RequirementRow & {
  coverage_roles?: Pick<CoverageRoleRow, "id" | "name"> | null;
};

type ReviewInput = {
  assignments: ScheduleReviewAssignment[];
  availabilityWindows: AvailabilityRow[];
  event: EventRow;
  memberCoverageRoles: MemberCoverageRoleRow[];
  memberSettings: MemberSettingsRow[];
  publications: PublicationRow[];
  requirements: RequirementWithRole[];
  shifts: ShiftRow[];
};

function activeAssignments(assignments: ScheduleReviewAssignment[]) {
  return assignments.filter(
    (assignment) => assignment.status === "draft" || assignment.status === "published",
  );
}

function displayName(profile: Pick<ProfileRow, "full_name" | "email"> | null | undefined) {
  return profile?.full_name?.trim() || profile?.email || "Unknown member";
}

function availabilityCoversShift(availabilityWindows: AvailabilityRow[], shift: ShiftRow) {
  const shiftStart = new Date(shift.starts_at).getTime();
  const shiftEnd = new Date(shift.ends_at).getTime();

  return availabilityWindows.some(
    (window) =>
      new Date(window.starts_at).getTime() <= shiftStart
      && new Date(window.ends_at).getTime() >= shiftEnd,
  );
}

function getStaffingStatus(input: {
  activeAssignmentCount: number;
  requiredPeople: number;
  requirements: RequirementWithRole[];
  shiftAssignments: ScheduleReviewAssignment[];
}): ReviewShift["staffingStatus"] {
  if (input.requiredPeople === 0 && input.requirements.length === 0) {
    return "fully_staffed";
  }

  if (input.activeAssignmentCount === 0) {
    return "unstaffed";
  }

  const generalMet = input.activeAssignmentCount >= input.requiredPeople;
  const roleRequirementsMet = input.requirements.every((requirement) => {
    const assignedForRole = input.shiftAssignments.filter(
      (assignment) => assignment.coverage_role_id === requirement.coverage_role_id,
    ).length;
    return assignedForRole >= requirement.required_people;
  });

  return generalMet && roleRequirementsMet ? "fully_staffed" : "partially_staffed";
}

function issueId(prefix: string, ...parts: Array<string | number | null | undefined>) {
  return [prefix, ...parts.filter(Boolean)].join(":");
}

export function buildScheduleReview(input: ReviewInput): ScheduleReviewData {
  const issues: ReviewIssue[] = [];
  const active = activeAssignments(input.assignments);
  const requirementsByShift = new Map<string, RequirementWithRole[]>();
  const assignmentsByShift = new Map<string, ScheduleReviewAssignment[]>();
  const assignmentsByProfile = new Map<string, ScheduleReviewAssignment[]>();
  const shiftsById = new Map(input.shifts.map((shift) => [shift.id, shift]));
  const coverageRoleIds = new Set(input.memberCoverageRoles.map((role) => `${role.profile_id}:${role.coverage_role_id}`));
  const availabilityByProfile = new Map<string, AvailabilityRow[]>();
  const settingsByProfile = new Map(input.memberSettings.map((settings) => [settings.profile_id, settings]));

  for (const requirement of input.requirements) {
    const rows = requirementsByShift.get(requirement.shift_id) ?? [];
    rows.push(requirement);
    requirementsByShift.set(requirement.shift_id, rows);
  }

  for (const assignment of active) {
    const shiftRows = assignmentsByShift.get(assignment.shift_id) ?? [];
    shiftRows.push(assignment);
    assignmentsByShift.set(assignment.shift_id, shiftRows);

    const profileRows = assignmentsByProfile.get(assignment.profile_id) ?? [];
    profileRows.push(assignment);
    assignmentsByProfile.set(assignment.profile_id, profileRows);
  }

  for (const window of input.availabilityWindows) {
    const rows = availabilityByProfile.get(window.profile_id) ?? [];
    rows.push(window);
    availabilityByProfile.set(window.profile_id, rows);
  }

  const reviewShifts = input.shifts.map((shift) => {
    const shiftAssignments = assignmentsByShift.get(shift.id) ?? [];
    const requirements = requirementsByShift.get(shift.id) ?? [];
    const requiredTotal = Math.max(
      shift.required_people,
      requirements.reduce((total, requirement) => total + requirement.required_people, 0),
    );
    const activeAssignmentCount = shiftAssignments.length;
    const openPositions = Math.max(0, requiredTotal - activeAssignmentCount);
    const staffingStatus = getStaffingStatus({
      activeAssignmentCount,
      requiredPeople: shift.required_people,
      requirements,
      shiftAssignments,
    });

    if (openPositions > 0) {
      issues.push({
        details: `${openPositions} position${openPositions === 1 ? "" : "s"} remain open.`,
        entityHref: `/admin/schedule#${shift.id}`,
        id: issueId("open", shift.id),
        severity: "warning",
        shiftId: shift.id,
        title: `${shift.title} has open coverage`,
        type: "open_positions",
      });
    }

    for (const requirement of requirements) {
      const assignedForRole = shiftAssignments.filter(
        (assignment) => assignment.coverage_role_id === requirement.coverage_role_id,
      ).length;

      if (assignedForRole < requirement.required_people) {
        issues.push({
          details: `${requirement.coverage_roles?.name ?? "Coverage role"}: ${assignedForRole}/${requirement.required_people}.`,
          entityHref: `/admin/schedule#${shift.id}`,
          id: issueId("role-open", shift.id, requirement.coverage_role_id),
          severity: "warning",
          shiftId: shift.id,
          title: `${shift.title} is missing role coverage`,
          type: "partially_staffed",
        });
      }
    }

    return {
      ...shift,
      activeAssignmentCount,
      openPositions,
      requiredTotal,
      staffingStatus,
    };
  });

  for (const assignment of active) {
    const shift = shiftsById.get(assignment.shift_id);
    const profile = assignment.profiles;

    if (!shift || shift.event_id !== input.event.id || !profile) {
      issues.push({
        assignmentId: assignment.id,
        details: "Assignment is missing a valid HackLanta II shift or profile.",
        id: issueId("invalid-assignment", assignment.id),
        severity: "blocker",
        shiftId: assignment.shift_id,
        title: "Invalid assignment",
        type: "invalid_assignment",
      });
      continue;
    }

    if (!profile.is_active) {
      issues.push({
        assignmentId: assignment.id,
        details: `${displayName(profile)} is inactive.`,
        entityHref: `/admin/schedule#${shift.id}`,
        id: issueId("inactive", assignment.id),
        severity: "blocker",
        shiftId: shift.id,
        title: "Inactive member assignment",
        type: "inactive_member",
      });
    }

    if (
      assignment.coverage_role_id
      && !coverageRoleIds.has(`${assignment.profile_id}:${assignment.coverage_role_id}`)
    ) {
      issues.push({
        assignmentId: assignment.id,
        details: `${displayName(profile)} is not eligible for ${assignment.coverage_roles?.name ?? "that coverage role"}.`,
        entityHref: `/admin/schedule#${shift.id}`,
        id: issueId("invalid-role", assignment.id, assignment.coverage_role_id),
        severity: "blocker",
        shiftId: shift.id,
        title: "Invalid coverage role assignment",
        type: "invalid_coverage_role",
      });
    }

    if (!availabilityCoversShift(availabilityByProfile.get(assignment.profile_id) ?? [], shift)) {
      issues.push({
        assignmentId: assignment.id,
        details: `${displayName(profile)} is assigned outside submitted availability for ${shift.title}.`,
        entityHref: `/admin/schedule#${shift.id}`,
        id: issueId("availability", assignment.id),
        severity: "blocker",
        shiftId: shift.id,
        title: "Availability violation",
        type: "availability_violation",
      });
    }
  }

  for (const [profileId, assignments] of assignmentsByProfile) {
    const sorted = assignments
      .map((assignment) => ({ assignment, shift: shiftsById.get(assignment.shift_id) }))
      .filter((row): row is { assignment: ScheduleReviewAssignment; shift: ShiftRow } => Boolean(row.shift))
      .toSorted((first, second) => first.shift.starts_at.localeCompare(second.shift.starts_at));
    const profile = sorted[0]?.assignment.profiles;
    const settings = settingsByProfile.get(profileId);
    const totalHours = sorted.reduce(
      (total, row) => total + differenceInHours(row.shift.starts_at, row.shift.ends_at),
      0,
    );

    if (settings && totalHours > Number(settings.max_hours)) {
      issues.push({
        details: `${displayName(profile)} has ${totalHours.toFixed(1)} assigned hours; max is ${Number(settings.max_hours).toFixed(1)}.`,
        id: issueId("max-hours", profileId),
        severity: "blocker",
        title: "Maximum-hours violation",
        type: "max_hours",
      });
    }

    for (let index = 0; index < sorted.length; index += 1) {
      const current = sorted[index];

      if (!current) {
        continue;
      }

      for (let compareIndex = index + 1; compareIndex < sorted.length; compareIndex += 1) {
        const next = sorted[compareIndex];

        if (!next) {
          continue;
        }

        if (windowsOverlap(
          { id: current.shift.id, startsAt: current.shift.starts_at, endsAt: current.shift.ends_at },
          { id: next.shift.id, startsAt: next.shift.starts_at, endsAt: next.shift.ends_at },
        )) {
          issues.push({
            assignmentId: current.assignment.id,
            details: `${displayName(profile)} is assigned to ${current.shift.title} and ${next.shift.title} at overlapping times.`,
            entityHref: `/admin/schedule#${current.shift.id}`,
            id: issueId("overlap", current.assignment.id, next.assignment.id),
            severity: "blocker",
            shiftId: current.shift.id,
            title: "Overlapping assignment",
            type: "overlap",
          });
        }
      }

      const next = sorted[index + 1];
      if (settings && next) {
        const breakMinutes = Math.floor(
          (new Date(next.shift.starts_at).getTime() - new Date(current.shift.ends_at).getTime())
          / (1000 * 60),
        );

        if (breakMinutes >= 0 && breakMinutes < settings.minimum_break_minutes) {
          issues.push({
            assignmentId: current.assignment.id,
            details: `${displayName(profile)} has only ${breakMinutes} minutes between ${current.shift.title} and ${next.shift.title}; minimum is ${settings.minimum_break_minutes}.`,
            entityHref: `/admin/schedule#${current.shift.id}`,
            id: issueId("break", current.assignment.id, next.assignment.id),
            severity: "blocker",
            shiftId: current.shift.id,
            title: "Minimum-break violation",
            type: "minimum_break",
          });
        }
      }
    }
  }

  const summary = {
    draftAssignments: active.filter((assignment) => assignment.status === "draft").length,
    fullyStaffedShifts: reviewShifts.filter((shift) => shift.staffingStatus === "fully_staffed").length,
    openPositions: reviewShifts.reduce((total, shift) => total + shift.openPositions, 0),
    partiallyStaffedShifts: reviewShifts.filter((shift) => shift.staffingStatus === "partially_staffed").length,
    publishedAssignments: active.filter((assignment) => assignment.status === "published").length,
    totalAssignedPositions: active.length,
    totalRequiredPositions: reviewShifts.reduce((total, shift) => total + shift.requiredTotal, 0),
    totalShifts: reviewShifts.length,
    unstaffedShifts: reviewShifts.filter((shift) => shift.staffingStatus === "unstaffed").length,
  };

  return {
    alreadyPublished: input.publications.length > 0,
    draftAssignments: active.filter((assignment) => assignment.status === "draft"),
    event: input.event,
    issues,
    latestPublication: input.publications[0] ?? null,
    shifts: reviewShifts,
    summary,
  };
}

export async function getScheduleReviewData(): Promise<ScheduleReviewData> {
  const supabase = await createSupabaseServerClient();
  const event = await getHackLantaIIEventForAdmin();
  const [
    { data: publications, error: publicationsError },
    { data: shifts, error: shiftsError },
    { data: memberCoverageRoles, error: memberCoverageRolesError },
    { data: memberSettings, error: memberSettingsError },
    { data: availabilityWindows, error: availabilityError },
  ] = await Promise.all([
    supabase
      .from("schedule_publications")
      .select("*")
      .eq("event_id", event.id)
      .order("published_at", { ascending: false }),
    supabase.from("shifts").select("*").eq("event_id", event.id).order("starts_at"),
    supabase.from("member_coverage_roles").select("*").eq("event_id", event.id),
    supabase.from("member_settings").select("*").eq("event_id", event.id),
    supabase.from("availability_windows").select("*").eq("event_id", event.id).eq("status", "available"),
  ]);

  if (
    publicationsError ||
    shiftsError ||
    memberCoverageRolesError ||
    memberSettingsError ||
    availabilityError
  ) {
    throw new Error("Unable to load schedule review data.");
  }

  const shiftRows = (shifts ?? []) as ShiftRow[];
  const shiftIds = shiftRows.map((shift) => shift.id);
  const [
    { data: assignments, error: assignmentsError },
    { data: requirements, error: requirementsError },
  ] =
    shiftIds.length > 0
      ? await Promise.all([
          supabase
            .from("shift_assignments")
            .select(
              "*,profiles!shift_assignments_profile_id_fkey(id,full_name,email,is_active),coverage_roles(id,name)",
            )
            .in("status", ["draft", "published"])
            .in("shift_id", shiftIds),
          supabase
            .from("shift_role_requirements")
            .select("*,coverage_roles(id,name)")
            .in("shift_id", shiftIds),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];

  if (assignmentsError || requirementsError) {
    throw new Error("Unable to load schedule review data.");
  }

  return buildScheduleReview({
    assignments: (assignments ?? []) as unknown as ScheduleReviewAssignment[],
    availabilityWindows: (availabilityWindows ?? []) as AvailabilityRow[],
    event,
    memberCoverageRoles: (memberCoverageRoles ?? []) as MemberCoverageRoleRow[],
    memberSettings: (memberSettings ?? []) as MemberSettingsRow[],
    publications: (publications ?? []) as PublicationRow[],
    requirements: (requirements ?? []) as unknown as RequirementWithRole[],
    shifts: shiftRows,
  });
}
