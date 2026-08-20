import "server-only";

import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getMemberSchedulePageData, type MemberHours, type MemberScheduleAssignment } from "@/lib/member/schedule";
import type { AvailabilityEventWindow } from "@/lib/availability/event";

/**
 * Member-facing event browsing (`/my-events`, `/my-events/[id]`). Deferred out of the V2 pass (see
 * docs/contracts/requests.md, "member event pages next") since `/events` is Agent 3's
 * organizer/admin-gated route (`requireOrganizer()`), so this needs its own member-safe queries
 * rather than a role branch on theirs. Only `published` events are listed: a member has no reason
 * to see a draft event that hasn't been announced yet, same visibility rule as the shifts board.
 */

export type MemberEventSummary = Pick<
  AvailabilityEventWindow,
  "id" | "name" | "starts_at" | "ends_at" | "timezone" | "status" | "location"
> & {
  description: string | null;
};

export type MemberEventAnnouncement = {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
};

export type MemberEventDetail = {
  event: MemberEventSummary;
  assignments: MemberScheduleAssignment[];
  hours: MemberHours;
  announcements: MemberEventAnnouncement[];
};

export async function listMemberEvents(): Promise<MemberEventSummary[]> {
  await requireAuthenticatedUser();
  const adminSupabase = createSupabaseAdminClient();

  const { data, error } = await adminSupabase
    .from("events")
    .select("id,name,starts_at,ends_at,timezone,status,location,description")
    .eq("status", "published")
    .order("starts_at", { ascending: true });

  if (error) {
    throw new Error("Unable to load events.");
  }

  return (data ?? []) as MemberEventSummary[];
}

type AnnouncementRow = {
  id: string;
  body: string;
  created_at: string;
  profiles: { full_name: string | null; email: string } | null;
};

export async function getMemberEventDetail(eventId: string): Promise<MemberEventDetail | null> {
  await requireAuthenticatedUser();
  const adminSupabase = createSupabaseAdminClient();

  const { data: eventRow, error: eventError } = await adminSupabase
    .from("events")
    .select("id,name,starts_at,ends_at,timezone,status,location,description")
    .eq("id", eventId)
    .eq("status", "published")
    .maybeSingle();

  if (eventError) {
    throw new Error("Unable to load this event.");
  }
  if (!eventRow) {
    return null;
  }

  const event = eventRow as MemberEventSummary;

  const [scheduleData, announcementResult] = await Promise.all([
    getMemberSchedulePageData(event.id),
    adminSupabase
      .from("announcements")
      .select("id,body,created_at,profiles!announcements_author_id_fkey(full_name,email)")
      .eq("event_id", event.id)
      .order("created_at", { ascending: false }),
  ]);

  if (announcementResult.error) {
    throw new Error("Unable to load announcements.");
  }

  // Same Supabase select-string type-inference workaround already used in
  // src/app/(app)/events/[id]/page.tsx and src/lib/auth/authorization.ts.
  const announcements = ((announcementResult.data ?? []) as unknown as AnnouncementRow[]).map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    authorName: row.profiles?.full_name?.trim() || row.profiles?.email || "Unknown",
  }));

  return {
    event,
    // Read-only per-event view: only confirmed shifts, not still-pending ones, per the V2 scope
    // note ("approved-only schedule").
    assignments: scheduleData.assignments.filter((assignment) => assignment.state === "approved"),
    hours: scheduleData.hours,
    announcements,
  };
}
