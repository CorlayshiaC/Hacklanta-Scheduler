"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  coverageRoleMutationInputSchema,
  memberSettingsInputSchema,
  profileUpdateInputSchema,
  readCheckbox,
  readRequiredString,
  validationMessage,
} from "@/lib/admin/member-validation";
import { requireAdmin } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json, TablesInsert, TablesUpdate } from "@/types/database";

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "full_name" | "role" | "is_active"
>;
type CoverageRoleRow = Pick<
  Database["public"]["Tables"]["coverage_roles"]["Row"],
  "id" | "name" | "event_id"
>;
type MemberCoverageRoleRow = Pick<Database["public"]["Tables"]["member_coverage_roles"]["Row"], "id">;

type ActionResult = {
  ok: boolean;
  message: string;
};

function redirectWithResult(result: ActionResult): never {
  const params = new URLSearchParams({
    result: result.ok ? "success" : "error",
    message: result.message,
  });

  redirect(`/admin/members?${params.toString()}`);
}

function diffProfileChanges(
  current: { full_name: string; role: string; is_active: boolean },
  next: { fullName: string; role: string; isActive: boolean },
) {
  const changes: Record<string, { from: string | boolean; to: string | boolean }> = {};

  if (current.full_name !== next.fullName) {
    changes.full_name = { from: current.full_name, to: next.fullName };
  }

  if (current.role !== next.role) {
    changes.role = { from: current.role, to: next.role };
  }

  if (current.is_active !== next.isActive) {
    changes.is_active = { from: current.is_active, to: next.isActive };
  }

  return changes;
}

async function insertAuditLog(input: {
  actorId: string;
  eventId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Json;
}) {
  const supabase = await createSupabaseServerClient();
  const auditInsert: TablesInsert<"audit_log"> = {
    actor_id: input.actorId,
    event_id: input.eventId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    metadata: input.metadata,
  };
  const { error } = await supabase.from("audit_log").insert(auditInsert as never);

  if (error) {
    throw new Error("Change saved, but audit logging failed.");
  }
}

export async function updateMemberProfileAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = profileUpdateInputSchema.safeParse({
    profileId: readRequiredString(formData, "profileId"),
    fullName: readRequiredString(formData, "fullName"),
    role: readRequiredString(formData, "role"),
    isActive: readCheckbox(formData, "isActive"),
  });

  if (!parsed.success) {
    redirectWithResult({ ok: false, message: validationMessage(parsed.error) });
  }

  const supabase = await createSupabaseServerClient();
  const { data: currentProfile, error: currentProfileError } = await supabase
    .from("profiles")
    .select("id,full_name,role,is_active")
    .eq("id", parsed.data.profileId)
    .maybeSingle();

  const profile = currentProfile as ProfileRow | null;

  if (currentProfileError || !profile) {
    redirectWithResult({ ok: false, message: "Member profile was not found." });
  }

  const changes = diffProfileChanges(profile, parsed.data);

  if (Object.keys(changes).length === 0) {
    redirectWithResult({ ok: true, message: "No member changes needed." });
  }

  const removingActiveAdmin =
    profile.role === "admin" &&
    profile.is_active &&
    (parsed.data.role !== "admin" || !parsed.data.isActive);

  if (removingActiveAdmin) {
    const { count, error: countError } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("is_active", true);

    if (countError || (count ?? 0) <= 1) {
      redirectWithResult({
        ok: false,
        message: "At least one active admin must remain.",
      });
    }
  }

  const profileUpdate: TablesUpdate<"profiles"> = {
    full_name: parsed.data.fullName,
    role: parsed.data.role,
    is_active: parsed.data.isActive,
  };
  const { error: updateError } = await supabase
    .from("profiles")
    .update(profileUpdate as never)
    .eq("id", parsed.data.profileId);

  if (updateError) {
    redirectWithResult({ ok: false, message: "Unable to update member profile." });
  }

  await insertAuditLog({
    actorId: admin.userId,
    action: "member.profile_updated",
    entityType: "profile",
    entityId: parsed.data.profileId,
    metadata: { changes },
  });

  revalidatePath("/admin/members");
  redirectWithResult({ ok: true, message: "Member profile updated." });
}

