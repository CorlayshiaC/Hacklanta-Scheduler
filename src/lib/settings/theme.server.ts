import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DEFAULT_PROFILE_THEME,
  parseProfileTheme,
  type ProfileTheme,
} from "@/lib/settings/theme";

/**
 * The signed-in member's stored theme, for stamping `data-theme` on the server during the first
 * render. Agent 1's toggle owns everything after that (client state plus the write action); this is
 * only the initial value, and it exists so a member who opted into light never sees a dark flash.
 *
 * Signed out, missing profile row, or a read error all resolve to the default instead of throwing.
 * This is called from a root layout that also renders public pages (sign-in, /join, public schedule
 * links), where "no session" is the normal case, not an error, and where a failed theme read must
 * never take down the page.
 *
 * Naming follows src/lib/env.server.ts: the ".server" suffix marks a module that must not reach a
 * client bundle. Import the type and constants from "@/lib/settings/theme" instead from a client
 * component.
 */
export async function getProfileTheme(): Promise<ProfileTheme> {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return DEFAULT_PROFILE_THEME;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("theme")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      return DEFAULT_PROFILE_THEME;
    }

    // Same select-string inference workaround the rest of the codebase uses for this client (see
    // src/lib/auth/authorization.ts): the generated types don't resolve this select() to a concrete
    // row type, so the response is cast to the shape actually requested.
    const row = data as { theme: string | null } | null;
    return parseProfileTheme(row?.theme);
  } catch {
    return DEFAULT_PROFILE_THEME;
  }
}
