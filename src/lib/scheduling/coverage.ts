import type { CoverageStation, ShiftCell, ShiftCellStatus } from "@/lib/scheduling/types";

/**
 * Builds the ShiftCell grid the coverage board, roster panel, and calendar chips all render from.
 * One shift becomes one cell per station it has a role requirement for, or a single general cell
 * when it has none. Pure and typed so it can be unit tested without a database.
 */

export type ShiftForCoverage = {
  id: string;
  eventId: string | null;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  requiredPeople: number;
  /** The shift's own station tag (one shift, one station), used when it has no fan-out requirements. */
  station: CoverageStation | null;
};

export type ShiftRequirementForCoverage = {
  shiftId: string;
  coverageRoleId: string;
  coverageRoleName: string;
  requiredPeople: number;
};

export type AssignmentForCoverage = {
  id: string;
  shiftId: string;
  profileId: string;
  fullName: string;
  coverageRoleId: string | null;
  /** False for dropped/removed assignments, they do not count toward coverage. */
  active: boolean;
};

const URGENT_WINDOW_MS = 24 * 60 * 60 * 1000;

function cellStatus(assigned: number, required: number): ShiftCellStatus {
  if (assigned <= 0) {
    return "empty";
  }
  return assigned >= required ? "full" : "partial";
}

function buildCell(input: {
  shift: ShiftForCoverage;
  station: CoverageStation | null;
  required: number;
  assignees: ShiftCell["assignees"];
  now: Date;
}): ShiftCell {
  const status = cellStatus(input.assignees.length, input.required);
  const startsAtMs = new Date(input.shift.startsAt).getTime();

  return {
    shiftId: input.shift.id,
    eventId: input.shift.eventId,
    title: input.shift.title,
    station: input.station,
    startsAt: input.shift.startsAt,
    endsAt: input.shift.endsAt,
    location: input.shift.location,
    headcountRequired: input.required,
    headcountAssigned: input.assignees.length,
    status,
    assignees: input.assignees,
    understaffedUrgent: status !== "full" && startsAtMs - input.now.getTime() <= URGENT_WINDOW_MS,
  };
}

export function buildShiftCells(input: {
  shifts: ShiftForCoverage[];
  requirements: ShiftRequirementForCoverage[];
  assignments: AssignmentForCoverage[];
  now: Date;
}): ShiftCell[] {
  const requirementsByShift = new Map<string, ShiftRequirementForCoverage[]>();
  for (const requirement of input.requirements) {
    const rows = requirementsByShift.get(requirement.shiftId) ?? [];
    rows.push(requirement);
    requirementsByShift.set(requirement.shiftId, rows);
  }

  const assignmentsByShift = new Map<string, AssignmentForCoverage[]>();
  for (const assignment of input.assignments) {
    if (!assignment.active) {
      continue;
    }
    const rows = assignmentsByShift.get(assignment.shiftId) ?? [];
    rows.push(assignment);
    assignmentsByShift.set(assignment.shiftId, rows);
  }

  const cells: ShiftCell[] = [];

  for (const shift of input.shifts) {
    const requirements = requirementsByShift.get(shift.id) ?? [];
    const shiftAssignments = assignmentsByShift.get(shift.id) ?? [];

    if (requirements.length === 0) {
      cells.push(
        buildCell({
          shift,
          station: shift.station,
          required: shift.requiredPeople,
          assignees: shiftAssignments.map((assignment) => ({
            assignmentId: assignment.id,
            profileId: assignment.profileId,
            fullName: assignment.fullName,
          })),
          now: input.now,
        }),
      );
      continue;
    }

    for (const requirement of requirements) {
      const forStation = shiftAssignments.filter(
        (assignment) => assignment.coverageRoleId === requirement.coverageRoleId,
      );

      cells.push(
        buildCell({
          shift,
          station: { id: requirement.coverageRoleId, name: requirement.coverageRoleName },
          required: requirement.requiredPeople,
          assignees: forStation.map((assignment) => ({
            assignmentId: assignment.id,
            profileId: assignment.profileId,
            fullName: assignment.fullName,
          })),
          now: input.now,
        }),
      );
    }
  }

  return cells;
}

export function summarizeCoverage(cells: ShiftCell[]) {
  const filled = cells.reduce((total, cell) => total + Math.min(cell.headcountAssigned, cell.headcountRequired), 0);
  const required = cells.reduce((total, cell) => total + cell.headcountRequired, 0);

  return { filled, required };
}
