import "server-only";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

// Public, unauthenticated endpoint. Backs the embeddable widget
// (public-embed/widget.js) and any other org-facing "what's coming up" surface.
// No auth check on purpose: this is meant to be fetched from arbitrary third-party
// pages, so it only ever returns published-event, published-assignment data, never
// draft schedules or member-identifying fields.

type ShiftRow = Pick<
  Database["public"]["Tables"]["shifts"]["Row"],
  "id" | "title" | "starts_at" | "ends_at" | "required_people" | "shift_role_id" | "event_id"
>;
type ShiftRoleRow = Pick<Database["public"]["Tables"]["shift_roles"]["Row"], "id" | "name">;
type AssignmentRow = Pick<Database["public"]["Tables"]["shift_assignments"]["Row"], "shift_id" | "status">;
type EventRow = Pick<Database["public"]["Tables"]["events"]["Row"], "id">;

type UpcomingShift = {
  id: string;
  title: string;
  stationName: string | null;
  startsAt: string;
  endsAt: string;
  needed: number;
  filled: number;
};

const DEFAULT_COUNT = 5;
const MIN_COUNT = 1;
const MAX_COUNT = 20;

const searchParamsSchema = z.object({
  eventId: z.string().trim().min(1).optional(),
  count: z.coerce.number().finite().optional(),
});

function clampCount(rawCount: number | undefined): number {
  if (rawCount === undefined || !Number.isFinite(rawCount)) {
    return DEFAULT_COUNT;
  }

  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.trunc(rawCount)));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsedParams = searchParamsSchema.safeParse({
    eventId: url.searchParams.get("eventId") ?? undefined,
    count: url.searchParams.get("count") ?? undefined,
  });

  const eventId = parsedParams.success ? (parsedParams.data.eventId ?? null) : null;
  const count = clampCount(parsedParams.success ? parsedParams.data.count : undefined);

  const shifts = await loadUpcomingShifts(eventId, count);

  return Response.json(
    { shifts },
    {
      headers: {
        "Cache-Control": "public, max-age=60",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}

async function loadUpcomingShifts(eventId: string | null, count: number): Promise<UpcomingShift[]> {
  try {
    // Query shape may not fully match the current schema/access model yet:
    // 1. Event resolution elsewhere in this codebase is still name-based, not id-based
    //    (docs/contracts/schema-requests.md item 4, tracked in docs/contracts/requests.md).
    //    This query itself is id/status-based (no name lookups), but callers passing an
    //    `eventId` are trusting an id-based contract that isn't fully solid product-wide yet.
    // 2. `createSupabaseServerClient` runs as the `anon` Postgres role when nobody is signed
    //    in, and today's RLS policies on `events`/`shifts`/`shift_roles`/
    //    `shift_assignments` are all scoped `to authenticated` (see
    //    supabase/migrations/20260815223209_rewrite_rls_policies.sql), so an anonymous caller
    //    may see zero rows even for genuinely published data until that's revisited. That is
    //    not an error, just an empty result, which is why the fallback below is an empty
    //    array rather than a thrown error surfaced to the widget.
    // Safe to firm up either point once the corresponding schema/RLS change lands.
    const supabase = await createSupabaseServerClient();
    const nowIso = new Date().toISOString();

    let publishedEventsQuery = supabase.from("events").select("id").eq("status", "published");

    if (eventId) {
      publishedEventsQuery = publishedEventsQuery.eq("id", eventId);
    }

    const { data: eventRows, error: eventsError } = await publishedEventsQuery;

    if (eventsError) {
      throw eventsError;
    }

    const publishedEventIds = ((eventRows ?? []) as EventRow[]).map((event) => event.id);

    if (publishedEventIds.length === 0) {
      return [];
    }

    const { data: shiftRows, error: shiftsError } = await supabase
      .from("shifts")
      .select("id,title,starts_at,ends_at,required_people,shift_role_id,event_id")
      .gt("starts_at", nowIso)
      .in("event_id", publishedEventIds)
      .order("starts_at", { ascending: true })
      .limit(count);

    if (shiftsError) {
      throw shiftsError;
    }

    const shifts = (shiftRows ?? []) as ShiftRow[];

    if (shifts.length === 0) {
      return [];
    }

    const shiftIds = shifts.map((shift) => shift.id);
    const shiftRoleIds = Array.from(
      new Set(shifts.map((shift) => shift.shift_role_id).filter((id): id is string => id !== null)),
    );

    const [{ data: roleRows, error: rolesError }, { data: assignmentRows, error: assignmentsError }] =
      await Promise.all([
        shiftRoleIds.length > 0
          ? supabase.from("shift_roles").select("id,name").in("id", shiftRoleIds)
          : Promise.resolve({ data: [] as ShiftRoleRow[], error: null }),
        supabase.from("shift_assignments").select("shift_id,status").in("shift_id", shiftIds),
      ]);

    if (rolesError || assignmentsError) {
      throw rolesError ?? assignmentsError;
    }

    const stationNameByRoleId = new Map(
      ((roleRows ?? []) as ShiftRoleRow[]).map((role) => [role.id, role.name]),
    );
    const filledByShiftId = new Map<string, number>();

    for (const assignment of (assignmentRows ?? []) as AssignmentRow[]) {
      if (assignment.status !== "published") {
        continue;
      }

      filledByShiftId.set(assignment.shift_id, (filledByShiftId.get(assignment.shift_id) ?? 0) + 1);
    }

    return shifts.map((shift) => ({
      id: shift.id,
      title: shift.title,
      stationName: shift.shift_role_id ? (stationNameByRoleId.get(shift.shift_role_id) ?? null) : null,
      startsAt: shift.starts_at,
      endsAt: shift.ends_at,
      needed: shift.required_people,
      filled: filledByShiftId.get(shift.id) ?? 0,
    }));
  } catch {
    return [];
  }
}
