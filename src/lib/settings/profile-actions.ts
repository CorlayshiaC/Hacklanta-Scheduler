"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TablesUpdate } from "@/types/database";

const profileUpdateSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Full name is required.")
    .max(120, "Full name must be 120 characters or fewer."),
  timezone: z.string().trim().min(1, "Timezone is required.").max(80),
  // Empty string means "no avatar set".
  avatarUrl: z.union([z.literal(""), z.string().trim().url("Enter a valid URL.")]),
  // Empty string means "leave max hours alone", any other value must coerce to a positive number.
  maxHours: z.union([z.literal(""), z.coerce.number().positive("Max hours must be a positive number.")]),
});

export async function updateProfileAction(formData: FormData): Promise<void> {
  // Re-check auth here, never trust that the layout already gated this: actions can be invoked
  // directly and must not rely on the caller having gone through a page.
  const { user } = await requireAuthenticatedUser();

  const parsed = profileUpdateSchema.safeParse({
    fullName: formData.get("fullName"),
    timezone: formData.get("timezone"),
    avatarUrl: formData.get("avatarUrl") ?? "",
    maxHours: formData.get("maxHours") ?? "",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => issue.message).join(" "));
  }

  const supabase = await createSupabaseServerClient();

  const profileUpdate: TablesUpdate<"profiles"> = {
    full_name: parsed.data.fullName,
    timezone: parsed.data.timezone,
    avatar_url: parsed.data.avatarUrl === "" ? null : parsed.data.avatarUrl,
  };
  const { error: profileError } = await supabase
    .from("profiles")
    .update(profileUpdate as never)
    .eq("id", user.id);

  if (profileError) {
    throw new Error("Could not save profile changes.");
  }

  if (parsed.data.maxHours !== "") {
    // No event id is available on this screen (event resolution is not yet id based, see
    // docs/contracts/schema-requests.md item 4), so this only ever updates an existing
    // member_settings row for this profile. It never inserts a new row here, since a new row
    // would need an event_id this screen has no way to resolve.
    const { data: existingData } = await supabase
      .from("member_settings")
      .select("id")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    // Same select-string inference workaround as src/lib/auth/authorization.ts.
    const existing = existingData as { id: string } | null;

    if (existing) {
      const memberSettingsUpdate: TablesUpdate<"member_settings"> = { max_hours: parsed.data.maxHours };
      const { error: settingsError } = await supabase
        .from("member_settings")
        .update(memberSettingsUpdate as never)
        .eq("id", existing.id);

      if (settingsError) {
        throw new Error("Could not save max hours.");
      }
    }
  }

  revalidatePath("/settings");
}
