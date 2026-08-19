"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/db/rpc";
import { requireDirectorOf, requireOrganizer, requireRole } from "@/lib/auth/authorization";
import { bulkGenerationInputSchema, generateShiftGrid } from "@/lib/scheduling/bulk-generation";
import { checkAssignmentConflicts } from "@/lib/scheduling/conflict-engine";
import { ACTIVE_APPROVAL_STATES } from "@/lib/scheduling/types";
import { sendScheduleNotification } from "@/lib/notifications/service";
import { scheduleNotificationEvents } from "@/lib/notifications/types";
import type { Json, TablesInsert, TablesUpdate } from "@/types/database";

/**
 * Plain, typed, "use server" actions. This is the surface Agent 6's command palette calls
 * directly (no forms, no FormData, no redirects) and the surface my own event/coverage pages
 * call from client components. Keep every action here typed-args-in, ActionResult-out.
 */

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; message: string };

function fail(message: string): ActionResult<never> {
  return { ok: false, message };
}

async function insertAuditLog(input: {
  actorId: string;
  eventId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Json;
}) {
  const supabase = await createSupabaseServerClient();
  const insert: TablesInsert<"audit_log"> = {
    actor_id: input.actorId,
    event_id: input.eventId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    metadata: input.metadata,
  };
  const { error } = await supabase.from("audit_log").insert(insert as never);

  if (error) {
    console.warn("Audit logging failed.", { action: input.action, error: error.message });
  }
}

// ---------------------------------------------------------------------------------------------
// createEvent
// ---------------------------------------------------------------------------------------------

const createEventInputSchema = z
  .object({
    name: z.string().trim().min(1, "Event name is required.").max(200),
    description: z.string().trim().max(2000).optional(),
    location: z.string().trim().max(200).optional(),
    startsAt: z.string().datetime({ message: "Choose a valid start time." }),
    endsAt: z.string().datetime({ message: "Choose a valid end time." }),
    timezone: z.string().trim().min(1, "Timezone is required."),
  })
  .refine((value) => new Date(value.startsAt).getTime() < new Date(value.endsAt).getTime(), {
    message: "Event start must be before end.",
    path: ["endsAt"],
  });

export type CreateEventInput = z.infer<typeof createEventInputSchema>;

// V2 role model: admin is global and creates events; a director's authority is scoped to events
// they're already assigned to (event_directors), so directors cannot create new ones.
export async function createEvent(input: CreateEventInput): Promise<ActionResult<{ eventId: string }>> {
  const admin = await requireRole("admin");
  const parsed = createEventInputSchema.safeParse(input);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the event details.");
  }

  const supabase = await createSupabaseServerClient();
  const insert: TablesInsert<"events"> = {
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    location: parsed.data.location ?? null,
    starts_at: parsed.data.startsAt,
    ends_at: parsed.data.endsAt,
    timezone: parsed.data.timezone,
    status: "draft",
    created_by: admin.user.id,
  };
  const { data, error } = await supabase.from("events").insert(insert as never).select("id").single();

  if (error || !data) {
    return fail("Unable to create event.");
  }

  const eventId = (data as { id: string }).id;

  await insertAuditLog({
    actorId: admin.user.id,
    eventId,
    action: "event.created",
    entityType: "event",
    entityId: eventId,
    metadata: { name: parsed.data.name },
  });

  revalidatePath("/events");
  return { ok: true, data: { eventId } };
}

// ---------------------------------------------------------------------------------------------
// publishEvent
// ---------------------------------------------------------------------------------------------

const publishEventInputSchema = z.object({ eventId: z.string().uuid() });

