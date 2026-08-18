import "server-only";

import { z } from "zod";
import { requireRole } from "@/lib/auth/authorization";
import { buildIcsCalendar, toIcsFilename } from "@/lib/ics/build-ics";
import type { IcsEvent } from "@/lib/ics/build-ics";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Enums } from "@/types/database";

// Full-roster download for one event: every shift regardless of fill, with assigned member names in
// each VEVENT's DESCRIPTION. Organizer/admin only, both because of the roster-planning use case and
// because per-shift assignee names are personal data that no other surface in this route set exposes.

const ACTIVE_ASSIGNMENT_STATUSES: Enums<"assignment_status">[] = ["draft", "published", "swap_pending"];

const eventIdParamSchema = z.string().uuid();

type EventRow = { id: string; name: string };
type ShiftRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  notes: string | null;
};
type AssignmentRow = {
  shift_id: string;
  profiles: { full_name: string } | null;
};

function notFound(): Response {
  return new Response("Not found.", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function serverError(): Response {
  return new Response("Unable to build this calendar feed.", {
    status: 500,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function buildShiftDescription(shift: ShiftRow, assignees: string[]): string {
  const lines =
    assignees.length > 0 ? ["Assigned:", ...assignees] : ["No one assigned yet."];

  if (shift.notes) {
    lines.push("", shift.notes);
  }

  return lines.join("\n");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
): Promise<Response> {
  // requireRole("director") redirects a signed-in member (and /sign-in for an anonymous caller); that's
  // a thrown Next.js control-flow signal, not a real error, left uncaught here on purpose so the
  // framework turns it into an actual redirect response.
  await requireRole("director");

  const { eventId: rawEventId } = await params;
  const parsedEventId = eventIdParamSchema.safeParse(rawEventId);

  if (!parsedEventId.success) {
    return notFound();
  }

  const supabase = await createSupabaseServerClient();

  const { data: eventRow, error: eventError } = await supabase
    .from("events")
    .select("id, name")
    .eq("id", parsedEventId.data)
    .maybeSingle();

  if (eventError) {
    return serverError();
  }

  if (!eventRow) {
    return notFound();
  }

  const event = eventRow as EventRow;

  const { data: shiftRows, error: shiftsError } = await supabase
    .from("shifts")
    .select("id, title, starts_at, ends_at, location, notes")
    .eq("event_id", event.id)
    .order("starts_at", { ascending: true });

  if (shiftsError) {
    return serverError();
  }

  const shifts = (shiftRows ?? []) as ShiftRow[];
  const shiftIds = shifts.map((shift) => shift.id);
  const assigneesByShiftId = new Map<string, string[]>();

  if (shiftIds.length > 0) {
    const { data: assignmentRows, error: assignmentsError } = await supabase
      .from("shift_assignments")
      .select("shift_id, profiles(full_name)")
      .in("shift_id", shiftIds)
      .in("status", ACTIVE_ASSIGNMENT_STATUSES);

    if (assignmentsError) {
      return serverError();
    }

    for (const assignment of (assignmentRows ?? []) as unknown as AssignmentRow[]) {
      if (!assignment.profiles) {
        continue;
      }

      const names = assigneesByShiftId.get(assignment.shift_id) ?? [];
      names.push(assignment.profiles.full_name);
      assigneesByShiftId.set(assignment.shift_id, names);
    }
  }

  const icsEvents: IcsEvent[] = shifts.map((shift) => ({
    uid: `${shift.id}@prog-scheduler`,
    summary: shift.title,
    description: buildShiftDescription(shift, assigneesByShiftId.get(shift.id) ?? []),
    location: shift.location ?? undefined,
    startsAt: shift.starts_at,
    endsAt: shift.ends_at,
  }));

  const ics = buildIcsCalendar(icsEvents, { calendarName: event.name });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${toIcsFilename(event.name, "event-schedule")}"`,
    },
  });
}
