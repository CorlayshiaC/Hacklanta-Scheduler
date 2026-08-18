import "server-only";

import { getAvailabilityEventById, getDefaultAvailabilityEvent } from "@/lib/availability/event";
import { requireAuthenticatedUser, type AuthenticatedProfile } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AvailabilityEventWindow } from "@/lib/availability/event";
import type { Database } from "@/types/database";

type ShiftRow = Database["public"]["Tables"]["shifts"]["Row"];
type ShiftRoleRow = Database["public"]["Tables"]["shift_roles"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export type OpenShiftMember = {
  id: string;
  name: string;
  imageUrl?: string;
};

export type OpenShift = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  stationName: string | null;
  requiredPeople: number;
  filledCount: number;
  isFull: boolean;
  isMine: boolean;
  assignedMembers: OpenShiftMember[];
  /** True if one of the caller's own availability_windows for this event fully contains this shift's time range. */
  fitsAvailability: boolean;
};

export type OpenShiftsPageData = {
  event: AvailabilityEventWindow;
  profile: AuthenticatedProfile;
  shifts: OpenShift[];
  /** False if the caller has not painted any availability for this event yet, used to decide the
   * default state of the "fits my availability" filter: defaulting it on with zero windows painted
   * would hide every shift. */
  memberHasAvailability: boolean;
};

function shiftFitsWindow(
  shift: { starts_at: string; ends_at: string },
  windows: { starts_at: string; ends_at: string }[],
): boolean {
  const shiftStart = new Date(shift.starts_at).getTime();
  const shiftEnd = new Date(shift.ends_at).getTime();
  return windows.some(
    (window) => new Date(window.starts_at).getTime() <= shiftStart && new Date(window.ends_at).getTime() >= shiftEnd,
  );
}

export async function getOpenShiftsPageData(eventId?: string): Promise<OpenShiftsPageData> {
  const context = await requireAuthenticatedUser();
  const event = eventId ? await getAvailabilityEventById(eventId) : await getDefaultAvailabilityEvent();
  const adminSupabase = createSupabaseAdminClient();
  const supabase = await createSupabaseServerClient();

  const { data: shiftRows, error: shiftsError } = await adminSupabase
    .from("shifts")
    .select("id,title,starts_at,ends_at,location,required_people,shift_role_id")
    .eq("event_id", event.id)
    .order("starts_at", { ascending: true });

  if (shiftsError) {
    throw new Error("Unable to load shifts.");
  }

  const shifts = (shiftRows ?? []) as Pick<
    ShiftRow,
    "id" | "title" | "starts_at" | "ends_at" | "location" | "required_people" | "shift_role_id"
  >[];
  const shiftIds = shifts.map((shift) => shift.id);
  const roleIds = Array.from(
    new Set(shifts.map((shift) => shift.shift_role_id).filter((roleId): roleId is string => Boolean(roleId))),
  );

  const [assignmentsResult, rolesResult, availabilityResult] = await Promise.all([
    shiftIds.length > 0
      ? adminSupabase.from("shift_assignments").select("id,shift_id,profile_id,status").in("shift_id", shiftIds).in("status", [
          "draft",
          "published",
        ])
      : Promise.resolve({ data: [], error: null }),
    roleIds.length > 0
      ? adminSupabase.from("shift_roles").select("id,name").in("id", roleIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("availability_windows")
      .select("starts_at,ends_at")
      .eq("event_id", event.id)
      .eq("profile_id", context.profile.id)
      .eq("status", "available"),
  ]);

  if (assignmentsResult.error) {
    throw new Error("Unable to load shift assignments.");
  }

  if (availabilityResult.error) {
    throw new Error("Unable to load your availability.");
  }

  const assignments = (assignmentsResult.data ?? []) as { id: string; shift_id: string; profile_id: string; status: string }[];
  const rolesById = new Map(((rolesResult.data ?? []) as Pick<ShiftRoleRow, "id" | "name">[]).map((role) => [role.id, role.name]));
  const myWindows = (availabilityResult.data ?? []) as { starts_at: string; ends_at: string }[];

  const assignedProfileIds = Array.from(new Set(assignments.map((assignment) => assignment.profile_id)));
  const { data: profileRows, error: profilesError } =
    assignedProfileIds.length > 0
      ? await adminSupabase.from("profiles").select("id,full_name,avatar_url").in("id", assignedProfileIds)
      : { data: [] as Pick<ProfileRow, "id" | "full_name" | "avatar_url">[], error: null };

  if (profilesError) {
    throw new Error("Unable to load assigned members.");
  }

  const profilesById = new Map(
    ((profileRows ?? []) as Pick<ProfileRow, "id" | "full_name" | "avatar_url">[]).map((profile) => [profile.id, profile]),
  );

  const filledCountByShift = new Map<string, number>();
  const mineByShift = new Set<string>();
  const membersByShift = new Map<string, OpenShiftMember[]>();

  for (const assignment of assignments) {
    filledCountByShift.set(assignment.shift_id, (filledCountByShift.get(assignment.shift_id) ?? 0) + 1);
    if (assignment.profile_id === context.profile.id) {
      mineByShift.add(assignment.shift_id);
    }
    const profile = profilesById.get(assignment.profile_id);
    if (profile) {
      const members = membersByShift.get(assignment.shift_id) ?? [];
      members.push({ id: profile.id, name: profile.full_name, imageUrl: profile.avatar_url ?? undefined });
      membersByShift.set(assignment.shift_id, members);
    }
  }

  const openShifts: OpenShift[] = shifts.map((shift) => {
    const filledCount = filledCountByShift.get(shift.id) ?? 0;
    return {
      id: shift.id,
      title: shift.title,
      startsAt: shift.starts_at,
      endsAt: shift.ends_at,
      location: shift.location,
      stationName: shift.shift_role_id ? rolesById.get(shift.shift_role_id) ?? null : null,
      requiredPeople: shift.required_people,
      filledCount,
      isFull: filledCount >= shift.required_people,
      isMine: mineByShift.has(shift.id),
      assignedMembers: membersByShift.get(shift.id) ?? [],
      fitsAvailability: shiftFitsWindow(shift, myWindows),
    };
  });

  return { event, profile: context.profile, shifts: openShifts, memberHasAvailability: myWindows.length > 0 };
}
