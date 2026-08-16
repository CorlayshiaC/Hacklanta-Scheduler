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
  | { authorized: false; userId: string | null; reason: "anonymous" | "inactive" | "missing_profile" };

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
