import "server-only";

// Adapts the existing Supabase-backed auth check to the shell's role type. Was a STUB(agent-2)
// mapping every non-admin to "member" while app_role had no organizer value at all;
// 20260816130000_add_organizer_role.sql landed the real organizer value, so this now passes
// organizer/admin through directly. Still a narrow STUB(agent-2): app_role is "admin" |
// "board_member" | "organizer" (the board_member -> member rename is deliberately deferred, see
// that migration's comment), so "board_member" still needs mapping to "member" here until it
// lands. Remove the mapping (not the whole function) once that rename ships.
import { getActiveUserAuthorization } from "@/lib/auth/authorization";
import type { ShellRole } from "@/components/layout/nav-config";

export type ShellSession = { role: ShellRole; userId: string } | null;

export async function getShellSession(): Promise<ShellSession> {
  const authorization = await getActiveUserAuthorization();

  if (!authorization.authorized) {
    return null;
  }

  const role: ShellRole =
    authorization.role === "board_member" ? "member" : authorization.role;

  return { role, userId: authorization.userId };
}