export async function assignCoverageRoleAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = coverageRoleMutationInputSchema.safeParse({
    profileId: readRequiredString(formData, "profileId"),
    eventId: readRequiredString(formData, "eventId"),
    coverageRoleId: readRequiredString(formData, "coverageRoleId"),
  });

  if (!parsed.success) {
    redirectWithResult({ ok: false, message: validationMessage(parsed.error) });
  }

  const supabase = await createSupabaseServerClient();
  const { data: coverageRole, error: roleError } = await supabase
    .from("coverage_roles")
    .select("id,name,event_id")
    .eq("id", parsed.data.coverageRoleId)
    .eq("event_id", parsed.data.eventId)
    .maybeSingle();

  const role = coverageRole as CoverageRoleRow | null;

  if (roleError || !role) {
    redirectWithResult({ ok: false, message: "Coverage role was not found for this event." });
  }

  const memberCoverageRoleInsert: TablesInsert<"member_coverage_roles"> = {
    event_id: parsed.data.eventId,
    profile_id: parsed.data.profileId,
    coverage_role_id: parsed.data.coverageRoleId,
  };
  const { error } = await supabase
    .from("member_coverage_roles")
    .insert(memberCoverageRoleInsert as never);

  if (error) {
    const isDuplicate = error.code === "23505";
    redirectWithResult({
      ok: false,
      message: isDuplicate ? "Member already has that coverage role." : "Unable to assign role.",
    });
  }

  await insertAuditLog({
    actorId: admin.userId,
    eventId: parsed.data.eventId,
    action: "member.coverage_role_assigned",
    entityType: "member_coverage_role",
    entityId: parsed.data.profileId,
    metadata: {
      profile_id: parsed.data.profileId,
      coverage_role_id: parsed.data.coverageRoleId,
      coverage_role_name: role.name,
    },
  });

  revalidatePath("/admin/members");
  redirectWithResult({ ok: true, message: "Coverage role assigned." });
}

export async function removeCoverageRoleAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = coverageRoleMutationInputSchema.safeParse({
    profileId: readRequiredString(formData, "profileId"),
    eventId: readRequiredString(formData, "eventId"),
    coverageRoleId: readRequiredString(formData, "coverageRoleId"),
  });

  if (!parsed.success) {
    redirectWithResult({ ok: false, message: validationMessage(parsed.error) });
  }

  const supabase = await createSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase
    .from("member_coverage_roles")
    .select("id")
    .eq("event_id", parsed.data.eventId)
    .eq("profile_id", parsed.data.profileId)
    .eq("coverage_role_id", parsed.data.coverageRoleId)
    .maybeSingle();

  const existingRole = existing as MemberCoverageRoleRow | null;

  if (existingError || !existingRole) {
    redirectWithResult({ ok: false, message: "Assigned coverage role was not found." });
  }

  const { error } = await supabase.from("member_coverage_roles").delete().eq("id", existingRole.id);

  if (error) {
    redirectWithResult({ ok: false, message: "Unable to remove coverage role." });
  }

  await insertAuditLog({
    actorId: admin.userId,
    eventId: parsed.data.eventId,
    action: "member.coverage_role_removed",
    entityType: "member_coverage_role",
    entityId: existingRole.id,
    metadata: {
      profile_id: parsed.data.profileId,
      coverage_role_id: parsed.data.coverageRoleId,
    },
  });

  revalidatePath("/admin/members");
  redirectWithResult({ ok: true, message: "Coverage role removed." });
}

export async function updateMemberSettingsAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = memberSettingsInputSchema.safeParse({
    profileId: readRequiredString(formData, "profileId"),
    eventId: readRequiredString(formData, "eventId"),
    maxHours: readRequiredString(formData, "maxHours"),
    minimumBreakMinutes: readRequiredString(formData, "minimumBreakMinutes"),
  });

  if (!parsed.success) {
    redirectWithResult({ ok: false, message: validationMessage(parsed.error) });
  }

  const supabase = await createSupabaseServerClient();
  const { data: currentSettings } = await supabase
    .from("member_settings")
    .select("max_hours,minimum_break_minutes")
    .eq("event_id", parsed.data.eventId)
    .eq("profile_id", parsed.data.profileId)
    .maybeSingle();

  const memberSettingsInsert: TablesInsert<"member_settings"> = {
    event_id: parsed.data.eventId,
    profile_id: parsed.data.profileId,
    max_hours: parsed.data.maxHours,
    minimum_break_minutes: parsed.data.minimumBreakMinutes,
  };
  const { error } = await supabase
    .from("member_settings")
    .upsert(memberSettingsInsert as never, { onConflict: "event_id,profile_id" });

  if (error) {
    redirectWithResult({ ok: false, message: "Unable to update work constraints." });
  }

  await insertAuditLog({
    actorId: admin.userId,
    eventId: parsed.data.eventId,
    action: "member.settings_updated",
    entityType: "member_settings",
    entityId: parsed.data.profileId,
    metadata: {
      before: currentSettings ?? null,
      after: {
        max_hours: parsed.data.maxHours,
        minimum_break_minutes: parsed.data.minimumBreakMinutes,
      },
    },
  });

  revalidatePath("/admin/members");
  redirectWithResult({ ok: true, message: "Work constraints updated." });
}
