import "server-only";

import { buildShiftCells, type AssignmentForCoverage, type ShiftForCoverage, type ShiftRequirementForCoverage } from "@/lib/scheduling/coverage";
import type { ShiftCell } from "@/lib/scheduling/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * getCoverage(eventId): fetches shifts/requirements/assignments for one event and shapes them into the
 * ShiftCell[] the coverage board renders, via src/lib/scheduling/coverage.ts's pure buildShiftCells()
 * (Agent 3 owned; this file only does the DB round trip and the row-shape translation).
 */
export async function getCoverage(eventId: string): Promise<ShiftCell[]> {
  const supabase = await createSupabaseServerClient();

  const { data: shiftRows, error: shiftsError } = await supabase
    .from("shifts")
    .select("id, event_id, title, starts_at, ends_at, location, required_people, notes, shift_role_id, shift_roles(id, name)")
    .eq("event_id", eventId)
    .order("starts_at", { ascending: true });

  if (shiftsError) {
    throw new Error("Unable to load shifts for coverage.");
  }

  type ShiftJoinRow = {
    id: string;
    event_id: string | null;
    title: string;
    starts_at: string;
    ends_at: string;
    location: string | null;
    required_people: number;
    notes: string | null;
    shift_role_id: string | null;
    shift_roles: { id: string; name: string } | null;
  };

  const shifts = (shiftRows ?? []) as unknown as ShiftJoinRow[];
  const shiftIds = shifts.map((shift) => shift.id);

  if (shiftIds.length === 0) {
    return [];
  }

  const [{ data: requirementRows, error: requirementsError }, { data: assignmentRows, error: assignmentsError }] =
    await Promise.all([
      supabase
        .from("shift_role_requirements")
        .select("shift_id, coverage_role_id, required_people, coverage_roles(name)")
        .in("shift_id", shiftIds),
      supabase
        .from("shift_assignments")
        .select("id, shift_id, profile_id, coverage_role_id, status, profiles(full_name)")
        .in("shift_id", shiftIds),
    ]);

  if (requirementsError || assignmentsError) {
    throw new Error("Unable to load coverage requirements or assignments.");
  }

  type RequirementJoinRow = {
    shift_id: string;
    coverage_role_id: string;
    required_people: number;
    coverage_roles: { name: string } | null;
  };

  type AssignmentJoinRow = {
    id: string;
    shift_id: string;
    profile_id: string;
    coverage_role_id: string | null;
    status: "draft" | "published" | "removed" | "swap_pending";
    profiles: { full_name: string } | null;
  };

  const shiftsForCoverage: ShiftForCoverage[] = shifts.map((shift) => ({
    id: shift.id,
    eventId: shift.event_id,
    title: shift.title,
    startsAt: shift.starts_at,
    endsAt: shift.ends_at,
    location: shift.location,
    requiredPeople: shift.required_people,
    station: shift.shift_roles ? { id: shift.shift_roles.id, name: shift.shift_roles.name } : null,
    notes: shift.notes,
  }));

  const requirementsForCoverage: ShiftRequirementForCoverage[] = ((requirementRows ?? []) as unknown as RequirementJoinRow[]).map(
    (requirement) => ({
      shiftId: requirement.shift_id,
      coverageRoleId: requirement.coverage_role_id,
      coverageRoleName: requirement.coverage_roles?.name ?? "Coverage role",
      requiredPeople: requirement.required_people,
    }),
  );

  const assignmentsForCoverage: AssignmentForCoverage[] = ((assignmentRows ?? []) as unknown as AssignmentJoinRow[]).map(
    (assignment) => ({
      id: assignment.id,
      shiftId: assignment.shift_id,
      profileId: assignment.profile_id,
      fullName: assignment.profiles?.full_name ?? "Unknown member",
      coverageRoleId: assignment.coverage_role_id,
      active: assignment.status === "draft" || assignment.status === "published" || assignment.status === "swap_pending",
    }),
  );

  return buildShiftCells({
    shifts: shiftsForCoverage,
    requirements: requirementsForCoverage,
    assignments: assignmentsForCoverage,
    now: new Date(),
  });
}
