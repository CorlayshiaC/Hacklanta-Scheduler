import "server-only";

// Adapts the existing Supabase-backed auth check to the shell's role type.
//
// History: this was a STUB(agent-2) mapping every non-admin to "member" while app_role had no
// organizer value at all; 20260816130000_add_organizer_role.sql landed organizer, then
// 20260817000100_v2_role_model_and_event_directors.sql renamed it again to "director" and dropped
// "board_member"/"organizer" outright, so app_role is now exactly "admin" | "director" | "member",
// the same three values nav-config.ts's ShellRole uses. No mapping needed anymore, this is a plain
// pass-through; kept as a named function rather than inlined so the shell layout doesn't reach into
// @/lib/auth/authorization directly.
import { getActiveUserAuthorization } from "@/lib/auth/authorization";
import type { ShellRole } from "@/components/layout/nav-config";

export type ShellSession = { role: ShellRole; userId: string } | null;

export async function getShellSession(): Promise<ShellSession> {
  const authorization = await getActiveUserAuthorization();

  if (!authorization.authorized) {
    return null;
  }

  return { role: authorization.role, userId: authorization.userId };
}
