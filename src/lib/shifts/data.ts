import "server-only";

import { getAvailabilityEventById, getDefaultAvailabilityEvent } from "@/lib/availability/event";
import { requireAuthenticatedUser, type AuthenticatedProfile } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AvailabilityEventWindow } from "@/lib/availability/event";
import type { Database } from "@/types/database";

type ShiftRow = Database["public"]["Tables"]["shifts"]["Row"];
type ShiftRoleRow = Database["public"]["Tables"]["shift_roles"]["Row"];

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
};

export type OpenShiftsPageData = {
  event: AvailabilityEventWindow;
  profile: AuthenticatedProfile;
  shifts: OpenShift[];
};

export async function getOpenShiftsPageData(eventId?: string): Promise<OpenShiftsPageData> {
  const context = await requireAuthenticatedUser();
  const event = eventId ? await getAvailabilityEventById(eventId) : await getDefaultAvailabilityEvent();
  const adminSupabase = createSupabaseAdminClient();

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

  const [assignmentsResult, rolesResult] = await Promise.all([
    shiftIds.length > 0
      ? adminSupabase.from("shift_assignments").select("id,shift_id,profile_id,status").in("shift_id", shiftIds).in("status", [
          "draft",
          "published",
        ])
      : Promise.resolve({ data: [], error: null }),
    roleIds.length > 0
      ? adminSupabase.from("shift_roles").select("id,name").in("id", roleIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (assignmentsResult.error) {
    throw new Error("Unable to load shift assignments.");
  }

  const assignments = (assignmentsResult.data ?? []) as { id: string; shift_id: string; profile_id: string; status: string }[];
  const rolesById = new Map(((rolesResult.data ?? []) as Pick<ShiftRoleRow, "id" | "name">[]).map((role) => [role.id, role.name]));
  const filledCountByShift = new Map<string, number>();
  const mineByShift = new Set<string>();

  for (const assignment of assignments) {
    filledCountByShift.set(assignment.shift_id, (filledCountByShift.get(assignment.shift_id) ?? 0) + 1);
    if (assignment.profile_id === context.profile.id) {
      mineByShift.add(assignment.shift_id);
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
    };
  });

  return { event, profile: context.profile, shifts: openShifts };
}
