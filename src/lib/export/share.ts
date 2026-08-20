import "server-only";

import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/types/database";

// Backed by the real `share_tokens` table, see
// supabase/migrations/20260816130900_share_tokens_and_public_schedule.sql. Row level security on
// that table already restricts select/insert/update to organizers and admins
// (app_private.is_organizer_or_admin()); requireAdmin below is a stricter app-level gate than
// that policy, since "organizer" is not yet readable from getActiveUserAuthorization() (see
// docs/contracts/pending.md item three and docs/contracts/schema-requests.md). Once an
// organizer-or-admin helper exists in src/lib/auth/authorization.ts, swap requireAdmin for it here
// so organizers are not blocked at the app layer even though the database already allows them.

export interface ShareTokenSummary {
  token: string;
  label: string | null;
  createdAt: string;
  revokedAt: string | null;
}

type ShareTokenRow = { token: string; label: string | null; created_at: string; revoked_at: string | null };

function getSiteUrl(): string {
  // NEXT_PUBLIC_SITE_URL is requested in docs/contracts/requests.md but has not
  // been added to the environment yet. Fall back to the local dev address.
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function createShareToken(
  eventId: string,
  label?: string,
): Promise<{ token: string; url: string }> {
  const { userId } = await requireAdmin();

  const token = randomBytes(24).toString("base64url");
  const supabase = await createSupabaseServerClient();

  const insertRow: TablesInsert<"share_tokens"> = {
    event_id: eventId,
    token,
    label: label ?? null,
    created_by: userId,
  };
  const { error } = await supabase.from("share_tokens").insert(insertRow as never);

  if (error) {
    throw new Error("Could not create share link.");
  }

  return {
    token,
    url: `${getSiteUrl()}/s/${token}`,
  };
}

export async function listShareTokens(eventId: string): Promise<ShareTokenSummary[]> {
  await requireAdmin();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("share_tokens")
    .select("token,label,created_at,revoked_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  // Same select-string inference workaround as src/lib/auth/authorization.ts.
  return (data as ShareTokenRow[]).map((row) => ({
    token: row.token,
    label: row.label,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
  }));
}

export async function revokeShareToken(token: string): Promise<void> {
  await requireAdmin();

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("share_tokens")
    .update({ revoked_at: new Date().toISOString() } as never)
    .eq("token", token);

  if (error) {
    throw new Error("Could not revoke share link.");
  }
}
