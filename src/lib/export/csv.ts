import "server-only";

import { requireAdmin } from "@/lib/auth/authorization";
import { formatDateInTimeZone, formatTimeInTimeZone } from "@/lib/availability/time";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ShiftRow = Database["public"]["Tables"]["shifts"]["Row"];
type ShiftRoleRow = Database["public"]["Tables"]["shift_roles"]["Row"];

export type ShiftCsvRow = {
  station: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  assignees: string[];
  filled: number;
  needed: number;
};

const CSV_HEADER = ["Station", "Start", "End", "Location", "Assignees", "Filled", "Needed"];
const BYTE_ORDER_MARK = "\uFEFF";

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function toCsvRow(fields: (string | number)[]): string {
  return fields.map((field) => escapeCsvField(String(field))).join(",");
}

export function generateShiftsCsv(rows: ShiftCsvRow[]): string {
  const lines = [
    toCsvRow(CSV_HEADER),
    ...rows.map((row) =>
      toCsvRow([
        row.station,
        row.startsAt,
        row.endsAt,
        row.location ?? "",
        row.assignees.join(";"),
        row.filled,
        row.needed,
      ]),
    ),
  ];

  return BYTE_ORDER_MARK + lines.join("\r\n");
}

// Shape of a `shift_assignments` row joined to `profiles` for the assignee's
// name, as returned by the query below. `profiles!shift_assignments_profile_id_fkey`
// disambiguates from the `assigned_by` foreign key, which also points at
// `profiles`.
type ShiftAssignmentWithProfile = {
  shift_id: string;
  profiles: { full_name: string } | null;
};

export async function getShiftsForCsv(eventId: string): Promise<ShiftCsvRow[]> {
  // Only an organizer or admin may export the roster. requireAdmin is the
  // closest gate available until the organizer role ships.
  await requireAdmin();

  const supabase = await createSupabaseServerClient();

  // Fetched separately from the shifts/shift_roles queries below rather than
  // batched into one Promise.all: Supabase's select-string type inference
  // does not reliably resolve a narrow single-column select like this one, so
  // the result is cast explicitly below (same pattern as
  // lib/auth/authorization.ts's getProfileForUser) instead of trusted as-is.
  const { data: event, error: eventError } = (await supabase
    .from("events")
    .select("timezone")
    .eq("id", eventId)
    .maybeSingle()) as { data: { timezone: string } | null; error: unknown };

  if (eventError || !event) {
    throw new Error("Event not found.");
  }

  const [{ data: shifts, error: shiftsError }, { data: shiftRoles, error: shiftRolesError }] = await Promise.all([
    supabase.from("shifts").select("*").eq("event_id", eventId).order("starts_at"),
    supabase.from("shift_roles").select("*").eq("event_id", eventId),
  ]);

  if (shiftsError) {
    throw new Error("Unable to load shifts for export.");
  }

  if (shiftRolesError) {
    throw new Error("Unable to load stations for export.");
  }

  const shiftRows = (shifts ?? []) as ShiftRow[];
  const shiftIds = shiftRows.map((shift) => shift.id);

  const { data: assignments, error: assignmentsError } = await supabase
    .from("shift_assignments")
    .select("shift_id,profiles!shift_assignments_profile_id_fkey(full_name)")
    .in("shift_id", shiftIds)
    .eq("status", "published");

  if (assignmentsError) {
    throw new Error("Unable to load assignments for export.");
  }

  const stationNameById = new Map(
    ((shiftRoles ?? []) as ShiftRoleRow[]).map((role) => [role.id, role.name]),
  );

  const assigneesByShift = new Map<string, string[]>();
  for (const assignment of (assignments ?? []) as unknown as ShiftAssignmentWithProfile[]) {
    const names = assigneesByShift.get(assignment.shift_id) ?? [];
    if (assignment.profiles?.full_name) {
      names.push(assignment.profiles.full_name);
    }
    assigneesByShift.set(assignment.shift_id, names);
  }

  return shiftRows.map((shift) => {
    const assignees = assigneesByShift.get(shift.id) ?? [];
    const station = shift.shift_role_id ? stationNameById.get(shift.shift_role_id) ?? "Unassigned" : "Unassigned";

    return {
      station,
      startsAt: `${formatDateInTimeZone(shift.starts_at, event.timezone)} ${formatTimeInTimeZone(shift.starts_at, event.timezone)}`,
      endsAt: `${formatDateInTimeZone(shift.ends_at, event.timezone)} ${formatTimeInTimeZone(shift.ends_at, event.timezone)}`,
      location: shift.location,
      assignees,
      filled: assignees.length,
      needed: shift.required_people,
    };
  });
}
