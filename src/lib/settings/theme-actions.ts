"use server";

import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { profileThemeSchema, type ProfileTheme } from "@/lib/settings/theme";
import type { TablesUpdate } from "@/types/database";

export type UpdateProfileThemeResult = { ok: true } | { ok: false; message: string };

/**
 * Persists the signed-in member's theme choice. Called directly from Agent 1's toggle's click
 * handler (a plain async server action, same pattern as setNotificationPreferenceAction), not
 * through a <form>.
 *
 * Returns a result instead of throwing, unlike the other settings actions here: the toggle applies
 * the theme optimistically on the client and this write is the slow part of that interaction. A
 * failed save should let the toggle put its own state back and say so quietly, not surface an error
 * boundary over a working page.
 *
 * No revalidatePath: the theme lands on the client instantly, and every authenticated render is
 * already dynamic (it reads cookies for auth), so the next server render reads the new value
 * anyway. Invalidating the route tree to repaint something the client already repainted would
 * throw away the whole page's cache for nothing.
 *
 * The zod parse is the boundary check, not a formality: a server action is a public HTTP endpoint,
 * so the argument is untrusted even though the only caller is our own toggle. The database's
 * profiles_theme_valid check constraint is the second line of defense.
 */
export async function updateProfileThemeAction(
  theme: ProfileTheme,
): Promise<UpdateProfileThemeResult> {
  const parsed = profileThemeSchema.safeParse(theme);

  if (!parsed.success) {
    return { ok: false, message: "Unsupported theme." };
  }

  // Re-check auth here rather than trusting that a layout already gated the caller: actions can be
  // invoked directly. RLS (profiles_update_own_or_admin) scopes the write to this row regardless.
  const { user } = await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();

  const update: TablesUpdate<"profiles"> = { theme: parsed.data };
  // Cast matches the established workaround for this client's mutation-argument inference used
  // throughout the codebase (see src/lib/settings/profile-actions.ts): without it, .update()'s
  // argument type collapses to `never`.
  const { error } = await supabase
    .from("profiles")
    .update(update as never)
    .eq("id", user.id);

  if (error) {
    return { ok: false, message: "Could not save your theme." };
  }

  return { ok: true };
}
