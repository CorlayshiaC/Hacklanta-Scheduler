import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildShiftCells, summarizeCoverage } from "@/lib/scheduling/coverage";
import { ACTIVE_ASSIGNMENT_STATUSES, type ShiftCell } from "@/lib/scheduling/types";
import type { Database } from "@/types/database";

// STUB(agent-2): src/types/database.ts predates the description/location columns, see the note in
// types.ts. Widen locally rather than editing the generated file by hand.
type EventRow = Database["public"]["Tables"]["events"]["Row"] & {
  description: string | null;
  location: string | null;
};
type ShiftRoleRow = Database["public"]["Tables"]["shift_roles"]["Row"];
type ShiftRow = Database["public"]["Tables"]["shifts"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["shift_assignments"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export type EventSummary = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: EventRow["status"];
  coverage: { filled: number; required: number };
};

/**
 * Server-side data loaders for the events list/detail and coverage board routes. Generalized to
 * any event id, no hardcoded event name lookups (the legacy `getHackLantaIIEventForAdmin`
 * pattern this replaces for new surfaces).
 */

async function loadShiftCellsForEvent(eventId: string): Promise<ShiftCell[]> {
  const supabase = await createSupabaseServerClient();
  const [{ data: shifts, error: shiftsError }, { data: shiftRoles, error: rolesError }] = await Promise.all([
    supabase.from("shifts").select("*").eq("event_id", eventId).order("starts_at"),
    supabase.from("shift_roles").select("id,name").eq("event_id", eventId),
  ]);

  if (shiftsError || rolesError) {
    throw new Error("Unable to load shifts for this event.");
  }

  const shiftRows = (shifts ?? []) as ShiftRow[];
  const rolesById = new Map(((shiftRoles ?? []) as Pick<ShiftRoleRow, "id" | "name">[]).map((role) => [role.id, role]));
  const shiftIds = shiftRows.map((row) => row.id);

  const { data: assignments, error: assignmentsError } =
    shiftIds.length > 0
      ? await supabase
          .from("shift_assignments")
          .select("id,shift_id,profile_id,status,profiles!shift_assignments_profile_id_fkey(id,full_name,email)")
          .in("shift_id", shiftIds)
      : { data: [], error: null };

  if (assignmentsError) {
    throw new Error("Unable to load assignments for this event.");
  }

  const assignmentRows = (assignments ?? []) as (AssignmentRow & {
    profiles: Pick<ProfileRow, "id" | "full_name" | "email"> | null;
  })[];

  return buildShiftCells({
    shifts: shiftRows.map((shift) => ({
      id: shift.id,
      eventId: shift.event_id,
      title: shift.title,
      startsAt: shift.starts_at,
      endsAt: shift.ends_at,
      location: shift.location,
      requiredPeople: shift.required_people,
      station: shift.shift_role_id ? rolesById.get(shift.shift_role_id) ?? null : null,
    })),
    requirements: [],
    assignments: assignmentRows.map((assignment) => ({
      id: assignment.id,
      shiftId: assignment.shift_id,
      profileId: assignment.profile_id,
      fullName: assignment.profiles?.full_name?.trim() || assignment.profiles?.email || "Unknown member",
      coverageRoleId: assignment.coverage_role_id,
      active: (ACTIVE_ASSIGNMENT_STATUSES as readonly string[]).includes(assignment.status),
    })),
    now: new Date(),
  });
}

export async function listEvents(): Promise<EventSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data: events, error } = await supabase.from("events").select("*").order("starts_at", { ascending: true });

  if (error) {
    throw new Error("Unable to load events.");
  }

  const eventRows = (events ?? []) as EventRow[];

  if (eventRows.length === 0) {
    return [];
  }

  // Batched, not one loadShiftCellsForEvent() call per event: that was 2-3 round trips per row,
  // scaling with total event count on every /events and /coverage index load. Fetch shifts/roles
  // for every listed event in one pair of queries, build every ShiftCell once, then group by
  // event in memory, reusing the exact same buildShiftCells/summarizeCoverage coverage math a
  // single event's board uses.
  const eventIds = eventRows.map((event) => event.id);
  const [{ data: shifts, error: shiftsError }, { data: shiftRoles, error: rolesError }] = await Promise.all([
    supabase.from("shifts").select("*").in("event_id", eventIds).order("starts_at"),
    supabase.from("shift_roles").select("id,name").in("event_id", eventIds),
  ]);

  if (shiftsError || rolesError) {
    throw new Error("Unable to load shifts for these events.");
  }

  const shiftRows = (shifts ?? []) as ShiftRow[];
  const rolesById = new Map(((shiftRoles ?? []) as Pick<ShiftRoleRow, "id" | "name">[]).map((role) => [role.id, role]));
  const shiftIds = shiftRows.map((row) => row.id);

  const { data: assignments, error: assignmentsError } =
    shiftIds.length > 0
      ? await supabase
          .from("shift_assignments")
          .select("id,shift_id,profile_id,status,profiles!shift_assignments_profile_id_fkey(id,full_name,email)")
          .in("shift_id", shiftIds)
      : { data: [], error: null };

  if (assignmentsError) {
    throw new Error("Unable to load assignments for these events.");
  }

  const assignmentRows = (assignments ?? []) as (AssignmentRow & {
    profiles: Pick<ProfileRow, "id" | "full_name" | "email"> | null;
  })[];

  const cells = buildShiftCells({
    shifts: shiftRows.map((shift) => ({
      id: shift.id,
      eventId: shift.event_id,
      title: shift.title,
      startsAt: shift.starts_at,
      endsAt: shift.ends_at,
      location: shift.location,
      requiredPeople: shift.required_people,
      station: shift.shift_role_id ? rolesById.get(shift.shift_role_id) ?? null : null,
    })),
    requirements: [],
    assignments: assignmentRows.map((assignment) => ({
      id: assignment.id,
      shiftId: assignment.shift_id,
      profileId: assignment.profile_id,
      fullName: assignment.profiles?.full_name?.trim() || assignment.profiles?.email || "Unknown member",
      coverageRoleId: assignment.coverage_role_id,
      active: (ACTIVE_ASSIGNMENT_STATUSES as readonly string[]).includes(assignment.status),
    })),
    now: new Date(),
  });

  const cellsByEvent = new Map<string, ShiftCell[]>();
  for (const cell of cells) {
    if (!cell.eventId) {
      continue;
    }
    const rows = cellsByEvent.get(cell.eventId) ?? [];
    rows.push(cell);
    cellsByEvent.set(cell.eventId, rows);
  }

  return eventRows.map((event) => ({
    id: event.id,
    name: event.name,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    timezone: event.timezone,
    status: event.status,
    coverage: summarizeCoverage(cellsByEvent.get(event.id) ?? []),
  }));
}

