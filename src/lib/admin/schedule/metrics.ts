import { differenceInHours, formatInputDateInTimeZone } from "@/lib/availability/time";
import type { AdminShift, MemberSettingsRow } from "@/lib/admin/shifts/data";

export const hackLantaScheduleDays = [
  { label: "Friday, October 9", shortLabel: "Friday", value: "2026-10-09" },
  { label: "Saturday, October 10", shortLabel: "Saturday", value: "2026-10-10" },
  { label: "Sunday, October 11", shortLabel: "Sunday", value: "2026-10-11" },
];

export function getActiveAssignments(shift: AdminShift) {
  return shift.assignments.filter(
    (assignment) => assignment.status === "draft" || assignment.status === "published",
  );
}

export function getDraftAssignments(shift: AdminShift) {
  return shift.assignments.filter((assignment) => assignment.status === "draft");
}

export function getPublishedAssignments(shift: AdminShift) {
  return shift.assignments.filter((assignment) => assignment.status === "published");
}

export function getOpenPositionCount(shift: AdminShift): number {
  return Math.max(0, shift.requiredTotal - getActiveAssignments(shift).length);
}

export function groupShiftsByHackLantaDay(shifts: AdminShift[], eventTimezone: string) {
  return hackLantaScheduleDays.map((day) => ({
    ...day,
    shifts: shifts
      .filter((shift) => formatInputDateInTimeZone(shift.starts_at, eventTimezone) === day.value)
      .toSorted((first, second) => first.starts_at.localeCompare(second.starts_at)),
  }));
}

export function getScheduleSummary(shifts: AdminShift[]) {
  return {
    totalShifts: shifts.length,
    fullyStaffed: shifts.filter((shift) => shift.staffingStatus === "fully_staffed").length,
    partiallyStaffed: shifts.filter((shift) => shift.staffingStatus === "partially_staffed").length,
    unstaffed: shifts.filter((shift) => shift.staffingStatus === "unstaffed").length,
    totalRequiredAssignments: shifts.reduce((total, shift) => total + shift.requiredTotal, 0),
    totalAssignedAssignments: shifts.reduce(
      (total, shift) => total + getActiveAssignments(shift).length,
      0,
    ),
    totalDraftAssignments: shifts.reduce(
      (total, shift) => total + getDraftAssignments(shift).length,
      0,
    ),
    totalPublishedAssignments: shifts.reduce(
      (total, shift) => total + getPublishedAssignments(shift).length,
      0,
    ),
    openPositions: shifts.reduce((total, shift) => total + getOpenPositionCount(shift), 0),
  };
}

export function getHealthStatus(input: {
  blockerCount?: number;
  openPositions: number;
  partiallyStaffed: number;
  unstaffed: number;
}) {
  if ((input.blockerCount ?? 0) > 0) {
    return "blocking" as const;
  }

  if (input.openPositions > 0 || input.partiallyStaffed > 0 || input.unstaffed > 0) {
    return "warning" as const;
  }

  return "healthy" as const;
}

export function getRoleStaffingCounts(shift: AdminShift) {
  return shift.requirements.map((requirement) => ({
    coverageRoleId: requirement.coverage_role_id,
    coverageRoleName: requirement.coverageRole?.name ?? "Coverage role",
    currentStaffing: getActiveAssignments(shift).filter(
      (assignment) => assignment.coverage_role_id === requirement.coverage_role_id,
    ).length,
    requiredStaffing: requirement.required_people,
  }));
}

export function getNeedsAttentionItems(shifts: AdminShift[]) {
  return shifts.flatMap((shift) => {
    const items: Array<{
      coverageRoleName: string | null;
      currentStaffing: number;
      openPositions: number;
      requiredStaffing: number;
      shift: AdminShift;
      type: "general_gap" | "role_gap";
    }> = [];
    const activeAssignmentCount = getActiveAssignments(shift).length;

    if (activeAssignmentCount < shift.required_people) {
      items.push({
        coverageRoleName: null,
        currentStaffing: activeAssignmentCount,
        openPositions: shift.required_people - activeAssignmentCount,
        requiredStaffing: shift.required_people,
        shift,
        type: "general_gap",
      });
    }

    for (const roleCount of getRoleStaffingCounts(shift)) {
      if (roleCount.currentStaffing < roleCount.requiredStaffing) {
        items.push({
          coverageRoleName: roleCount.coverageRoleName,
          currentStaffing: roleCount.currentStaffing,
          openPositions: roleCount.requiredStaffing - roleCount.currentStaffing,
          requiredStaffing: roleCount.requiredStaffing,
          shift,
          type: "role_gap",
        });
      }
    }

    return items;
  });
}

export function getMemberWorkloads(shifts: AdminShift[], memberSettings: MemberSettingsRow[] = []) {
  const settingsByProfile = new Map(
    memberSettings.map((settings) => [settings.profile_id, settings]),
  );
  const workloads = new Map<
    string,
    {
      profileId: string;
      fullName: string;
      email: string | null;
      coverageRoles: Set<string>;
      assignedHours: number;
      shiftCount: number;
    }
  >();

  for (const shift of shifts) {
    const shiftHours = differenceInHours(shift.starts_at, shift.ends_at);

    for (const assignment of getActiveAssignments(shift)) {
      const profileId = assignment.profile_id;
      const existing =
        workloads.get(profileId) ??
        {
          profileId,
          fullName:
            assignment.profile?.full_name?.trim() ||
            assignment.profile?.email ||
            "Unknown member",
          email: assignment.profile?.email ?? null,
          coverageRoles: new Set<string>(),
          assignedHours: 0,
          shiftCount: 0,
        };

      existing.assignedHours += shiftHours;
      existing.shiftCount += 1;

      if (assignment.coverageRole?.name) {
        existing.coverageRoles.add(assignment.coverageRole.name);
      }

      workloads.set(profileId, existing);
    }
  }

  return Array.from(workloads.values())
    .map((workload) => {
      const settings = settingsByProfile.get(workload.profileId);
      const maxHours = settings ? Number(settings.max_hours) : null;
      const assignedHours = Math.round(workload.assignedHours * 100) / 100;
      const remainingHours = maxHours === null ? null : Math.round((maxHours - assignedHours) * 100) / 100;
      const workloadStatus =
        maxHours === null
          ? "unconfigured"
          : assignedHours > maxHours
            ? "exceeds"
            : assignedHours >= maxHours * 0.8
              ? "approaching"
              : "healthy";

      return {
        ...workload,
        coverageRoles: Array.from(workload.coverageRoles).sort((first, second) =>
          first.localeCompare(second),
        ),
        assignedHours,
        maxHours,
        minimumBreakMinutes: settings?.minimum_break_minutes ?? null,
        remainingHours,
        workloadStatus,
      };
    })
    .toSorted((first, second) => {
      if (second.assignedHours !== first.assignedHours) {
        return second.assignedHours - first.assignedHours;
      }

      return first.fullName.localeCompare(second.fullName);
    });
}