// V2: publishing an event only makes its shifts visible/joinable to members, decoupled from
// assignment approval (V1 conflated the two: publishing an event also flipped its draft
// assignments to published and notified members then). Whether an assignment is visible to its
// member as confirmed is now entirely the approval queue's job (approve_assignments), independent
// of event status, per the shared V2 decision.
export async function publishEvent(
  input: z.infer<typeof publishEventInputSchema>,
): Promise<ActionResult<undefined>> {
  const parsed = publishEventInputSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Check the event.");
  }

  const director = await requireDirectorOf(parsed.data.eventId);
  const supabase = await createSupabaseServerClient();
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id,status")
    .eq("id", parsed.data.eventId)
    .maybeSingle();

  if (eventError || !event) {
    return fail("Event was not found.");
  }

  const eventRow = event as { id: string; status: string };

  if (eventRow.status === "published") {
    return fail("Event is already published.");
  }

  if (eventRow.status === "archived") {
    return fail("Archived events cannot be republished.");
  }

  const updateEvent: TablesUpdate<"events"> = { status: "published" };
  const { error: eventUpdateError } = await supabase.from("events").update(updateEvent as never).eq("id", eventRow.id);

  if (eventUpdateError) {
    return fail("Unable to publish the event.");
  }

  await insertAuditLog({
    actorId: director.user.id,
    eventId: eventRow.id,
    action: "event.published",
    entityType: "event",
    entityId: eventRow.id,
    metadata: {},
  });

  revalidatePath(`/events/${eventRow.id}`);
  revalidatePath(`/coverage/${eventRow.id}`);
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------------------------
// createStation
// ---------------------------------------------------------------------------------------------

const createStationInputSchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().trim().min(1, "Station name is required.").max(120),
});

export async function createStation(
  input: z.infer<typeof createStationInputSchema>,
): Promise<ActionResult<{ stationId: string }>> {
  const parsed = createStationInputSchema.safeParse(input);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the station name.");
  }

  await requireDirectorOf(parsed.data.eventId);
  const supabase = await createSupabaseServerClient();
  const insert: TablesInsert<"shift_roles"> = { event_id: parsed.data.eventId, name: parsed.data.name };
  const { data, error } = await supabase.from("shift_roles").insert(insert as never).select("id").single();

  if (error || !data) {
    return fail("Unable to create the station. It may already exist for this event.");
  }

  revalidatePath(`/events/${parsed.data.eventId}`);
  return { ok: true, data: { stationId: (data as { id: string }).id } };
}

// ---------------------------------------------------------------------------------------------
// generateShifts
// ---------------------------------------------------------------------------------------------

const generateShiftsInputSchema = z.object({
  eventId: z.string().uuid(),
  generation: bulkGenerationInputSchema,
});

export async function generateShifts(
  input: z.infer<typeof generateShiftsInputSchema>,
): Promise<ActionResult<{ count: number }>> {
  const parsed = generateShiftsInputSchema.safeParse(input);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the generator settings.");
  }

  const organizer = await requireDirectorOf(parsed.data.eventId);
  const supabase = await createSupabaseServerClient();
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id")
    .eq("id", parsed.data.eventId)
    .maybeSingle();

  if (eventError || !event) {
    return fail("Event was not found.");
  }

  const grid = generateShiftGrid(parsed.data.generation);

  if (!grid.ok) {
    return fail(grid.message);
  }

  const stationIds = Array.from(new Set(parsed.data.generation.stations.map((station) => station.stationId)));
  const { data: stations, error: stationsError } = await supabase
    .from("shift_roles")
    .select("id")
    .eq("event_id", parsed.data.eventId)
    .in("id", stationIds);

  if (stationsError) {
    return fail("Unable to validate stations.");
  }

  if ((stations ?? []).length !== stationIds.length) {
    return fail("Every station must belong to this event. Create it under the event's stations first.");
  }

  const insertRows: TablesInsert<"shifts">[] = grid.value.map((draft) => ({
    event_id: parsed.data.eventId,
    shift_role_id: draft.stationId,
    title: draft.title,
    starts_at: draft.startsAt,
    ends_at: draft.endsAt,
    required_people: draft.requiredPeople,
  }));

  const { data: created, error: insertError } = await supabase.from("shifts").insert(insertRows as never).select("id");

  if (insertError || !created) {
    return fail("Unable to create shifts. Confirm the window falls inside the event's date range.");
  }

  await insertAuditLog({
    actorId: organizer.user.id,
    eventId: parsed.data.eventId,
    action: "shifts.bulk_generated",
    entityType: "event",
    entityId: parsed.data.eventId,
    metadata: { count: created.length, stations: stationIds },
  });

  revalidatePath(`/events/${parsed.data.eventId}`);
  revalidatePath(`/coverage/${parsed.data.eventId}`);
  return { ok: true, data: { count: created.length } };
}