export async function getEventById(eventId: string): Promise<EventRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();

  if (error) {
    throw new Error("Unable to load the event.");
  }

  return (data as EventRow | null) ?? null;
}

export async function getEventStations(eventId: string): Promise<Pick<ShiftRoleRow, "id" | "name" | "description">[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("shift_roles")
    .select("id,name,description")
    .eq("event_id", eventId)
    .order("name");

  if (error) {
    throw new Error("Unable to load stations for this event.");
  }

  return (data ?? []) as Pick<ShiftRoleRow, "id" | "name" | "description">[];
}

export type CoverageBoardData = {
  event: EventRow;
  stations: Pick<ShiftRoleRow, "id" | "name" | "description">[];
  cells: ShiftCell[];
  summary: { filled: number; required: number };
};

export async function getCoverageBoardData(eventId: string): Promise<CoverageBoardData | null> {
  const event = await getEventById(eventId);

  if (!event) {
    return null;
  }

  const [stations, cells] = await Promise.all([getEventStations(eventId), loadShiftCellsForEvent(eventId)]);

  return { event, stations, cells, summary: summarizeCoverage(cells) };
}

export type AgendaShift = {
  id: string;
  /** Null for a standalone shift (no event, e.g. weekly office hours). */
  eventId: string | null;
  eventName: string;
  title: string;
  station: string | null;
  startsAt: string;
  endsAt: string;
  location: string | null;
  headcountRequired: number;
  headcountAssigned: number;
  /**
   * The owning event's timezone, for day-grouping and time display. Null for a standalone shift:
   * there is no per-shift timezone column yet (schema-requests.md), so those render in whatever
   * timezone the page happens to run in until that's added.
   */
  timezone: string | null;
};

