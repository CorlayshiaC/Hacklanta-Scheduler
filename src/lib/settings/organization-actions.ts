"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TablesUpdate } from "@/types/database";

const orgSettingsUpdateSchema = z.object({
  orgName: z.string().trim().min(1, "Organization name is required.").max(120),
  defaultShiftBufferMinutes: z.coerce.number().int().min(0, "Buffer cannot be negative."),
  semesterStartsOn: z.union([z.literal(""), z.string().date()]),
  semesterEndsOn: z.union([z.literal(""), z.string().date()]),
  publicNameDisplay: z.enum(["full_name", "first_name", "initials"]),
});

export async function updateOrgSettingsAction(formData: FormData): Promise<void> {
  // Org-wide settings are an admin capability, not organizer, matching the RLS policy on
  // org_settings (admin only update), see supabase/migrations/20260816130700_org_settings.sql.
  await requireAdmin();

  const parsed = orgSettingsUpdateSchema.safeParse({
    orgName: formData.get("orgName"),
    defaultShiftBufferMinutes: formData.get("defaultShiftBufferMinutes"),
    semesterStartsOn: formData.get("semesterStartsOn") ?? "",
    semesterEndsOn: formData.get("semesterEndsOn") ?? "",
    publicNameDisplay: formData.get("publicNameDisplay"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => issue.message).join(" "));
  }

  const supabase = await createSupabaseServerClient();
  const update: TablesUpdate<"org_settings"> = {
    org_name: parsed.data.orgName,
    default_shift_buffer_minutes: parsed.data.defaultShiftBufferMinutes,
    semester_starts_on: parsed.data.semesterStartsOn === "" ? null : parsed.data.semesterStartsOn,
    semester_ends_on: parsed.data.semesterEndsOn === "" ? null : parsed.data.semesterEndsOn,
    public_name_display: parsed.data.publicNameDisplay,
  };
  const { error } = await supabase.from("org_settings").update(update as never).eq("id", true);

  if (error) {
    throw new Error("Could not save organization settings.");
  }

  revalidatePath("/settings/organization");
}
