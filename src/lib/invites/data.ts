import "server-only";

import { randomBytes } from "crypto";
import { callRpc } from "@/lib/db/rpc";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

/**
 * Invite links, backed by public.invites.
 *
 * This replaces the in-memory `Map` that src/lib/settings/invite-actions.ts held (its own
 * STUB(agent-2) note: "no `invites` table yet ... resets on redeploy/restart and does not survive
 * across serverless instances"). The table has existed since 20260817000500; nothing had moved onto
 * it. That mattered more than it looks: on Vercel every serverless instance would have had its own
 * Map, so an admin could create a link on one instance and the person clicking it would land on
 * another and be told the link was invalid. Invite links are now the only way into the app
 * (20260820000100 lands new signups pending), so "works until the process restarts" stopped being
 * an acceptable stub.
 *
 * Reads and writes go through the RLS-enforced server client, not the service-role client: the
 * admin-only select/insert/update policies from 20260817000500 are the authorization, and the
 * requireAdmin() gate in the calling server actions is defense in depth on top. The two exceptions
 * are the anonymous preview and redemption, which are security-definer RPCs by necessity (an
 * unauthenticated visitor has no select access, and a pending user cannot grant themselves a role).
 */

export type InviteRole = Database["public"]["Enums"]["app_role"];

export interface InviteSummary {
  token: string;
  role: InviteRole;
  eventId: string | null;
  /** Null means the link never expires. */
  expiresAt: string | null;
  /** Null means unlimited uses. */
  maxUses: number | null;
  usedCount: number;
  createdAt: string;
}

export interface InvitePreview {
  role: InviteRole;
  eventId: string | null;
}

type InviteRow = Pick<
  Database["public"]["Tables"]["invites"]["Row"],
  "token" | "role" | "event_id" | "expires_at" | "max_uses" | "used_count" | "created_at"
>;

function toSummary(row: InviteRow): InviteSummary {
  return {
    token: row.token,
    role: row.role,
    eventId: row.event_id,
    expiresAt: row.expires_at,
    maxUses: row.max_uses,
    usedCount: row.used_count,
    createdAt: row.created_at,
  };
}

const SELECT_COLUMNS = "token,role,event_id,expires_at,max_uses,used_count,created_at";

/**
 * 24 bytes, matching the convention public.invites' own schema comment names and share_tokens
 * already uses. The stub generated 16; there is no reason for the token that is now the sole
 * entrance to the application to be the shorter of the two.
 */
function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function listInvites(): Promise<InviteSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("invites")
    .select(SELECT_COLUMNS)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Could not load invite links.");
  }

  return ((data ?? []) as InviteRow[]).map(toSummary);
}

export async function createInvite(input: {
  role: InviteRole;
  eventId?: string | null;
  expiresInDays?: number | null;
  maxUses?: number | null;
}): Promise<InviteSummary> {
  // A director invite carries the event it scopes to; the table's own
  // invites_director_needs_event check enforces this too, but failing here gives the admin a
  // sentence instead of a constraint-violation string.
  const eventId = input.role === "director" ? (input.eventId ?? null) : null;

  if (input.role === "director" && !eventId) {
    throw new Error("A director link needs an event.");
  }

  const expiresAt =
    input.expiresInDays && input.expiresInDays > 0
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const insert = {
    token: generateToken(),
    role: input.role,
    event_id: eventId,
    expires_at: expiresAt,
    max_uses: input.maxUses && input.maxUses > 0 ? input.maxUses : null,
    created_by: user?.id ?? null,
  };

  const { data, error } = await supabase
    .from("invites")
    .insert(insert as never)
    .select(SELECT_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error("Could not create the invite link.");
  }

  return toSummary(data as InviteRow);
}

/**
 * Sets revoked_at rather than deleting: 20260817000500 shipped no delete policy on purpose (keep the
 * record of what existed), and its suggested "backdate expires_at" workaround stopped working once
 * expires_at became nullable in 20260820000100, where null means "never expires" and would be
 * indistinguishable from a cleared revocation.
 */
export async function revokeInvite(token: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("invites")
    .update({ revoked_at: new Date().toISOString() } as never)
    .eq("token", token)
    .is("revoked_at", null);

  if (error) {
    throw new Error("Could not revoke the invite link.");
  }
}

/**
 * What /join/[token] shows a visitor who has not signed in yet. Goes through the security-definer
 * get_invite_preview() because an anonymous caller has no select access to the table at all, by
 * design: a stranger must not be able to probe invite metadata. Returns null for a token that is
 * unknown, revoked, expired, or used up, all of which are the same thing from outside.
 */
export async function getInvitePreview(token: string): Promise<InvitePreview | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await callRpc(supabase, "get_invite_preview", { p_token: token });

  if (error || !data || data.length === 0) {
    return null;
  }

  const [row] = data;

  return { role: row.role, eventId: row.event_id ?? null };
}

export type RedeemInviteResult =
  | { ok: true; role: InviteRole }
  | { ok: false; message: string };

/**
 * Grants the invite's role to the signed-in caller and activates their account, via the
 * security-definer redeem_invite(). Returns a result rather than throwing: this runs on the one
 * screen a brand-new user sees, and an unhandled server-action rejection there is an error overlay
 * on someone's first impression of the app.
 *
 * The database is authoritative for every rule (expiry, use count, revocation, and never demoting an
 * existing higher role); nothing is re-checked here, so the two can't drift.
 */
export async function redeemInvite(token: string): Promise<RedeemInviteResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await callRpc(supabase, "redeem_invite", { p_token: token });

  if (error || !data) {
    return {
      ok: false,
      // Postgres RAISE messages here are written for a person ("invite link has expired"), so they
      // are surfaced as-is; anything unrecognized falls back to something non-alarming.
      message: error?.message ?? "Could not redeem this invite link.",
    };
  }

  return { ok: true, role: data };
}
