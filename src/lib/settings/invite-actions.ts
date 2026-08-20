"use server";

import { requireAdmin, requireAuthenticatedUser } from "@/lib/auth/authorization";
import {
  createInvite,
  getInvitePreview,
  listInvites,
  revokeInvite,
  type InviteRole,
  type InviteSummary,
} from "@/lib/invites/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type { InviteRole, InviteSummary };

/**
 * Server actions for the admin invite panel. The STUB(agent-2) that stood here (an in-memory Map,
 * plus an honest "redemption is Agent 2's endpoint, not implemented") is resolved: the real
 * table-backed implementation lives in src/lib/invites/data.ts and redemption is wired into
 * /join/[token]. These stay as thin "use server" wrappers so the panel and join page keep importing
 * the same names from the same path.
 *
 * requireAdmin() is on each admin action even though the invites RLS policies are already
 * admin-only. That's deliberate: RLS returns an empty set or a policy violation, which reads to a
 * user as "nothing here / unknown error", whereas this redirects. Both layers, same as
 * /settings/roles.
 */

export async function createInviteAction(input: {
  role: InviteRole;
  eventId?: string | null;
  expiresInDays?: number | null;
  maxUses?: number | null;
}): Promise<InviteSummary> {
  await requireAdmin();
  return createInvite(input);
}

export async function listInvitesAction(): Promise<InviteSummary[]> {
  await requireAdmin();
  return listInvites();
}

export async function revokeInviteAction(token: string): Promise<void> {
  await requireAdmin();
  await revokeInvite(token);
}

/**
 * No auth gate: this is what /join/[token] calls to render an invite summary for a visitor who has
 * not signed in yet. It exposes only the role and event scope, and only to someone holding the
 * exact token.
 */
export async function getInviteByTokenAction(token: string): Promise<InviteSummary | null> {
  const preview = await getInvitePreview(token);

  if (!preview) {
    return null;
  }

  // The join screen only ever reads `role` and `eventId`. The remaining InviteSummary fields are
  // admin-panel bookkeeping (how many uses are left, who made it, when) and are deliberately not
  // handed to an unauthenticated caller, so they come back as the neutral "unknown" values rather
  // than the real ones. Kept on the same return type so the panel and the join page share one
  // shape; if the join screen ever needs to show real usage counts, that needs a policy decision
  // first, not a wider select.
  return {
    token,
    role: preview.role,
    eventId: preview.eventId,
    expiresAt: null,
    maxUses: null,
    usedCount: 0,
    createdAt: "",
  };
}

/**
 * The join flow's "set your display name" step, scoped to that one field rather than reusing
 * updateProfileAction (Settings > Profile), which also requires a timezone this screen has no reason
 * to ask a brand-new member for on their very first screen. Does not touch role or is_active: those
 * are redeem_invite()'s, and only its.
 */
export async function completeJoinWelcomeAction(fullName: string): Promise<void> {
  const { user } = await requireAuthenticatedUser();
  const trimmed = fullName.trim();

  if (!trimmed) {
    throw new Error("Enter a display name.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: trimmed } as never)
    .eq("id", user.id);

  if (error) {
    throw new Error("Could not save your name.");
  }
}