// ---------------------------------------------------------------------------------------------
// assignMember / unassignMember
// ---------------------------------------------------------------------------------------------

const assignMemberInputSchema = z.object({
  shiftId: z.string().uuid(),
  profileId: z.string().uuid(),
});

type ActiveAssignmentRow = {
  id: string;
  shift_id: string;
  shifts: { event_id: string; starts_at: string; ends_at: string } | null;
};

export async function assignMember(
  input: z.infer<typeof assignMemberInputSchema>,
): Promise<ActionResult<{ assignmentId: string; check: ReturnType<typeof checkAssignmentConflicts> }>> {
  const organizer = await requireOrganizer();
  const parsed = assignMemberInputSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Check the assignment.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: shift, error: shiftError } = await supabase
    .from("shifts")
    .select("id,event_id,title,starts_at,ends_at,location,required_people,shift_role_id")
    .eq("id", parsed.data.shiftId)
    .maybeSingle();

  if (shiftError || !shift) {
    return fail("Shift was not found.");
  }

  const shiftRow = shift as {
    id: string;
    event_id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    location: string | null;
    required_people: number;
    shift_role_id: string | null;
  };

  const [
    { data: profile, error: profileError },
    { data: shiftAssignments, error: shiftAssignmentsError },
    { data: memberSettings },
    { data: availabilityWindows },
    { data: allAssignments, error: allAssignmentsError },
  ] = await Promise.all([
    supabase.from("profiles").select("id,full_name,email,is_active").eq("id", parsed.data.profileId).maybeSingle(),
    supabase.from("shift_assignments").select("id").eq("shift_id", shiftRow.id).in("state", [...ACTIVE_APPROVAL_STATES]),
    supabase
      .from("member_settings")
      .select("max_hours,minimum_break_minutes")
      .eq("event_id", shiftRow.event_id)
      .eq("profile_id", parsed.data.profileId)
      .maybeSingle(),
    supabase
      .from("availability_windows")
      .select("starts_at,ends_at")
      .eq("event_id", shiftRow.event_id)
      .eq("profile_id", parsed.data.profileId)
      .eq("status", "available"),
    supabase
      .from("shift_assignments")
      .select("id,shift_id,shifts!shift_assignments_shift_id_fkey(event_id,starts_at,ends_at)")
      .eq("profile_id", parsed.data.profileId)
      .in("state", [...ACTIVE_APPROVAL_STATES]),
  ]);

  if (profileError || !profile) {
    return fail("Member was not found.");
  }

  if (!(profile as { is_active: boolean }).is_active) {
    return fail("This member is inactive.");
  }

  if (shiftAssignmentsError || allAssignmentsError) {
    return fail("Unable to check for scheduling conflicts.");
  }

  const otherAssignments = ((allAssignments ?? []) as ActiveAssignmentRow[]).filter((row) => row.shifts);
  const existingAssignments = otherAssignments.map((row) => ({
    id: row.shift_id,
    startsAt: row.shifts!.starts_at,
    endsAt: row.shifts!.ends_at,
  }));
  const assignedHoursThisEvent = otherAssignments
    .filter((row) => row.shifts!.event_id === shiftRow.event_id)
    .reduce(
      (total, row) => total + (new Date(row.shifts!.ends_at).getTime() - new Date(row.shifts!.starts_at).getTime()) / 3_600_000,
      0,
    );
  const settings = memberSettings as { max_hours: number; minimum_break_minutes: number } | null;

  const check = checkAssignmentConflicts({
    shift: { id: shiftRow.id, startsAt: shiftRow.starts_at, endsAt: shiftRow.ends_at },
    existingAssignments,
    capacity: { assigned: (shiftAssignments ?? []).length, required: shiftRow.required_people },
    availabilityWindows: (availabilityWindows ?? []) as { startsAt: string; endsAt: string }[],
    // Interim: member_settings.max_hours is scoped to the whole event, not a rolling week. True
    // weekly rollups need standing/weekly shift support (docs/contracts/schema-requests.md #5).
    maxHoursPerWeek: settings ? Number(settings.max_hours) : null,
    assignedHoursThisWeek: assignedHoursThisEvent,
    minimumBreakMinutes: settings ? settings.minimum_break_minutes : null,
  });

  // V2: every write lands as in_approval (shared decision), warnings are computed here and stored
  // on the row so the approval queue can render them without recomputing anything.
  const insert: TablesInsert<"shift_assignments"> = {
    shift_id: shiftRow.id,
    profile_id: parsed.data.profileId,
    coverage_role_id: null,
    assigned_by: organizer.user.id,
    origin: "assigned",
    state: "in_approval",
    warnings: (check.status === "warning" ? check.reasons.map((message) => ({ kind: "schedule", message })) : []) as unknown as Json,
  };
  const { data: assignment, error } = await supabase
    .from("shift_assignments")
    .insert(insert as never)
    .select("id,created_at")
    .single();

  if (error || !assignment) {
    return fail("Unable to create the assignment.");
  }

  const assignmentId = (assignment as { id: string }).id;
  const profileRow = profile as { id: string; full_name: string; email: string; is_active: boolean };

  // Everything below the durable write is bookkeeping the caller does not wait on. Previously this
  // action awaited an audit-log insert, a second `events` select, and a live resend.emails.send()
  // HTTPS call before returning; the action's response is what unblocks the coverage board's
  // capsule flip, so a click-to-animation path was gated on an email API round trip. Both were
  // already best-effort (failures only console.warn), so `after()` preserves their semantics
  // exactly while taking them off the response path. Request APIs (cookies, and therefore the
  // Supabase server client) remain available inside after().
  after(async () => {
    await insertAuditLog({
      actorId: organizer.user.id,
      eventId: shiftRow.event_id,
      action: "assignment.created",
      entityType: "shift_assignment",
      entityId: assignmentId,
      metadata: { shift_id: shiftRow.id, profile_id: parsed.data.profileId, conflict_check: check as unknown as Json },
    });

    const notifyClient = await createSupabaseServerClient();
    const { data: eventRow } = await notifyClient
      .from("events")
      .select("name,timezone")
      .eq("id", shiftRow.event_id)
      .maybeSingle();
    const eventInfo = eventRow as { name: string; timezone: string } | null;

    if (!eventInfo) return;

    const result = await sendScheduleNotification({
      eventName: eventInfo.name,
      eventType: scheduleNotificationEvents.assignmentAdded,
      recipient: { email: profileRow.email, fullName: profileRow.full_name, id: profileRow.id, isActive: profileRow.is_active },
      shift: {
        coverageRoleName: null,
        endsAt: shiftRow.ends_at,
        location: shiftRow.location,
        startsAt: shiftRow.starts_at,
        status: "draft",
        title: shiftRow.title,
      },
      timezone: eventInfo.timezone,
    });

    if (!result.ok) {
      console.warn("Assignment notification was not delivered.", { profileId: profileRow.id, status: result.status });
    }
  });

  revalidatePath(`/coverage/${shiftRow.event_id}`);
  return { ok: true, data: { assignmentId, check } };
}

