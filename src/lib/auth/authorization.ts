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
 * Minimum role tiers, ordered least to most privileged. "board_member" is the stored enum value for
 * the base member tier (see docs/contracts/schema.md "Role model" for why it isn't renamed to "member"
 * yet). Kept ranked rather than compared as an exact match so requireRole("organizer") also admits
 * "admin", matching the shared-context vocabulary (admin can do everything organizer can).
 */
const roleRank: Record<Enums<"app_role">, number> = {
  board_member: 0,
  organizer: 1,
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

  if (context.profile.role !== "board_member") {
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

export async function requireOrganizer(): Promise<AuthenticatedUserContext> {
  return requireRole("organizer");
}

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
