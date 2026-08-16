"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/authorization";
import { getHackLantaIIEventForAdmin } from "@/lib/admin/shifts/data";
import {
  parseRoleRequirements,
  parseShiftFormInput,
  validateShiftInsideEvent,
} from "@/lib/scheduling/shift-validation";
import { recommendCandidates, type CandidateInput } from "@/lib/scheduling/recommendations";
import { sendScheduleNotification } from "@/lib/notifications/service";
import { scheduleNotificationEvents, type NotificationDeliveryResult } from "@/lib/notifications/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json, TablesInsert, TablesUpdate } from "@/types/database";

type CoverageRoleRow = Database["public"]["Tables"]["coverage_roles"]["Row"];
type ShiftRow = Database["public"]["Tables"]["shifts"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type MemberSettingsRow = Database["public"]["Tables"]["member_settings"]["Row"];
type AvailabilityRow = Database["public"]["Tables"]["availability_windows"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["shift_assignments"]["Row"];
type MemberCoverageRoleRow = Database["public"]["Tables"]["member_coverage_roles"]["Row"];

type AssignmentNotificationJoin = AssignmentRow & {
  coverage_roles?: Pick<CoverageRoleRow, "id" | "name"> | null;
  profiles?: Pick<ProfileRow, "id" | "full_name" | "email" | "is_active"> | null;
  shifts?: Pick<ShiftRow, "id" | "event_id" | "title" | "starts_at" | "ends_at" | "location"> | null;
};

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getReturnPath(formData?: FormData) {
  const returnTo = formData ? readString(formData, "returnTo") : "";
  return returnTo === "/admin/schedule" ? "/admin/schedule" : "/admin/shifts";
}

function redirectWithResult(
  ok: boolean,
  message: string,
  shiftId?: string,
  returnPath = "/admin/shifts",
): never {
  const params = new URLSearchParams({ result: ok ? "success" : "error", message });
  if (shiftId) {
    params.set("shift", shiftId);
  }
  redirect(`${returnPath}?${params.toString()}`);
}

async function insertAuditLog(input: {
  actorId: string;
  eventId: string;
  action: string;
  entityType: string;
  entityId: string;
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
    throw new Error("Change saved, but audit logging failed.");
  }
}

function logNotificationResult(result: NotificationDeliveryResult, context: Record<string, string>) {
  if (result.ok) {
    return;
  }

  console.warn("Schedule notification was not delivered.", {
    ...context,
    message: result.message,
    status: result.status,
  });
}

async function notifyAssignmentChange(input: {
  assignment: AssignmentNotificationJoin;
  eventName: string;
  eventType: typeof scheduleNotificationEvents.assignmentAdded | typeof scheduleNotificationEvents.assignmentChanged | typeof scheduleNotificationEvents.assignmentRemoved;
  timezone: string;
}) {
  const profile = input.assignment.profiles;
  const shift = input.assignment.shifts;

  if (!profile?.email || !shift || !profile.is_active) {
    return;
  }

  const result = await sendScheduleNotification({
    eventName: input.eventName,
    eventType: input.eventType,
    recipient: {
      email: profile.email,
      fullName: profile.full_name,
      id: profile.id,
      isActive: profile.is_active,
    },
    shift: {
      coverageRoleName: input.assignment.coverage_roles?.name ?? null,
      endsAt: shift.ends_at,
      location: shift.location,
      startsAt: shift.starts_at,
      status: input.assignment.status === "published" ? "published" : "draft",
      title: shift.title,
    },
    timezone: input.timezone,
  });

  logNotificationResult(result, {
    assignmentId: input.assignment.id,
    eventType: input.eventType,
    profileId: profile.id,
  });
}

async function getCoverageRolesForEvent(eventId: string, returnPath: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("coverage_roles").select("*").eq("event_id", eventId);

  if (error) {
    redirectWithResult(false, "Unable to load coverage roles.", undefined, returnPath);
  }

  return (data ?? []) as CoverageRoleRow[];
}

async function getRoleRequirementsFromForm(formData: FormData, eventId: string, returnPath: string) {
  const coverageRoles = await getCoverageRolesForEvent(eventId, returnPath);
  const validCoverageRoleIds = new Set(coverageRoles.map((role) => role.id));
  const coverageRoleIds = formData
    .getAll("coverageRoleId")
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  const requiredPeopleByRole = Object.fromEntries(
    coverageRoleIds.map((roleId) => [roleId, readString(formData, `roleRequiredPeople:${roleId}`)]),
  );
  const parsed = parseRoleRequirements({ coverageRoleIds, requiredPeopleByRole, validCoverageRoleIds });

  if (!parsed.ok) {
    redirectWithResult(false, parsed.message, undefined, returnPath);
  }

  return parsed.value;
}

async function validateShiftRole(shiftRoleId: string | null, eventId: string, returnPath: string) {
  if (!shiftRoleId) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("shift_roles")
    .select("id")
    .eq("id", shiftRoleId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error || !data) {
    redirectWithResult(false, "Shift type must belong to HackLanta II.", undefined, returnPath);
  }
}

async function parseShiftFormForEvent(formData: FormData) {
  const returnPath = getReturnPath(formData);
  const event = await getHackLantaIIEventForAdmin();
  const parsed = parseShiftFormInput({
    title: readString(formData, "title"),
    shiftRoleId: readString(formData, "shiftRoleId"),
    date: readString(formData, "date"),
    startsAt: readString(formData, "startsAt"),
    endsAt: readString(formData, "endsAt"),
    location: readString(formData, "location"),
    notes: readString(formData, "notes"),
    requiredPeople: readString(formData, "requiredPeople"),
  });

  if (!parsed.ok) {
    redirectWithResult(false, parsed.message, undefined, returnPath);
  }

  const boundaryValidation = validateShiftInsideEvent({
    startsAt: parsed.value.startsAt,
    endsAt: parsed.value.endsAt,
    event,
  });

  if (!boundaryValidation.ok) {
    redirectWithResult(false, boundaryValidation.message, undefined, returnPath);
  }

  await validateShiftRole(parsed.value.shiftRoleId, event.id, returnPath);
  const requirements = await getRoleRequirementsFromForm(formData, event.id, returnPath);

  return { event, requirements, returnPath, shift: parsed.value };
}

export async function createShiftAction(formData: FormData) {
  const admin = await requireAdmin();
  const { event, shift, requirements, returnPath } = await parseShiftFormForEvent(formData);
  const supabase = await createSupabaseServerClient();
  const insert: TablesInsert<"shifts"> = {
    event_id: event.id,
    shift_role_id: shift.shiftRoleId,
    title: shift.title,
    starts_at: shift.startsAt,
    ends_at: shift.endsAt,
    required_people: shift.requiredPeople,
    location: shift.location,
    notes: shift.notes,
  };
  const { data: createdShift, error } = await supabase
    .from("shifts")
    .insert(insert as never)
    .select("*")
    .single();

  if (error || !createdShift) {
    redirectWithResult(false, "Unable to create shift.", undefined, returnPath);
  }

  const shiftRow = createdShift as ShiftRow;
  if (requirements.length > 0) {
    const requirementInserts: TablesInsert<"shift_role_requirements">[] = requirements.map(
      (requirement) => ({
        shift_id: shiftRow.id,
        coverage_role_id: requirement.coverageRoleId,
        required_people: requirement.requiredPeople,
      }),
    );
    const { error: requirementError } = await supabase
      .from("shift_role_requirements")
      .insert(requirementInserts as never);

    if (requirementError) {
      redirectWithResult(
        false,
        "Shift created, but role requirements could not be saved.",
        shiftRow.id,
        returnPath,
      );
    }
  }

  await insertAuditLog({
    actorId: admin.userId,
    eventId: event.id,
    action: "shift.created",
    entityType: "shift",
    entityId: shiftRow.id,
    metadata: { title: shift.title, requirements },
  });

  revalidatePath("/admin/shifts");
  revalidatePath("/admin/schedule");
  redirectWithResult(true, "Shift created.", shiftRow.id, returnPath);
}

export async function updateShiftAction(formData: FormData) {
  const admin = await requireAdmin();
  const shiftId = readString(formData, "shiftId");
  const { event, shift, requirements, returnPath } = await parseShiftFormForEvent(formData);
  const supabase = await createSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase
    .from("shifts")
    .select("*")
    .eq("id", shiftId)
    .eq("event_id", event.id)
    .maybeSingle();

  if (existingError || !existing) {
    redirectWithResult(false, "Shift was not found.", undefined, returnPath);
  }

  const update: TablesUpdate<"shifts"> = {
    shift_role_id: shift.shiftRoleId,
    title: shift.title,
    starts_at: shift.startsAt,
    ends_at: shift.endsAt,
    required_people: shift.requiredPeople,
    location: shift.location,
    notes: shift.notes,
  };
  const { error } = await supabase.from("shifts").update(update as never).eq("id", shiftId);

  if (error) {
    redirectWithResult(false, "Unable to update shift.", shiftId, returnPath);
  }

  await supabase.from("shift_role_requirements").delete().eq("shift_id", shiftId);

  if (requirements.length > 0) {
    const requirementInserts: TablesInsert<"shift_role_requirements">[] = requirements.map(
      (requirement) => ({
        shift_id: shiftId,
        coverage_role_id: requirement.coverageRoleId,
        required_people: requirement.requiredPeople,
      }),
    );
    const { error: requirementError } = await supabase
      .from("shift_role_requirements")
      .insert(requirementInserts as never);

    if (requirementError) {
      redirectWithResult(false, "Unable to update role requirements.", shiftId, returnPath);
    }
  }

  await insertAuditLog({
    actorId: admin.userId,
    eventId: event.id,
    action: "shift.updated",
    entityType: "shift",
    entityId: shiftId,
    metadata: { before: existing as Json, after: { ...shift, requirements } },
  });

  revalidatePath("/admin/shifts");
  revalidatePath("/admin/schedule");
  redirectWithResult(true, "Shift updated.", shiftId, returnPath);
}

export async function removeShiftAction(formData: FormData) {
  const admin = await requireAdmin();
  const event = await getHackLantaIIEventForAdmin();
  const returnPath = getReturnPath(formData);
  const shiftId = readString(formData, "shiftId");
  const supabase = await createSupabaseServerClient();
  const { count, error: countError } = await supabase
    .from("shift_assignments")
    .select("id", { count: "exact", head: true })
    .eq("shift_id", shiftId)
    .in("status", ["draft", "published"]);

  if (countError) {
    redirectWithResult(false, "Unable to verify shift assignments.", shiftId, returnPath);
  }

  if ((count ?? 0) > 0) {
    redirectWithResult(false, "Remove active assignments before deleting this shift.", shiftId, returnPath);
  }

  const { error } = await supabase.from("shifts").delete().eq("id", shiftId).eq("event_id", event.id);

  if (error) {
    redirectWithResult(false, "Unable to remove shift.", shiftId, returnPath);
  }

  await insertAuditLog({
    actorId: admin.userId,
    eventId: event.id,
    action: "shift.removed",
    entityType: "shift",
    entityId: shiftId,
    metadata: {},
  });

  revalidatePath("/admin/shifts");
  revalidatePath("/admin/schedule");
  redirectWithResult(true, "Shift removed.", undefined, returnPath);
}

async function buildCandidatesForShift(shift: ShiftRow, eventId: string): Promise<CandidateInput[]> {
  const supabase = await createSupabaseServerClient();
  const [
    { data: profiles },
    { data: memberCoverageRoles },
    { data: memberSettings },
    { data: availabilityWindows },
    { data: assignments },
    { data: shifts },
  ] = await Promise.all([
    supabase.from("profiles").select("*"),
    supabase.from("member_coverage_roles").select("*").eq("event_id", eventId),
    supabase.from("member_settings").select("*").eq("event_id", eventId),
    supabase.from("availability_windows").select("*").eq("event_id", eventId).eq("status", "available"),
    supabase.from("shift_assignments").select("*").in("status", ["draft", "published"]),
    supabase.from("shifts").select("*").eq("event_id", eventId),
  ]);
  const settingsByProfile = new Map(
    ((memberSettings ?? []) as MemberSettingsRow[]).map((settings) => [settings.profile_id, settings]),
  );
  const rolesByProfile = new Map<string, string[]>();
  for (const row of (memberCoverageRoles ?? []) as MemberCoverageRoleRow[]) {
    const roles = rolesByProfile.get(row.profile_id) ?? [];
    roles.push(row.coverage_role_id);
    rolesByProfile.set(row.profile_id, roles);
  }
  const availabilityByProfile = new Map<string, AvailabilityRow[]>();
  for (const window of (availabilityWindows ?? []) as AvailabilityRow[]) {
    const rows = availabilityByProfile.get(window.profile_id) ?? [];
    rows.push(window);
    availabilityByProfile.set(window.profile_id, rows);
  }
  const shiftById = new Map(((shifts ?? []) as ShiftRow[]).map((row) => [row.id, row]));
  const assignmentsByProfile = new Map<string, CandidateInput["assignments"]>();
  for (const assignment of (assignments ?? []) as AssignmentRow[]) {
    const assignedShift = shiftById.get(assignment.shift_id);
    if (!assignedShift) {
      continue;
    }
    const rows = assignmentsByProfile.get(assignment.profile_id) ?? [];
    rows.push({
      id: assignment.id,
      profileId: assignment.profile_id,
      shiftId: assignment.shift_id,
      startsAt: assignedShift.starts_at,
      endsAt: assignedShift.ends_at,
      status: assignment.status,
    });
    assignmentsByProfile.set(assignment.profile_id, rows);
  }

  return ((profiles ?? []) as ProfileRow[]).map((profile) => {
    const settings = settingsByProfile.get(profile.id);
    return {
      profile: {
        id: profile.id,
        fullName: profile.full_name,
        email: profile.email,
        isActive: profile.is_active,
      },
      coverageRoleIds: rolesByProfile.get(profile.id) ?? [],
      settings: settings
        ? { maxHours: Number(settings.max_hours), minimumBreakMinutes: settings.minimum_break_minutes }
        : null,
      availabilityWindows: (availabilityByProfile.get(profile.id) ?? []).map((window) => ({
        profileId: window.profile_id,
        startsAt: window.starts_at,
        endsAt: window.ends_at,
      })),
      assignments: assignmentsByProfile.get(profile.id) ?? [],
    };
  });
}

export async function assignShiftCandidateAction(formData: FormData) {
  const admin = await requireAdmin();
  const event = await getHackLantaIIEventForAdmin();
  const returnPath = getReturnPath(formData);
  const shiftId = readString(formData, "shiftId");
  const profileId = readString(formData, "profileId");
  const coverageRoleId = readString(formData, "coverageRoleId") || null;
  const topRecommendedProfileId = readString(formData, "topRecommendedProfileId") || null;
  const supabase = await createSupabaseServerClient();
  const { data: shift, error: shiftError } = await supabase
    .from("shifts")
    .select("*")
    .eq("id", shiftId)
    .eq("event_id", event.id)
    .maybeSingle();

  if (shiftError || !shift) {
    redirectWithResult(false, "Shift was not found.", undefined, returnPath);
  }

  let coverageRoleName: string | null = null;
  if (coverageRoleId) {
    const { data: role } = await supabase
      .from("coverage_roles")
      .select("id,name")
      .eq("id", coverageRoleId)
      .eq("event_id", event.id)
      .maybeSingle();
    if (!role) {
      redirectWithResult(false, "Coverage role must belong to HackLanta II.", shiftId, returnPath);
    }
    coverageRoleName = (role as Pick<CoverageRoleRow, "name">).name;
  }

  const candidates = await buildCandidatesForShift(shift as ShiftRow, event.id);
  const ranked = recommendCandidates({
    shift: { id: shiftId, startsAt: (shift as ShiftRow).starts_at, endsAt: (shift as ShiftRow).ends_at },
    coverageRoleId,
    candidates,
  });
  const selected = ranked.recommendations.find((candidate) => candidate.profileId === profileId);

  if (!selected) {
    redirectWithResult(
      false,
      "That member is not currently eligible for this assignment.",
      shiftId,
      returnPath,
    );
  }

  const insert: TablesInsert<"shift_assignments"> = {
    shift_id: shiftId,
    profile_id: profileId,
    coverage_role_id: coverageRoleId,
    assigned_by: admin.userId,
    status: "draft",
    published_at: null,
  };
  const { data: assignment, error } = await supabase
    .from("shift_assignments")
    .insert(insert as never)
    .select("*")
    .single();

  if (error || !assignment) {
    redirectWithResult(false, "Unable to create draft assignment.", shiftId, returnPath);
  }

  const assignmentRow = assignment as AssignmentRow;
  const isManualSelection = topRecommendedProfileId !== null && topRecommendedProfileId !== profileId;
  await insertAuditLog({
    actorId: admin.userId,
    eventId: event.id,
    action: isManualSelection ? "assignment.manual_selection" : "assignment.created",
    entityType: "shift_assignment",
    entityId: assignmentRow.id,
    metadata: {
      shift_id: shiftId,
      profile_id: profileId,
      coverage_role_id: coverageRoleId,
      top_recommended_profile_id: topRecommendedProfileId,
      selected_rank: ranked.recommendations.findIndex((candidate) => candidate.profileId === profileId) + 1,
    },
  });

  await notifyAssignmentChange({
    assignment: {
      ...assignmentRow,
      coverage_roles: coverageRoleId ? { id: coverageRoleId, name: coverageRoleName ?? "Coverage role" } : null,
      profiles: {
        id: selected.profileId,
        full_name: selected.fullName,
        email: selected.email,
        is_active: true,
      },
      shifts: {
        id: (shift as ShiftRow).id,
        event_id: (shift as ShiftRow).event_id,
        title: (shift as ShiftRow).title,
        starts_at: (shift as ShiftRow).starts_at,
        ends_at: (shift as ShiftRow).ends_at,
        location: (shift as ShiftRow).location,
      },
    },
    eventName: event.name,
    eventType: scheduleNotificationEvents.assignmentAdded,
    timezone: event.timezone,
  });

  revalidatePath("/admin/shifts");
  revalidatePath("/admin/schedule");
  redirectWithResult(true, "Draft assignment created.", shiftId, returnPath);
}

export async function removeShiftAssignmentAction(formData: FormData) {
  const admin = await requireAdmin();
  const event = await getHackLantaIIEventForAdmin();
  const returnPath = getReturnPath(formData);
  const assignmentId = readString(formData, "assignmentId");
  const shiftId = readString(formData, "shiftId");
  const supabase = await createSupabaseServerClient();
  const { data: existingAssignment, error: existingAssignmentError } = await supabase
    .from("shift_assignments")
    .select(
      "*,profiles!shift_assignments_profile_id_fkey(id,full_name,email,is_active),coverage_roles(id,name),shifts!shift_assignments_shift_id_fkey(id,event_id,title,starts_at,ends_at,location)",
    )
    .eq("id", assignmentId)
    .eq("shift_id", shiftId)
    .maybeSingle();
  const assignmentBeforeRemoval = existingAssignment as unknown as AssignmentNotificationJoin | null;

  if (
    existingAssignmentError
    || !assignmentBeforeRemoval
    || assignmentBeforeRemoval.shifts?.event_id !== event.id
  ) {
    redirectWithResult(false, "Shift was not found.", shiftId, returnPath);
  }

  const update: TablesUpdate<"shift_assignments"> = { status: "removed" };
  const { data, error } = await supabase
    .from("shift_assignments")
    .update(update as never)
    .eq("id", assignmentId)
    .eq("shift_id", shiftId)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    redirectWithResult(false, "Unable to remove assignment.", shiftId, returnPath);
  }

  await insertAuditLog({
    actorId: admin.userId,
    eventId: event.id,
    action: "assignment.removed",
    entityType: "shift_assignment",
    entityId: assignmentId,
    metadata: { shift_id: shiftId },
  });

  if (
    assignmentBeforeRemoval.status === "draft"
    || assignmentBeforeRemoval.status === "published"
  ) {
    await notifyAssignmentChange({
      assignment: assignmentBeforeRemoval,
      eventName: event.name,
      eventType: scheduleNotificationEvents.assignmentRemoved,
      timezone: event.timezone,
    });
  }

  revalidatePath("/admin/shifts");
  revalidatePath("/admin/schedule");
  redirectWithResult(true, "Assignment removed.", shiftId, returnPath);
}
