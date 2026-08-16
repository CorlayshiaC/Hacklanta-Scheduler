"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganizer } from "@/lib/scheduling/authorization";
import { bulkGenerationInputSchema, generateShiftGrid } from "@/lib/scheduling/bulk-generation";
import { checkAssignmentConflicts } from "@/lib/scheduling/conflict-engine";
import { ACTIVE_ASSIGNMENT_STATUSES } from "@/lib/scheduling/types";
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

export async function createEvent(input: CreateEventInput): Promise<ActionResult<{ eventId: string }>> {
  const organizer = await requireOrganizer();
  const parsed = createEventInputSchema.safeParse(input);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the event details.");
  }

  const supabase = await createSupabaseServerClient();
  // STUB(agent-2): TablesInsert<"events"> predates the description/location columns (docs/
  // contracts/requests.md asks for regeneration). Widen locally rather than hand-editing the
  // generated file.
  const insert: TablesInsert<"events"> & { description: string | null; location: string | null } = {
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    location: parsed.data.location ?? null,
    starts_at: parsed.data.startsAt,
    ends_at: parsed.data.endsAt,
    timezone: parsed.data.timezone,
    status: "draft",
    created_by: organizer.userId,
  };
  const { data, error } = await supabase.from("events").insert(insert as never).select("id").single();

  if (error || !data) {
    return fail("Unable to create event.");
  }

  const eventId = (data as { id: string }).id;

  await insertAuditLog({
    actorId: organizer.userId,
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

export async function publishEvent(
  input: z.infer<typeof publishEventInputSchema>,
): Promise<ActionResult<{ publishedAssignments: number }>> {
  const organizer = await requireOrganizer();
  const parsed = publishEventInputSchema.safeParse(input);

  if (!parsed.success) {
    return fail("Check the event.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id,name,timezone,status")
    .eq("id", parsed.data.eventId)
    .maybeSingle();

  if (eventError || !event) {
    return fail("Event was not found.");
  }

  const eventRow = event as { id: string; name: string; timezone: string; status: string };

  if (eventRow.status === "published") {
    return fail("Event is already published.");
  }

  if (eventRow.status === "archived") {
    return fail("Archived events cannot be republished.");
  }

  const { data: draftAssignments, error: draftError } = await supabase
    .from("shift_assignments")
    .select(
      "id,profile_id,shift_id,coverage_role_id,profiles!shift_assignments_profile_id_fkey(id,full_name,email,is_active),coverage_roles(id,name),shifts!shift_assignments_shift_id_fkey(id,event_id,title,starts_at,ends_at,location)",
    )
    .eq("status", "draft")
    .in(
      "shift_id",
      (
        await supabase.from("shifts").select("id").eq("event_id", eventRow.id)
      ).data?.map((row) => (row as { id: string }).id) ?? [],
    );

  if (draftError) {
    return fail("Unable to load draft assignments.");
  }

  const publishedAt = new Date().toISOString();
  const draftIds = (draftAssignments ?? []).map((row) => (row as { id: string }).id);

  if (draftIds.length > 0) {
    const update: TablesUpdate<"shift_assignments"> = { status: "published", published_at: publishedAt };
    const { error: updateError } = await supabase
      .from("shift_assignments")
      .update(update as never)
      .in("id", draftIds);

    if (updateError) {
      return fail("Unable to publish assignments.");
    }
  }

  const updateEvent: TablesUpdate<"events"> = { status: "published" };
  const { error: eventUpdateError } = await supabase.from("events").update(updateEvent as never).eq("id", eventRow.id);

  if (eventUpdateError) {
    return fail("Assignments were published, but the event status could not be updated.");
  }

  await insertAuditLog({
    actorId: organizer.userId,
    eventId: eventRow.id,
    action: "event.published",
    entityType: "event",
    entityId: eventRow.id,
    metadata: { published_assignment_count: draftIds.length },
  });

  await Promise.all(
    (draftAssignments ?? []).map(async (row) => {
      const assignment = row as {
        profiles?: { id: string; full_name: string; email: string; is_active: boolean } | null;
        coverage_roles?: { id: string; name: string } | null;
        shifts?: { title: string; starts_at: string; ends_at: string; location: string | null } | null;
      };
      const profile = assignment.profiles;
      const shift = assignment.shifts;

      if (!profile?.email || !shift || !profile.is_active) {
        return;
      }

      const result = await sendScheduleNotification({
        eventName: eventRow.name,
        eventType: scheduleNotificationEvents.assignmentAdded,
        recipient: { email: profile.email, fullName: profile.full_name, id: profile.id, isActive: profile.is_active },
        shift: {
          coverageRoleName: assignment.coverage_roles?.name ?? null,
          endsAt: shift.ends_at,
          location: shift.location,
          startsAt: shift.starts_at,
          status: "published",
          title: shift.title,
        },
        timezone: eventRow.timezone,
      });

      if (!result.ok) {
        console.warn("Publish notification was not delivered.", { profileId: profile.id, status: result.status });
      }
    }),
  );

  revalidatePath(`/events/${eventRow.id}`);
  revalidatePath(`/coverage/${eventRow.id}`);
  return { ok: true, data: { publishedAssignments: draftIds.length } };
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
  await requireOrganizer();
  const parsed = createStationInputSchema.safeParse(input);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the station name.");
  }

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
  const organizer = await requireOrganizer();
  const parsed = generateShiftsInputSchema.safeParse(input);

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Check the generator settings.");
  }

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
    actorId: organizer.userId,
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
    supabase.from("shift_assignments").select("id").eq("shift_id", shiftRow.id).in("status", [...ACTIVE_ASSIGNMENT_STATUSES]),
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
      .in("status", [...ACTIVE_ASSIGNMENT_STATUSES]),
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

  if (check.status === "blocked") {
    return fail(check.reason);
  }

  // STUB(agent-2): TablesInsert<"shift_assignments"> predates the `origin` column (docs/contracts/
  // requests.md asks for regeneration). Widen locally rather than hand-editing the generated file.
  const insert: TablesInsert<"shift_assignments"> & { origin: "assigned" } = {
    shift_id: shiftRow.id,
    profile_id: parsed.data.profileId,
    coverage_role_id: null,
    assigned_by: organizer.userId,
    status: "draft",
    origin: "assigned",
    published_at: null,
  };
  const { data: assignment, error } = await supabase
    .from("shift_assignments")
    .insert(insert as never)
    .select("id")
    .single();

  if (error || !assignment) {
    return fail("Unable to create the assignment.");
  }

  const assignmentId = (assignment as { id: string }).id;

  await insertAuditLog({
    actorId: organizer.userId,
    eventId: shiftRow.event_id,
    action: "assignment.created",
    entityType: "shift_assignment",
    entityId: assignmentId,
    metadata: { shift_id: shiftRow.id, profile_id: parsed.data.profileId, conflict_check: check as unknown as Json },
  });

  const profileRow = profile as { id: string; full_name: string; email: string; is_active: boolean };
  const { data: eventRow } = await supabase.from("events").select("name,timezone").eq("id", shiftRow.event_id).maybeSingle();
  const eventInfo = eventRow as { name: string; timezone: string } | null;

  if (eventInfo) {
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
  }

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

  const update: TablesUpdate<"shift_assignments"> = { status: "removed" };
  const { error } = await supabase.from("shift_assignments").update(update as never).eq("id", existingRow.id);

  if (error) {
    return fail("Unable to remove the assignment.");
  }

  await insertAuditLog({
    actorId: organizer.userId,
    eventId: existingRow.shifts?.event_id ?? null,
    action: "assignment.removed",
    entityType: "shift_assignment",
    entityId: existingRow.id,
    metadata: { shift_id: existingRow.shift_id },
  });

  const profile = existingRow.profiles;
  const shift = existingRow.shifts;

  if (profile?.email && shift && profile.is_active) {
    const { data: eventRow } = await supabase.from("events").select("name,timezone").eq("id", shift.event_id).maybeSingle();
    const eventInfo = eventRow as { name: string; timezone: string } | null;

    if (eventInfo) {
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
    }
  }

  if (shift) {
    revalidatePath(`/coverage/${shift.event_id}`);
  }

  return { ok: true, data: undefined };
}
