import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPostAuthPath } from "@/lib/auth/route-protection";
import type { Enums } from "@/types/database";

export type AdminAuthorizationResult =
  { isAdmin: true; userId: string } | { isAdmin: false; userId: string | null };

export type AuthenticatedProfile = {
  id: string;
  role: Enums<"app_role">;
  is_active: boolean;
};

export type AuthenticatedUserContext = {
  user: User;
  profile: AuthenticatedProfile;
};

export type AuthorizationResult =
  | { authorized: true; userId: string; role: Enums<"app_role"> }
  | {
      authorized: false;
      userId: string | null;
      reason: "anonymous" | "inactive" | "missing_profile" | "insufficient_role";
    };

/**
 * Minimum role tiers, ordered least to most privileged. Kept ranked rather than compared as an exact
 * match so requireRole("director") also admits "admin". V2 caveat: unlike v1's blanket organizer,
 * "director" authority is scoped per-event (event_directors, see docs/contracts/schema.md "V2 role
 * model"). requireRole("director") only proves the caller holds the director role tier at all, e.g.
 * for routing/nav gating; anything that writes to a specific event's data must additionally check
 * requireDirectorOf(eventId) below, RLS enforces the same at the database layer regardless.
 */
const roleRank: Record<Enums<"app_role">, number> = {
  member: 0,
  director: 1,
  admin: 2,
};

export type MinimumRole = Enums<"app_role">;

export function meetsMinimumRole(role: Enums<"app_role">, minimumRole: MinimumRole): boolean {
  return roleRank[role] >= roleRank[minimumRole];
}

async function getProfileForUser(userId: string): Promise<AuthenticatedProfile | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,role,is_active")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data as AuthenticatedProfile | null;
}

/**
 * Alias for getAuthenticatedUser matching the "getSessionUser" name from docs/contracts/schema.md's
 * lib/auth deliverable. Same function, kept as a re-export rather than a rename so existing callers of
 * getAuthenticatedUser are untouched.
 */
export { getAuthenticatedUser as getSessionUser };

export async function getAuthenticatedUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function getAuthenticatedUserContext(): Promise<AuthenticatedUserContext | null> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return null;
  }

  const profile = await getProfileForUser(user.id);

  if (!profile || !profile.is_active) {
    return null;
  }

  return { user, profile };
}

export async function getActiveUserAuthorization(): Promise<AuthorizationResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return { authorized: false, userId: null, reason: "anonymous" };
  }

  const profile = await getProfileForUser(user.id);

  if (!profile) {
    return { authorized: false, userId: user.id, reason: "missing_profile" };
  }

  if (!profile.is_active) {
    return { authorized: false, userId: user.id, reason: "inactive" };
  }

  return { authorized: true, userId: user.id, role: profile.role };
}

export async function requireAuthenticatedUser(): Promise<AuthenticatedUserContext> {
  const context = await getAuthenticatedUserContext();

  if (!context) {
    redirect("/sign-in");
  }

  return context;
}

export async function requireBoardMember(): Promise<AuthenticatedUserContext> {
  const context = await requireAuthenticatedUser();

  if (context.profile.role !== "member") {
    redirect(getPostAuthPath(context.profile.role));
  }

  return context;
}

/**
 * Redirects unless the caller's role meets or exceeds minimumRole (see meetsMinimumRole). This is the
 * "requireRole('organizer')" helper from docs/contracts/schema.md: use it for any server action or
 * route handler that organizers and admins should both reach, but board members should not.
 */
export async function requireRole(minimumRole: MinimumRole): Promise<AuthenticatedUserContext> {
  const context = await requireAuthenticatedUser();

  if (!meetsMinimumRole(context.profile.role, minimumRole)) {
    redirect(getPostAuthPath(context.profile.role));
  }

  return context;
}

export async function requireDirector(): Promise<AuthenticatedUserContext> {
  return requireRole("director");
}

/**
 * V2: "organizer" is retired, renamed to "director" (docs/contracts/schema.md "V2 role model"). Kept
 * as an alias, not a rename, so the 7 files across Agents 3/5 already calling requireOrganizer() don't
 * break out from under them mid-flight; same pattern as getSessionUser below. Migrate to
 * requireDirector() at your convenience, functionally identical.
 */
export { requireDirector as requireOrganizer };

export async function getRoleAuthorization(minimumRole: MinimumRole): Promise<AuthorizationResult> {
  const authorization = await getActiveUserAuthorization();

  if (!authorization.authorized) {
    return authorization;
  }

  if (!meetsMinimumRole(authorization.role, minimumRole)) {
    return { authorized: false, userId: authorization.userId, reason: "insufficient_role" };
  }

  return authorization;
}

export async function getAdminAuthorization(): Promise<AdminAuthorizationResult> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return { isAdmin: false, userId: null };
  }

  const profile = await getProfileForUser(user.id);

  return profile?.role === "admin" && profile.is_active
    ? { isAdmin: true, userId: user.id }
    : { isAdmin: false, userId: user.id };
}

export async function requireAdmin(): Promise<{ userId: string }> {
  const authorization = await getAdminAuthorization();

  if (!authorization.isAdmin) {
    redirect(authorization.userId ? "/my-schedule" : "/sign-in");
  }

  return { userId: authorization.userId };
}

/**
 * V2 per-event authority check: admin, or a director assigned to this specific event
 * (event_directors, docs/contracts/schema.md "V2 role model"). Unlike requireRole("director"), which
 * only proves the caller holds the director tier at all, this proves they're authorized for THIS
 * event specifically, mirroring app_private.is_director_of_event() (the RLS-layer version of the same
 * check, called here via RPC so app code and the database never disagree on the answer).
 */
export async function requireDirectorOf(eventId: string): Promise<AuthenticatedUserContext> {
  const context = await requireAuthenticatedUser();

  if (context.profile.role === "admin") {
    return context;
  }

  // app_private.is_director_of_event() (the RLS-layer check) lives in a private schema on purpose,
  // not exposed over PostgREST/.rpc() -- calling it from here would 404 at runtime, not just fail to
  // typecheck. Query event_directors directly instead: the event_directors_select_admin_or_self RLS
  // policy already lets a director read their own rows, so this is exactly the same fact, just read
  // as data instead of through a security-definer function. Defense in depth either way: every write
  // this gates is itself re-checked by is_director_of_event()/is_director_of_shift() at the RLS layer
  // regardless of what this app-layer check decides.
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_directors")
    .select("event_id")
    .eq("event_id", eventId)
    .eq("user_id", context.profile.id)
    .maybeSingle();

  if (error || !data) {
    redirect(getPostAuthPath(context.profile.role));
  }

  return context;
}
