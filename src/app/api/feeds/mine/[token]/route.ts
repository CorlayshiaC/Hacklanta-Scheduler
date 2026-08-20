import "server-only";

import { z } from "zod";
import { buildIcsCalendar } from "@/lib/ics/build-ics";
import type { IcsEvent } from "@/lib/ics/build-ics";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Enums } from "@/types/database";

// Calendar apps poll this URL directly with no cookies attached, so this is the one feed route that
// authenticates via the opaque token itself rather than a signed-in session, and therefore the one that
// needs the service-role client (there is no logged-in user for RLS to scope to).

const ACTIVE_ASSIGNMENT_STATUSES: Enums<"assignment_status">[] = ["draft", "published", "swap_pending"];

// Accepts both the crypto.randomUUID() shape getOrCreateCalendarToken currently mints and any other
// opaque token shape a future implementation might choose (see src/lib/db/calendar-tokens.ts), rather
// than hard-coding the UUID format. Anything outside this charset can't be a real token, so it's
// rejected the same way a not-found token is: a 404, not a 400, so this endpoint never confirms or
// denies whether a given string was ever a valid credential.
const tokenParamSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]+$/)
  .min(16)
  .max(200);

type TokenRow = {
  profile_id: string;
  revoked_at: string | null;
  profiles: { full_name: string } | null;
};

type AssignmentRow = {
  id: string;
  shifts: {
    title: string;
    starts_at: string;
    ends_at: string;
    location: string | null;
    notes: string | null;
    events: { name: string } | null;
  } | null;
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token: rawToken } = await params;
  const parsedToken = tokenParamSchema.safeParse(rawToken);

  if (!parsedToken.success) {
    return notFound();
  }

  const supabase = createSupabaseAdminClient();

  const { data: tokenRow, error: tokenError } = await supabase
    .from("calendar_tokens")
    .select("profile_id, revoked_at, profiles(full_name)")
    .eq("token", parsedToken.data)
    .maybeSingle();

  if (tokenError) {
    return serverError();
  }

  if (!tokenRow || tokenRow.revoked_at !== null) {
    return notFound();
  }

  const { profile_id: profileId, profiles: profile } = tokenRow as unknown as TokenRow;

  const { data: assignments, error: assignmentsError } = await supabase
    .from("shift_assignments")
    .select("id, shifts(title, starts_at, ends_at, location, notes, events(name))")
    .eq("profile_id", profileId)
    .in("status", ACTIVE_ASSIGNMENT_STATUSES);

  if (assignmentsError) {
    return serverError();
  }

  const icsEvents: IcsEvent[] = ((assignments ?? []) as unknown as AssignmentRow[])
    .filter((assignment) => assignment.shifts !== null)
    .map((assignment) => {
      const shift = assignment.shifts!;
      const descriptionParts: string[] = [];

      if (shift.events?.name) {
        descriptionParts.push(`Part of ${shift.events.name}.`);
      }

      if (shift.notes) {
        descriptionParts.push(shift.notes);
      }

      return {
        uid: `${assignment.id}@prog-scheduler`,
        summary: shift.title,
        description: descriptionParts.length > 0 ? descriptionParts.join(" ") : undefined,
        location: shift.location ?? undefined,
        startsAt: shift.starts_at,
        endsAt: shift.ends_at,
      };
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const calendarName = profile?.full_name ? `${profile.full_name}'s schedule` : "My schedule";
  const ics = buildIcsCalendar(icsEvents, { calendarName });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="my-schedule.ics"',
      // Calendar apps set their own polling interval; this just bounds how stale a response the CDN/
      // browser can hand back between two polls that land close together.
      "Cache-Control": "private, max-age=300",
    },
  });
}