/** Flat, time-sorted shift list across every event, for the organizer agenda calendar view. */
export async function listUpcomingShifts(): Promise<AgendaShift[]> {
  const supabase = await createSupabaseServerClient();
  const { data: shifts, error } = await supabase
    .from("shifts")
    .select(
      "id,event_id,title,starts_at,ends_at,location,required_people,shift_role_id,events!shifts_event_id_fkey(name,timezone),shift_roles(name)",
    )
    .order("starts_at", { ascending: true });

  if (error) {
    throw new Error("Unable to load shifts.");
  }

  const shiftRows = (shifts ?? []) as (ShiftRow & {
    events: { name: string; timezone: string } | null;
    shift_roles: { name: string } | null;
  })[];
  const shiftIds = shiftRows.map((row) => row.id);

  const { data: assignments, error: assignmentsError } =
    shiftIds.length > 0
      ? await supabase.from("shift_assignments").select("shift_id,status").in("shift_id", shiftIds)
      : { data: [], error: null };

  if (assignmentsError) {
    throw new Error("Unable to load assignment counts.");
  }

  const assignedCountByShift = new Map<string, number>();
  for (const row of (assignments ?? []) as { shift_id: string; status: string }[]) {
    if (!(ACTIVE_ASSIGNMENT_STATUSES as readonly string[]).includes(row.status)) {
      continue;
    }
    assignedCountByShift.set(row.shift_id, (assignedCountByShift.get(row.shift_id) ?? 0) + 1);
  }

  return shiftRows.map((shift) => ({
    id: shift.id,
    eventId: shift.event_id,
    eventName: shift.events?.name ?? "Standalone",
    title: shift.title,
    station: shift.shift_roles?.name ?? null,
    startsAt: shift.starts_at,
    endsAt: shift.ends_at,
    location: shift.location,
    headcountRequired: shift.required_people,
    headcountAssigned: assignedCountByShift.get(shift.id) ?? 0,
    timezone: shift.events?.timezone ?? null,
  }));
}

export type RosterMember = {
  profileId: string;
  fullName: string;
  assignedHours: number;
  maxHours: number | null;
  overMax: boolean;
};

/** Right-side roster panel: active members with hours assigned to this event. Organizer-visible only. */
export async function getRosterForEvent(eventId: string): Promise<RosterMember[]> {
  const supabase = await createSupabaseServerClient();
  const [{ data: profiles, error: profilesError }, { data: settings }, { data: assignments, error: assignmentsError }] =
    await Promise.all([
      supabase.from("profiles").select("id,full_name,email,is_active").eq("is_active", true),
      supabase.from("member_settings").select("profile_id,max_hours").eq("event_id", eventId),
      supabase
        .from("shift_assignments")
        .select("profile_id,status,shifts!shift_assignments_shift_id_fkey!inner(event_id,starts_at,ends_at)")
        .eq("shifts.event_id", eventId)
        .in("status", [...ACTIVE_ASSIGNMENT_STATUSES]),
    ]);

  if (profilesError || assignmentsError) {
    throw new Error("Unable to load the roster for this event.");
  }

  const maxHoursByProfile = new Map(
    ((settings ?? []) as { profile_id: string; max_hours: number }[]).map((row) => [row.profile_id, Number(row.max_hours)]),
  );
  const hoursByProfile = new Map<string, number>();

  for (const row of (assignments ?? []) as {
    profile_id: string;
    shifts: { event_id: string; starts_at: string; ends_at: string } | null;
  }[]) {
    if (!row.shifts) {
      continue;
    }
    const hours = (new Date(row.shifts.ends_at).getTime() - new Date(row.shifts.starts_at).getTime()) / 3_600_000;
    hoursByProfile.set(row.profile_id, (hoursByProfile.get(row.profile_id) ?? 0) + hours);
  }

  return ((profiles ?? []) as { id: string; full_name: string; email: string }[])
    .map((profile) => {
      const assignedHours = Math.round((hoursByProfile.get(profile.id) ?? 0) * 100) / 100;
      const maxHours = maxHoursByProfile.get(profile.id) ?? null;
      return {
        profileId: profile.id,
        fullName: profile.full_name?.trim() || profile.email,
        assignedHours,
        maxHours,
        overMax: maxHours !== null && assignedHours > maxHours,
      };
    })
    .toSorted((first, second) => second.assignedHours - first.assignedHours);
}
