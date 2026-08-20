import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildShiftCells, summarizeCoverage } from "@/lib/scheduling/coverage";
import { ACTIVE_APPROVAL_STATES, type ApprovalState, type ShiftCell } from "@/lib/scheduling/types";
import type { Database } from "@/types/database";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
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
          .select("id,shift_id,profile_id,state,profiles!shift_assignments_profile_id_fkey(id,full_name,email)")
          .in("shift_id", shiftIds)
      : { data: [], error: null };

  if (assignmentsError) {
    throw new Error("Unable to load assignments for this event.");
  }

  const assignmentRows = (assignments ?? []) as (Omit<AssignmentRow, "status"> & {
    state: ApprovalState;
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
      notes: shift.notes,
      station: shift.shift_role_id ? rolesById.get(shift.shift_role_id) ?? null : null,
    })),
    requirements: [],
    assignments: assignmentRows.map((assignment) => ({
      id: assignment.id,
      shiftId: assignment.shift_id,
      profileId: assignment.profile_id,
      fullName: assignment.profiles?.full_name?.trim() || assignment.profiles?.email || "Unknown member",
      coverageRoleId: assignment.coverage_role_id,
      active: (ACTIVE_APPROVAL_STATES as readonly string[]).includes(assignment.state),
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
          .select("id,shift_id,profile_id,state,profiles!shift_assignments_profile_id_fkey(id,full_name,email)")
          .in("shift_id", shiftIds)
      : { data: [], error: null };

  if (assignmentsError) {
    throw new Error("Unable to load assignments for these events.");
  }

  const assignmentRows = (assignments ?? []) as (Omit<AssignmentRow, "status"> & {
    state: ApprovalState;
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
      notes: shift.notes,
      station: shift.shift_role_id ? rolesById.get(shift.shift_role_id) ?? null : null,
    })),
    requirements: [],
    assignments: assignmentRows.map((assignment) => ({
      id: assignment.id,
      shiftId: assignment.shift_id,
      profileId: assignment.profile_id,
      fullName: assignment.profiles?.full_name?.trim() || assignment.profiles?.email || "Unknown member",
      coverageRoleId: assignment.coverage_role_id,
      active: (ACTIVE_APPROVAL_STATES as readonly string[]).includes(assignment.state),
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
      ? await supabase.from("shift_assignments").select("shift_id,state").in("shift_id", shiftIds)
      : { data: [], error: null };

  if (assignmentsError) {
    throw new Error("Unable to load assignment counts.");
  }

  const assignedCountByShift = new Map<string, number>();
  for (const row of (assignments ?? []) as { shift_id: string; state: ApprovalState }[]) {
    if (!(ACTIVE_APPROVAL_STATES as readonly string[]).includes(row.state)) {
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
        .select("profile_id,state,shifts!shift_assignments_shift_id_fkey!inner(event_id,starts_at,ends_at)")
        .eq("shifts.event_id", eventId)
        .in("state", [...ACTIVE_APPROVAL_STATES]),
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

// -------------------------------------------------------------------------------------------
// V2: the horizontal, by-person schedule. Same event-scoped data as the coverage board (shifts,
// stations, active assignments), grouped by person instead of by station, with a per-assignment
// ApprovalState instead of the shift-level ShiftCellStatus (buildShiftCells collapses every
// active assignment status into one boolean, which is right for headcount but loses the
// per-assignment status this view needs).
// -------------------------------------------------------------------------------------------

export type PersonAssignment = {
  assignmentId: string;
  shiftId: string;
  title: string;
  station: CoverageStationRef | null;
  startsAt: string;
  endsAt: string;
  location: string | null;
  approvalState: ApprovalState;
  notes: string | null;
};

type CoverageStationRef = { id: string; name: string };

export type PersonScheduleRow = {
  profileId: string;
  fullName: string;
  assignments: PersonAssignment[];
};

export type PersonScheduleGrid = {
  event: EventRow;
  people: PersonScheduleRow[];
  /** Shifts with open slots (status !== "full"), rendered as hollow/partial capsules in the pooled "Unassigned" row. */
  unassigned: ShiftCell[];
  /** Earliest shift start / latest shift end across the event, for the timeline axis range. Null when there are no shifts. */
  windowStart: string | null;
  windowEnd: string | null;
};

export async function getPersonScheduleGrid(eventId: string): Promise<PersonScheduleGrid | null> {
  const event = await getEventById(eventId);

  if (!event) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const [cells, { data: shiftRoles }] = await Promise.all([
    loadShiftCellsForEvent(eventId),
    supabase.from("shift_roles").select("id,name").eq("event_id", eventId),
  ]);

  const shiftIds = cells.map((cell) => cell.shiftId);
  const rolesById = new Map(((shiftRoles ?? []) as Pick<ShiftRoleRow, "id" | "name">[]).map((role) => [role.id, role]));

  const { data: assignments, error: assignmentsError } =
    shiftIds.length > 0
      ? await supabase
          .from("shift_assignments")
          .select(
            "id,shift_id,profile_id,state,shifts!shift_assignments_shift_id_fkey(shift_role_id),profiles!shift_assignments_profile_id_fkey(id,full_name,email)",
          )
          .in("shift_id", shiftIds)
          .in("state", [...ACTIVE_APPROVAL_STATES])
      : { data: [], error: null };

  if (assignmentsError) {
    throw new Error("Unable to load assignments for this event.");
  }

  const cellsByShiftId = new Map(cells.map((cell) => [cell.shiftId, cell]));
  const peopleByProfileId = new Map<string, PersonScheduleRow>();

  for (const row of (assignments ?? []) as {
    id: string;
    shift_id: string;
    state: ApprovalState;
    shifts: { shift_role_id: string | null } | null;
    profiles: { id: string; full_name: string; email: string } | null;
  }[]) {
    const cell = cellsByShiftId.get(row.shift_id);
    if (!cell || !row.profiles) {
      continue;
    }

    const stationId = row.shifts?.shift_role_id ?? null;
    const station = stationId ? rolesById.get(stationId) ?? null : cell.station;
    const profileId = row.profiles.id;
    const person = peopleByProfileId.get(profileId) ?? {
      profileId,
      fullName: row.profiles.full_name?.trim() || row.profiles.email,
      assignments: [],
    };

    person.assignments.push({
      assignmentId: row.id,
      shiftId: row.shift_id,
      title: cell.title,
      station: station ? { id: station.id, name: station.name } : null,
      startsAt: cell.startsAt,
      endsAt: cell.endsAt,
      location: cell.location,
      approvalState: row.state,
      notes: cell.notes,
    });
    peopleByProfileId.set(profileId, person);
  }

  for (const person of peopleByProfileId.values()) {
    person.assignments.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  const people = Array.from(peopleByProfileId.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
  const unassigned = cells.filter((cell) => cell.status !== "full").sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const allStarts = cells.map((cell) => new Date(cell.startsAt).getTime());
  const allEnds = cells.map((cell) => new Date(cell.endsAt).getTime());

  return {
    event,
    people,
    unassigned,
    windowStart: allStarts.length > 0 ? new Date(Math.min(...allStarts)).toISOString() : null,
    windowEnd: allEnds.length > 0 ? new Date(Math.max(...allEnds)).toISOString() : null,
  };
}

/**
 * One row per assignment, plus one row per still-open shift (approvalState "not_assigned",
 * personName null, openCount is how many more people it still needs). Shared flat shape for the
 * Day and List views, both of which need "time, station, person, StatusPill" without the
 * by-person grid's row grouping.
 */
export type ScheduleRow = {
  shiftId: string;
  assignmentId: string | null;
  title: string;
  station: CoverageStationRef | null;
  startsAt: string;
  endsAt: string;
  location: string | null;
  personName: string | null;
  approvalState: ApprovalState;
  /** Only meaningful when approvalState is "not_assigned": how many more people this shift needs. */
  openCount: number;
  notes: string | null;
};

export function flattenPersonScheduleGrid(grid: PersonScheduleGrid): ScheduleRow[] {
  const rows: ScheduleRow[] = [];

  for (const person of grid.people) {
    for (const assignment of person.assignments) {
      rows.push({
        shiftId: assignment.shiftId,
        assignmentId: assignment.assignmentId,
        title: assignment.title,
        station: assignment.station,
        startsAt: assignment.startsAt,
        endsAt: assignment.endsAt,
        location: assignment.location,
        personName: person.fullName,
        approvalState: assignment.approvalState,
        openCount: 0,
        notes: assignment.notes,
      });
    }
  }

  for (const cell of grid.unassigned) {
    rows.push({
      shiftId: cell.shiftId,
      assignmentId: null,
      title: cell.title,
      station: cell.station,
      startsAt: cell.startsAt,
      endsAt: cell.endsAt,
      location: cell.location,
      personName: null,
      approvalState: "not_assigned",
      openCount: cell.headcountRequired - cell.headcountAssigned,
      notes: cell.notes,
    });
  }

  return rows.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

// -------------------------------------------------------------------------------------------
// V2: the approval queue. Every in_approval assignment, grouped by event, with who proposed it
// and the warnings computed at write time (conflict-engine.ts, stored on the row so this never
// recomputes anything).
// -------------------------------------------------------------------------------------------

export type ApprovalQueueWarning = { kind: string; message: string };

export type ApprovalQueueRow = {
  assignmentId: string;
  shiftId: string;
  shiftTitle: string;
  station: CoverageStationRef | null;
  startsAt: string;
  endsAt: string;
  personId: string;
  personName: string;
  /** "ai" (proposed_by_ai), a proposer's display name (assigned_by set), or "Self" (both null, member self-signup). */
  proposedBy: string;
  warnings: ApprovalQueueWarning[];
};

export type ApprovalQueueEvent = {
  eventId: string;
  eventName: string;
  eventTimezone: string;
  rows: ApprovalQueueRow[];
};

/** Admin sees every event's queue; pass eventIds to scope to a director's own events (read-only for them). */
export async function getApprovalQueue(options: { eventIds?: string[] } = {}): Promise<ApprovalQueueEvent[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("shift_assignments")
    .select(
      "id,shift_id,profile_id,assigned_by,proposed_by_ai,warnings," +
        "shifts!shift_assignments_shift_id_fkey!inner(id,title,starts_at,ends_at,event_id,shift_role_id,shift_roles(id,name),events(id,name,timezone))," +
        "profiles!shift_assignments_profile_id_fkey(id,full_name,email)," +
        "proposer:profiles!shift_assignments_assigned_by_fkey(id,full_name,email)",
    )
    .eq("state", "in_approval")
    .order("created_at", { ascending: true });

  if (options.eventIds) {
    if (options.eventIds.length === 0) {
      return [];
    }
    // !inner above turns this from a nested-embed filter (silently ignored by PostgREST on a
    // plain left-join embed) into a real filter on the joined row, same pattern
    // getRosterForEvent already uses for the identical reason.
    query = query.in("shifts.event_id", options.eventIds);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error("Unable to load the approval queue.");
  }

  type QueueRow = {
    id: string;
    shift_id: string;
    profile_id: string;
    assigned_by: string | null;
    proposed_by_ai: boolean;
    warnings: ApprovalQueueWarning[] | null;
    shifts: {
      id: string;
      title: string;
      starts_at: string;
      ends_at: string;
      event_id: string | null;
      shift_role_id: string | null;
      shift_roles: { id: string; name: string } | null;
      events: { id: string; name: string; timezone: string } | null;
    } | null;
    profiles: { id: string; full_name: string; email: string } | null;
    proposer: { id: string; full_name: string; email: string } | null;
  };

  const eventsById = new Map<string, ApprovalQueueEvent>();

  for (const row of (data ?? []) as unknown as QueueRow[]) {
    const shift = row.shifts;
    const event = shift?.events;
    const person = row.profiles;

    if (!shift || !event || !person) {
      continue;
    }

    const proposedBy = row.proposed_by_ai
      ? "AI"
      : row.proposer
        ? row.proposer.full_name?.trim() || row.proposer.email
        : "Self";

    const queueEvent = eventsById.get(event.id) ?? {
      eventId: event.id,
      eventName: event.name,
      eventTimezone: event.timezone,
      rows: [],
    };

    queueEvent.rows.push({
      assignmentId: row.id,
      shiftId: row.shift_id,
      shiftTitle: shift.title,
      station: shift.shift_roles ? { id: shift.shift_roles.id, name: shift.shift_roles.name } : null,
      startsAt: shift.starts_at,
      endsAt: shift.ends_at,
      personId: person.id,
      personName: person.full_name?.trim() || person.email,
      proposedBy,
      warnings: row.warnings ?? [],
    });
    eventsById.set(event.id, queueEvent);
  }

  for (const queueEvent of eventsById.values()) {
    queueEvent.rows.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  return Array.from(eventsById.values()).sort((a, b) => a.eventName.localeCompare(b.eventName));
}

// -------------------------------------------------------------------------------------------
// V2: event_directors (supabase/migrations/20260817000100_v2_role_model_and_event_directors.sql).
// Admin-only write (RLS: event_directors_admin_write), used by the event settings panel to pick
// which directors are scoped to an event.
// -------------------------------------------------------------------------------------------

export type EventDirector = { userId: string; fullName: string; email: string };

export async function getEventDirectors(eventId: string): Promise<EventDirector[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_directors")
    .select("user_id,profiles!event_directors_user_id_fkey(id,full_name,email)")
    .eq("event_id", eventId);

  if (error) {
    throw new Error("Unable to load this event's directors.");
  }

  return ((data ?? []) as { user_id: string; profiles: { id: string; full_name: string; email: string } | null }[])
    .filter((row) => row.profiles)
    .map((row) => ({
      userId: row.user_id,
      fullName: row.profiles!.full_name?.trim() || row.profiles!.email,
      email: row.profiles!.email,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/** Every active director, for the "add a director" picker. Not scoped to one event: the same person can direct several. */
export async function listDirectorCandidates(): Promise<{ userId: string; fullName: string; email: string }[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,email")
    .eq("role", "director")
    .eq("is_active", true)
    .order("full_name");

  if (error) {
    throw new Error("Unable to load directors.");
  }

  return ((data ?? []) as { id: string; full_name: string; email: string }[]).map((row) => ({
    userId: row.id,
    fullName: row.full_name?.trim() || row.email,
    email: row.email,
  }));
}