const unassignMemberInputSchema = z.object({ assignmentId: z.string().uuid() });

export async function unassignMember(
  input: z.infer<typeof unassignMemberInputSchema>,
): Promise<ActionResult<undefined>> {
  const organizer = await requireOrganizer();
  const parsed = unassignMemberInputSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Check the assignment.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase
    .from("shift_assignments")
    .select(
      "id,status,shift_id,profiles!shift_assignments_profile_id_fkey(id,full_name,email,is_active),shifts!shift_assignments_shift_id_fkey(id,event_id,title,starts_at,ends_at,location)",
    )
    .eq("id", parsed.data.assignmentId)
    .maybeSingle();

  if (existingError || !existing) {
    return fail("Assignment was not found.");
  }

  const existingRow = existing as {
    id: string;
    status: string;
    shift_id: string;
    profiles?: { id: string; full_name: string; email: string; is_active: boolean } | null;
    shifts?: { id: string; event_id: string; title: string; starts_at: string; ends_at: string; location: string | null } | null;
  };

  // V2: unassign_assignment (admin or director-of-shift, enforced by the function itself) sets
  // state='not_assigned' and clears approved_by/approved_at atomically. Real authorization boundary,
  // requireOrganizer() above is only the page-level browse gate.
  const { error } = await callRpc(supabase, "unassign_assignment", { p_id: existingRow.id });

  if (error) {
    return fail("Unable to remove the assignment.");
  }

  const profile = existingRow.profiles;
  const shift = existingRow.shifts;

  // Same treatment as assignMember: audit log and notification are best-effort bookkeeping that
  // used to sit between the durable write and the response, delaying the UI update behind an email
  // send. See the comment there.
  after(async () => {
    await insertAuditLog({
      actorId: organizer.user.id,
      eventId: existingRow.shifts?.event_id ?? null,
      action: "assignment.removed",
      entityType: "shift_assignment",
      entityId: existingRow.id,
      metadata: { shift_id: existingRow.shift_id },
    });

    if (!profile?.email || !shift || !profile.is_active) return;

    const notifyClient = await createSupabaseServerClient();
    const { data: eventRow } = await notifyClient
      .from("events")
      .select("name,timezone")
      .eq("id", shift.event_id)
      .maybeSingle();
    const eventInfo = eventRow as { name: string; timezone: string } | null;

    if (!eventInfo) return;

    const result = await sendScheduleNotification({
      eventName: eventInfo.name,
      eventType: scheduleNotificationEvents.assignmentRemoved,
      recipient: { email: profile.email, fullName: profile.full_name, id: profile.id, isActive: profile.is_active },
      shift: {
        coverageRoleName: null,
        endsAt: shift.ends_at,
        location: shift.location,
        startsAt: shift.starts_at,
        status: existingRow.status === "published" ? "published" : "draft",
        title: shift.title,
      },
      timezone: eventInfo.timezone,
    });

    if (!result.ok) {
      console.warn("Unassign notification was not delivered.", { profileId: profile.id, status: result.status });
    }
  });

  if (shift) {
    revalidatePath(`/coverage/${shift.event_id}`);
  }

  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------------------------
// reassignAssignment: horizontal schedule vertical drag, moving an assignment to a different
// person. Re-enters approval, matching every other assignment write (V2 shared decision:
// every write lands as in_approval, approval is the only path to visible-as-confirmed).
// ---------------------------------------------------------------------------------------------

const reassignAssignmentInputSchema = z.object({
  assignmentId: z.string().uuid(),
  profileId: z.string().uuid(),
});

export async function reassignAssignment(
  input: z.infer<typeof reassignAssignmentInputSchema>,
): Promise<ActionResult<undefined>> {
  const parsed = reassignAssignmentInputSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Check the assignment.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase
    .from("shift_assignments")
    .select("id,shift_id,profile_id,shifts!shift_assignments_shift_id_fkey(event_id)")
    .eq("id", parsed.data.assignmentId)
    .maybeSingle();

  if (existingError || !existing) {
    return fail("Assignment was not found.");
  }

  const existingRow = existing as {
    id: string;
    shift_id: string;
    profile_id: string;
    shifts: { event_id: string } | null;
  };

  if (!existingRow.shifts) {
    return fail("Shift was not found.");
  }

  const director = await requireDirectorOf(existingRow.shifts.event_id);

  if (existingRow.profile_id === parsed.data.profileId) {
    return { ok: true, data: undefined };
  }

  const { data: newProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id,is_active")
    .eq("id", parsed.data.profileId)
    .maybeSingle();

  if (profileError || !newProfile || !(newProfile as { is_active: boolean }).is_active) {
    return fail("Member was not found.");
  }

  const update: TablesUpdate<"shift_assignments"> = {
    profile_id: parsed.data.profileId,
    state: "in_approval",
    approved_by: null,
    approved_at: null,
  };
  const { error } = await supabase.from("shift_assignments").update(update as never).eq("id", existingRow.id);

  if (error) {
    return fail("Unable to reassign this shift.");
  }

  await insertAuditLog({
    actorId: director.user.id,
    eventId: existingRow.shifts.event_id,
    action: "assignment.reassigned",
    entityType: "shift_assignment",
    entityId: existingRow.id,
    metadata: {
      shift_id: existingRow.shift_id,
      from_profile_id: existingRow.profile_id,
      to_profile_id: parsed.data.profileId,
    },
  });

  revalidatePath(`/coverage/${existingRow.shifts.event_id}`);
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------------------------
// retimeShift: horizontal schedule horizontal drag, moving a shift's whole time window (15m
// snap decided client-side, this just takes the resulting instants). Time belongs to the shift,
// not one assignment, so every active assignee re-enters approval.
// ---------------------------------------------------------------------------------------------

const retimeShiftInputSchema = z
  .object({
    shiftId: z.string().uuid(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
  })
  .refine((value) => new Date(value.startsAt).getTime() < new Date(value.endsAt).getTime(), {
    message: "Shift start must be before end.",
    path: ["endsAt"],
  });

export async function retimeShift(
  input: z.infer<typeof retimeShiftInputSchema>,
): Promise<ActionResult<undefined>> {
  const parsed = retimeShiftInputSchema.safeParse(input);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the shift time.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: shift, error: shiftError } = await supabase
    .from("shifts")
    .select("id,event_id")
    .eq("id", parsed.data.shiftId)
    .maybeSingle();

  if (shiftError || !shift) {
    return fail("Shift was not found.");
  }

  const shiftRow = shift as { id: string; event_id: string };
  const director = await requireDirectorOf(shiftRow.event_id);

  const updateShift: TablesUpdate<"shifts"> = { starts_at: parsed.data.startsAt, ends_at: parsed.data.endsAt };
  const { error: updateError } = await supabase.from("shifts").update(updateShift as never).eq("id", shiftRow.id);

  if (updateError) {
    return fail("Unable to move this shift.");
  }

  const updateAssignments: TablesUpdate<"shift_assignments"> = {
    state: "in_approval",
    approved_by: null,
    approved_at: null,
  };
  await supabase
    .from("shift_assignments")
    .update(updateAssignments as never)
    .eq("shift_id", shiftRow.id)
    .in("state", [...ACTIVE_APPROVAL_STATES]);

  await insertAuditLog({
    actorId: director.user.id,
    eventId: shiftRow.event_id,
    action: "shift.retimed",
    entityType: "shift",
    entityId: shiftRow.id,
    metadata: { starts_at: parsed.data.startsAt, ends_at: parsed.data.endsAt },
  });

  revalidatePath(`/coverage/${shiftRow.event_id}`);
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------------------------
// approveAssignments / declineAssignment: the approval queue's two actions. Both wrap the V2
// RPCs (supabase/migrations/20260817000200_v2_assignment_approval_state.sql), which own the real
// authorization and field bookkeeping; these are thin, typed call sites plus an audit log entry.
// ---------------------------------------------------------------------------------------------

const approveAssignmentsInputSchema = z.object({ assignmentIds: z.array(z.string().uuid()).min(1) });

/** Admin-only, matches approve_assignments()'s own check: directors propose, only admins approve. */
export async function approveAssignments(
  input: z.infer<typeof approveAssignmentsInputSchema>,
): Promise<ActionResult<{ approvedCount: number }>> {
  const parsed = approveAssignmentsInputSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Check the selected assignments.");
  }

  const admin = await requireRole("admin");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await callRpc(supabase, "approve_assignments", { p_ids: parsed.data.assignmentIds });

  if (error || !data) {
    return fail("Unable to approve the selected assignments.");
  }

  await insertAuditLog({
    actorId: admin.user.id,
    eventId: null,
    action: "assignments.approved",
    entityType: "shift_assignment",
    entityId: null,
    metadata: { assignment_ids: parsed.data.assignmentIds, count: data.length },
  });

  revalidatePath("/approval");
  return { ok: true, data: { approvedCount: data.length } };
}

const declineAssignmentInputSchema = z.object({ assignmentId: z.string().uuid() });

/** Admin, or the director of this assignment's event (unassign_assignment's own check). */
export async function declineAssignment(
  input: z.infer<typeof declineAssignmentInputSchema>,
): Promise<ActionResult<undefined>> {
  const parsed = declineAssignmentInputSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Check the assignment.");
  }

  await requireOrganizer();
  const supabase = await createSupabaseServerClient();
  const { error } = await callRpc(supabase, "unassign_assignment", { p_id: parsed.data.assignmentId });

  if (error) {
    return fail("Unable to decline this assignment.");
  }

  revalidatePath("/approval");
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------------------------
// assignEventDirector / removeEventDirector: admin-only (event_directors_admin_write RLS), the
// event settings panel's director picker.
// ---------------------------------------------------------------------------------------------

const eventDirectorInputSchema = z.object({ eventId: z.string().uuid(), userId: z.string().uuid() });

export async function assignEventDirector(
  input: z.infer<typeof eventDirectorInputSchema>,
): Promise<ActionResult<undefined>> {
  const parsed = eventDirectorInputSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Check the director and event.");
  }

  const admin = await requireRole("admin");
  const supabase = await createSupabaseServerClient();
  const insert: TablesInsert<"event_directors"> = {
    event_id: parsed.data.eventId,
    user_id: parsed.data.userId,
    assigned_by: admin.user.id,
  };
  const { error } = await supabase.from("event_directors").insert(insert as never);

  if (error) {
    return fail("Unable to assign this director. They may already be assigned to this event.");
  }

  await insertAuditLog({
    actorId: admin.user.id,
    eventId: parsed.data.eventId,
    action: "event_director.assigned",
    entityType: "event",
    entityId: parsed.data.eventId,
    metadata: { user_id: parsed.data.userId },
  });

  revalidatePath(`/events/${parsed.data.eventId}`);
  return { ok: true, data: undefined };
}

export async function removeEventDirector(
  input: z.infer<typeof eventDirectorInputSchema>,
): Promise<ActionResult<undefined>> {
  const parsed = eventDirectorInputSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Check the director and event.");
  }

  const admin = await requireRole("admin");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("event_directors")
    .delete()
    .eq("event_id", parsed.data.eventId)
    .eq("user_id", parsed.data.userId);

  if (error) {
    return fail("Unable to remove this director.");
  }

  await insertAuditLog({
    actorId: admin.user.id,
    eventId: parsed.data.eventId,
    action: "event_director.removed",
    entityType: "event",
    entityId: parsed.data.eventId,
    metadata: { user_id: parsed.data.userId },
  });

  revalidatePath(`/events/${parsed.data.eventId}`);
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------------------------
// updateShiftNotes: director notes on a shift, visible to directors/admins only (the panel that
// renders this is itself organizer-gated). Reuses the existing shifts.notes column, no schema
// change needed, it just wasn't exposed by any V2 surface yet.
// ---------------------------------------------------------------------------------------------

const updateShiftNotesInputSchema = z.object({ shiftId: z.string().uuid(), notes: z.string().trim().max(500) });

export async function updateShiftNotes(
  input: z.infer<typeof updateShiftNotesInputSchema>,
): Promise<ActionResult<undefined>> {
  const parsed = updateShiftNotesInputSchema.safeParse(input);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the note.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: shift, error: shiftError } = await supabase
    .from("shifts")
    .select("id,event_id")
    .eq("id", parsed.data.shiftId)
    .maybeSingle();

  if (shiftError || !shift) {
    return fail("Shift was not found.");
  }

  const shiftRow = shift as { id: string; event_id: string | null };

  if (!shiftRow.event_id) {
    return fail("Standalone shifts don't have a director note.");
  }

  await requireDirectorOf(shiftRow.event_id);

  const update: TablesUpdate<"shifts"> = { notes: parsed.data.notes.length > 0 ? parsed.data.notes : null };
  const { error } = await supabase.from("shifts").update(update as never).eq("id", shiftRow.id);

  if (error) {
    return fail("Unable to save the note.");
  }

  revalidatePath(`/coverage/${shiftRow.event_id}`);
  return { ok: true, data: undefined };
}
