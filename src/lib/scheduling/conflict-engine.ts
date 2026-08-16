import { differenceInHours } from "@/lib/availability/time";
import type { ConflictCheckResult, ShiftWindow, TimeWindow } from "@/lib/scheduling/types";

/**
 * Pure conflict/eligibility logic for assigning one person to one shift. Used by the coverage
 * board, self-signup (mirrored server-side by Agent 2's claim function once it exists), and
 * Agent 6's auto-fill. Do not reimplement these rules on any surface, import this instead.
 */

export function windowsOverlap(a: TimeWindow, b: TimeWindow): boolean {
  return (
    new Date(a.startsAt).getTime() < new Date(b.endsAt).getTime() &&
    new Date(a.endsAt).getTime() > new Date(b.startsAt).getTime()
  );
}

function isWithinAvailability(shift: TimeWindow, availabilityWindows: TimeWindow[]): boolean {
  const shiftStart = new Date(shift.startsAt).getTime();
  const shiftEnd = new Date(shift.endsAt).getTime();

  return availabilityWindows.some(
    (window) =>
      new Date(window.startsAt).getTime() <= shiftStart && new Date(window.endsAt).getTime() >= shiftEnd,
  );
}

/** Smallest gap, in minutes, between the shift and the nearest non-overlapping existing assignment. */
function nearestGapMinutes(shift: TimeWindow, existingAssignments: TimeWindow[]): number | null {
  const shiftStart = new Date(shift.startsAt).getTime();
  const shiftEnd = new Date(shift.endsAt).getTime();
  let nearestMinutes: number | null = null;

  for (const other of existingAssignments) {
    const otherStart = new Date(other.startsAt).getTime();
    const otherEnd = new Date(other.endsAt).getTime();
    let gapMs: number | null = null;

    if (otherEnd <= shiftStart) {
      gapMs = shiftStart - otherEnd;
    } else if (otherStart >= shiftEnd) {
      gapMs = otherStart - shiftEnd;
    }

    if (gapMs === null) {
      continue;
    }

    const gapMinutes = Math.floor(gapMs / (1000 * 60));
    if (nearestMinutes === null || gapMinutes < nearestMinutes) {
      nearestMinutes = gapMinutes;
    }
  }

  return nearestMinutes;
}

export type ConflictCheckInput = {
  shift: ShiftWindow;
  /** This person's other active (non-dropped) assignments, across all events. */
  existingAssignments: ShiftWindow[];
  capacity: { assigned: number; required: number };
  availabilityWindows: TimeWindow[];
  maxHoursPerWeek: number | null;
  assignedHoursThisWeek: number;
  minimumBreakMinutes: number | null;
};

export function checkAssignmentConflicts(input: ConflictCheckInput): ConflictCheckResult {
  const overlapping = input.existingAssignments.find((assignment) => windowsOverlap(input.shift, assignment));

  if (overlapping) {
    return { status: "blocked", reason: "Already assigned to an overlapping shift." };
  }

  if (input.capacity.assigned >= input.capacity.required) {
    return { status: "blocked", reason: "This shift is already at capacity." };
  }

  const reasons: string[] = [];

  if (input.availabilityWindows.length > 0 && !isWithinAvailability(input.shift, input.availabilityWindows)) {
    reasons.push("Outside submitted availability.");
  }

  const shiftHours = differenceInHours(input.shift.startsAt, input.shift.endsAt);
  if (input.maxHoursPerWeek !== null && input.assignedHoursThisWeek + shiftHours > input.maxHoursPerWeek) {
    reasons.push(`Would exceed the ${input.maxHoursPerWeek}h weekly limit.`);
  }

  const gapMinutes = nearestGapMinutes(input.shift, input.existingAssignments);
  if (gapMinutes === 0) {
    reasons.push("Back-to-back with another shift, no gap.");
  } else if (
    gapMinutes !== null &&
    input.minimumBreakMinutes !== null &&
    gapMinutes < input.minimumBreakMinutes
  ) {
    reasons.push(`Only ${gapMinutes}m between shifts, minimum break is ${input.minimumBreakMinutes}m.`);
  }

  if (reasons.length > 0) {
    return { status: "warning", reasons };
  }

  return { status: "ok" };
}
