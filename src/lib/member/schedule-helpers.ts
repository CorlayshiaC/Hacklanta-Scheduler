import { differenceInHours, listCalendarDaysInRange } from "@/lib/availability/time";
import type { AvailabilityEventWindow } from "@/lib/availability/event";
import type { Database } from "@/types/database";

/**
 * Pure, I/O-free pieces split out of lib/member/schedule.ts (which is `server-only`, so nothing it
 * exports can be imported from a "use client" component, even a function that does no I/O itself:
 * the `server-only` guard throws for the whole module, not per-export). member-schedule-workspace.tsx
 * needs these client-side to re-derive the dashboard hero's next-assignment/status on a realtime
 * update without a full page round trip. schedule.ts re-exports both, so every existing server-side
 * caller and the test suite keep importing from "@/lib/member/schedule" unchanged.
 */

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
