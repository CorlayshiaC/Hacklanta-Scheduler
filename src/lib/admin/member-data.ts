import "server-only";

import { differenceInHours } from "@/lib/availability/time";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Enums } from "@/types/database";

export type AdminMembersFilter = {
  query?: string;
  status?: "all" | "active" | "inactive";
};

export type CoverageRole = Database["public"]["Tables"]["coverage_roles"]["Row"];
export type MemberSettings = Database["public"]["Tables"]["member_settings"]["Row"];
export type MemberAvailabilityWindow = Database["public"]["Tables"]["availability_windows"]["Row"];
type EventRow = Database["public"]["Tables"]["events"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export type AdminMember = {
  id: string;
  fullName: string;
  email: string;
  role: Enums<"app_role">;
  isActive: boolean;
  coverageRoles: CoverageRole[];
  settings: MemberSettings | null;
  availabilityWindows: MemberAvailabilityWindow[];
  totalAvailabilityHours: number;
};

export type AdminMembersPageData = {
  event: Database["public"]["Tables"]["events"]["Row"] | null;
  members: AdminMember[];
  coverageRoles: CoverageRole[];
};

type MemberCoverageRoleRow = {
  profile_id: string;
  coverage_roles: CoverageRole | null;
};

export async function getAdminMembersPageData(
  filter: AdminMembersFilter = {},
): Promise<AdminMembersPageData> {
  const supabase = await createSupabaseServerClient();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("*")
    .neq("status", "archived")
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (eventError) {
    throw new Error("Unable to load HackLanta event.");
  }

  let profilesQuery = supabase
    .from("profiles")
    .select("id,full_name,email,role,is_active,created_at,updated_at")
    .order("full_name", { ascending: true })
    .order("email", { ascending: true });

  if (filter.status === "active") {
    profilesQuery = profilesQuery.eq("is_active", true);
  }

  if (filter.status === "inactive") {
    profilesQuery = profilesQuery.eq("is_active", false);
  }

  const search = filter.query?.trim();
  if (search) {
    const escaped = search.replaceAll("%", "\\%").replaceAll("_", "\\_");
    profilesQuery = profilesQuery.or(`full_name.ilike.%${escaped}%,email.ilike.%${escaped}%`);
  }

  const { data: profiles, error: profilesError } = await profilesQuery;

  if (profilesError) {
    throw new Error("Unable to load members.");
  }

  const eventRow = event as EventRow | null;

  if (!eventRow) {
    return { event: null, members: [], coverageRoles: [] };
  }

  const [
    { data: coverageRoles, error: coverageRolesError },
    { data: memberCoverageRoles, error: memberCoverageRolesError },
    { data: memberSettings, error: memberSettingsError },
    { data: availabilityWindows, error: availabilityWindowsError },
  ] = await Promise.all([
    supabase.from("coverage_roles").select("*").eq("event_id", eventRow.id).order("name"),
    supabase
      .from("member_coverage_roles")
      .select("profile_id,coverage_roles(*)")
      .eq("event_id", eventRow.id),
    supabase.from("member_settings").select("*").eq("event_id", eventRow.id),
    supabase
      .from("availability_windows")
      .select("*")
      .eq("event_id", eventRow.id)
      .eq("status", "available")
      .order("starts_at", { ascending: true }),
  ]);

  if (
    coverageRolesError ||
    memberCoverageRolesError ||
    memberSettingsError ||
    availabilityWindowsError
  ) {
    throw new Error("Unable to load member management data.");
  }

  const rolesByProfile = new Map<string, CoverageRole[]>();
  for (const row of (memberCoverageRoles ?? []) as unknown as MemberCoverageRoleRow[]) {
    if (!row.coverage_roles) {
      continue;
    }

    const roles = rolesByProfile.get(row.profile_id) ?? [];
    roles.push(row.coverage_roles);
    rolesByProfile.set(row.profile_id, roles);
  }

  const settingsByProfile = new Map(
    ((memberSettings ?? []) as MemberSettings[]).map((settings) => [settings.profile_id, settings]),
  );
  const availabilityByProfile = new Map<string, MemberAvailabilityWindow[]>();
  for (const window of (availabilityWindows ?? []) as MemberAvailabilityWindow[]) {
    const windows = availabilityByProfile.get(window.profile_id) ?? [];
    windows.push(window);
    availabilityByProfile.set(window.profile_id, windows);
  }

  const members: AdminMember[] = ((profiles ?? []) as ProfileRow[]).map((profile) => ({
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    role: profile.role,
    isActive: profile.is_active,
    coverageRoles: rolesByProfile.get(profile.id) ?? [],
    settings: settingsByProfile.get(profile.id) ?? null,
    availabilityWindows: availabilityByProfile.get(profile.id) ?? [],
    totalAvailabilityHours: (availabilityByProfile.get(profile.id) ?? []).reduce(
      (total, window) => total + differenceInHours(window.starts_at, window.ends_at),
      0,
    ),
  }));

  return {
    event: eventRow,
    members,
    coverageRoles: (coverageRoles ?? []) as CoverageRole[],
  };
}
