import "server-only";

import { requireRole } from "@/lib/auth/authorization";

/**
 * Shared organizer-or-admin gate for every organizer surface (page-level read gating in
 * `app/(app)/events|coverage|calendar`, mutation gating in `lib/scheduling/actions.ts`). Delegates
 * to lib/auth/authorization.ts's ranked requireRole() instead of its own role comparison, so there
 * is exactly one place that decides who counts as organizer-or-above and the two can't drift
 * (flagged in requests.md: this file used to hardcode `role !== "organizer" && role !== "admin"`).
 */
export async function requireOrganizer(): Promise<{ userId: string }> {
  const context = await requireRole("organizer");
  return { userId: context.user.id };
}
