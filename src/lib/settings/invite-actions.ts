"use server";

import { randomBytes } from "crypto";
import { requireAdmin, requireAuthenticatedUser } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type InviteRole = "admin" | "director" | "member";

export interface InviteSummary {
  token: string;
  role: InviteRole;
  eventId: string | null;
  expiresAt: string | null;
  maxUses: number | null;
  usedCount: number;
  createdAt: string;
}

// STUB(agent-2): no `invites` table yet (V2 brief item 5, "Invite links"), see
// docs/contracts/schema-requests.md. Backed by an in-memory Map so the admin panel and /join/
// [token] flow are real and testable end-to-end in a single dev server process; resets on
// redeploy/restart and does not survive across serverless instances, exactly the same tradeoff
// V1's share_tokens stub accepted before that table landed. Redemption (actually granting a role)
// is intentionally NOT implemented here even as a stub: that is Agent 2's endpoint per the V2
// brief ("Redemption endpoint assigns role ... on first Google sign-in"), inventing a fake role
// grant here would be a worse outcome than an honest "not wired up yet" state on /join/[token].
declare global {
  var __progsuInviteStore: Map<string, InviteSummary> | undefined;
}

const store = globalThis.__progsuInviteStore ?? new Map<string, InviteSummary>();
globalThis.__progsuInviteStore = store;

export async function createInviteAction(input: {
  role: InviteRole;
  eventId?: string | null;
  expiresInDays?: number | null;
  maxUses?: number | null;
}): Promise<InviteSummary> {
  await requireAdmin();

  const token = randomBytes(16).toString("base64url");
  const invite: InviteSummary = {
    token,
    role: input.role,
    eventId: input.role === "director" ? (input.eventId ?? null) : null,
    expiresAt:
      input.expiresInDays && input.expiresInDays > 0
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null,
    maxUses: input.maxUses && input.maxUses > 0 ? input.maxUses : null,
    usedCount: 0,
    createdAt: new Date().toISOString(),
  };

  store.set(token, invite);
  return invite;
}

export async function listInvitesAction(): Promise<InviteSummary[]> {
  await requireAdmin();
  return Array.from(store.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function revokeInviteAction(token: string): Promise<void> {
  await requireAdmin();
  store.delete(token);
}

function isInviteUsable(invite: InviteSummary): boolean {
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
    return false;
  }
  if (invite.maxUses !== null && invite.usedCount >= invite.maxUses) {
    return false;
  }
  return true;
}

// No auth required: this is what /join/[token] calls to render an unauthenticated invite
// summary, same "public token lookup, no admin gate" shape as Agent 5's own share_tokens flow.
export async function getInviteByTokenAction(token: string): Promise<InviteSummary | null> {
  const invite = store.get(token);
  if (!invite || !isInviteUsable(invite)) {
    return null;
  }
  return invite;
}

// The join flow's second step ("set your display name"), scoped to just that one field rather
// than reusing updateProfileAction (Settings > Profile), which also requires a timezone this
// screen has no reason to ask a brand-new member for on their very first screen. Does NOT grant
// the invite's role: that write belongs to Agent 2's redemption endpoint (see the module doc
// comment above), this only ever touches profiles.full_name.
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
