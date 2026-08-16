"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/authorization";
import { getScheduleReviewData } from "@/lib/admin/schedule/review";
import { sendScheduleNotification } from "@/lib/notifications/service";
import { scheduleNotificationEvents } from "@/lib/notifications/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ScheduleReviewAssignment, ReviewShift } from "@/lib/admin/schedule/review";
import type { Json, TablesInsert, TablesUpdate } from "@/types/database";

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function redirectWithResult(ok: boolean, message: string): never {
  redirect(`/admin/schedule/review?result=${ok ? "success" : "error"}&message=${encodeURIComponent(message)}`);
}

async function insertAuditLog(input: {
  action: string;
  actorId: string;
  entityId?: string | null;
  eventId: string;
  metadata: Json;
}) {
  const supabase = await createSupabaseServerClient();
  const insert: TablesInsert<"audit_log"> = {
    action: input.action,
    actor_id: input.actorId,
    entity_id: input.entityId ?? null,
    entity_type: "schedule_publication",
    event_id: input.eventId,
    metadata: input.metadata,
  };
  const { error } = await supabase.from("audit_log").insert(insert as never);

  if (error) {
    throw new Error("Audit logging failed.");
  }
}

function notificationRecipientFromAssignment(assignment: ScheduleReviewAssignment) {
  const profile = assignment.profiles;

  if (!profile?.email) {
    return null;
  }

  return {
    email: profile.email,
    fullName: profile.full_name,
    id: profile.id,
    isActive: profile.is_active,
  };
}

async function notifyPublishedAssignments(input: {
  assignments: ScheduleReviewAssignment[];
  eventName: string;
  shifts: ReviewShift[];
  timezone: string;
}) {
  const shiftsById = new Map(input.shifts.map((shift) => [shift.id, shift]));
  const assignmentsByProfile = new Map<string, ScheduleReviewAssignment>();

  for (const assignment of input.assignments) {
    if (!shiftsById.has(assignment.shift_id)) {
      continue;
    }
    assignmentsByProfile.set(assignment.profile_id, assignment);
  }

  const results = await Promise.all(
    Array.from(assignmentsByProfile.values()).map((assignment) => {
      const recipient = notificationRecipientFromAssignment(assignment);

      if (!recipient) {
        return Promise.resolve(null);
      }

      return sendScheduleNotification({
        eventName: input.eventName,
        eventType: scheduleNotificationEvents.schedulePublished,
        recipient,
        timezone: input.timezone,
      });
    }),
  );

  for (const result of results) {
    if (result && !result.ok) {
      console.warn("Schedule publication notification was not delivered.", {
        status: result.status,
        message: result.message,
      });
    }
  }
}

export async function publishScheduleAction(formData: FormData) {
  const admin = await requireAdmin();
  const confirmation = readString(formData, "publishConfirmation");

  if (confirmation !== "publish-hacklanta-ii") {
    redirectWithResult(false, "Confirm publication before publishing.");
  }

  const review = await getScheduleReviewData();
  const blockers = review.issues.filter((issue) => issue.severity === "blocker");
  const warnings = review.issues.filter((issue) => issue.severity === "warning");

  await insertAuditLog({
    action: "schedule.publication_attempted",
    actorId: admin.userId,
    eventId: review.event.id,
    metadata: {
      blocker_count: blockers.length,
      draft_assignment_count: review.draftAssignments.length,
      warning_count: warnings.length,
    },
  });

  if (review.alreadyPublished) {
    redirectWithResult(false, "Schedule is already published. Republishing is a future phase.");
  }

  if (blockers.length > 0) {
    redirectWithResult(false, "Resolve hard blockers before publishing.");
  }

  const publishedAt = new Date().toISOString();
  const draftAssignmentIds = review.draftAssignments.map((assignment) => assignment.id);
  const supabase = await createSupabaseServerClient();

  if (draftAssignmentIds.length > 0) {
    const update: TablesUpdate<"shift_assignments"> = {
      published_at: publishedAt,
      status: "published",
    };
    const { error: updateError } = await supabase
      .from("shift_assignments")
      .update(update as never)
      .in("id", draftAssignmentIds);

    if (updateError) {
      redirectWithResult(false, "Unable to publish draft assignments.");
    }
  }

  const publicationInsert: TablesInsert<"schedule_publications"> = {
    event_id: review.event.id,
    notes:
      warnings.length > 0
        ? `Published with ${warnings.length} warning${warnings.length === 1 ? "" : "s"}.`
        : "Published with no readiness warnings.",
    published_at: publishedAt,
    published_by: admin.userId,
  };
  const { data: publication, error: publicationError } = await supabase
    .from("schedule_publications")
    .insert(publicationInsert as never)
    .select("*")
    .single();

  if (publicationError || !publication) {
    redirectWithResult(false, "Assignments were updated, but publication record could not be saved.");
  }
  const publicationRow = publication as { id: string };

  await insertAuditLog({
    action: "schedule.published",
    actorId: admin.userId,
    entityId: publicationRow.id,
    eventId: review.event.id,
    metadata: {
      assignment_count: draftAssignmentIds.length,
      published_at: publishedAt,
      warning_count: warnings.length,
    },
  });

  await notifyPublishedAssignments({
    assignments: review.draftAssignments,
    eventName: review.event.name,
    shifts: review.shifts,
    timezone: review.event.timezone,
  });

  revalidatePath("/admin/schedule");
  revalidatePath("/admin/schedule/review");
  revalidatePath("/my-schedule");
  redirectWithResult(true, "Schedule published.");
}
