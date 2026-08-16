import "server-only";

import { redirect } from "next/navigation";
import { getActiveUserAuthorization } from "@/lib/auth/authorization";

/**
 * Shared organizer-or-admin gate for every organizer surface (page-level read gating in
 * `app/(app)/events|coverage|calendar`, mutation gating in `lib/scheduling/actions.ts`). One
 * place so the two never drift.
 */
export async function requireOrganizer(): Promise<{ userId: string }> {
  const authorization = await getActiveUserAuthorization();

  if (!authorization.authorized) {
    redirect(authorization.userId ? "/my-schedule" : "/sign-in");
  }

  // STUB(agent-2): src/types/database.ts's app_role enum type may still lag the `organizer` value
  // depending on when it was last regenerated. Widen the comparison to a plain string
  // defensively; the enum itself already has the value at the database level (see
  // supabase/migrations/20260816130000_add_organizer_role.sql).
  const role: string = authorization.role;

  if (role !== "organizer" && role !== "admin") {
    redirect("/my-schedule");
  }

  return { userId: authorization.userId };
}
