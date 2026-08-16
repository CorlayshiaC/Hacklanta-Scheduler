import "server-only";

import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { buildIcsCalendar, toIcsFilename } from "@/lib/ics/build-ics";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Single-VEVENT download for one shift ("Add to calendar" on a shift a member is looking at), as
// opposed to the polling subscription feed at /api/feeds/mine/[token]. Runs on the cookie-authenticated
// server client so RLS itself is what keeps a member from downloading a shift they can't see, this route
// adds no extra scoping of its own.

const shiftIdParamSchema = z.string().uuid();

type ShiftRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  notes: string | null;
  events: { name: string } | null;
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
  { params }: { params: Promise<{ shiftId: string }> },
): Promise<Response> {
  // requireAuthenticatedUser() redirects to /sign-in for an anonymous caller. That redirect is a thrown
  // Next.js control-flow signal, not a real error, and is allowed to propagate past this function
  // uncaught so the framework can turn it into an actual redirect response.
  await requireAuthenticatedUser();

  const { shiftId: rawShiftId } = await params;
  const parsedShiftId = shiftIdParamSchema.safeParse(rawShiftId);

  if (!parsedShiftId.success) {
    return notFound();
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("shifts")
    .select("id, title, starts_at, ends_at, location, notes, events(name)")
    .eq("id", parsedShiftId.data)
    .maybeSingle();

  if (error) {
    return serverError();
  }

  if (!data) {
    // Either the shift doesn't exist, or RLS is hiding it from this caller. Both collapse to "not
    // found," never a distinct "forbidden," so this endpoint can't be used to probe which shift ids
    // exist for shifts the caller isn't allowed to see.
    return notFound();
  }

  const shift = data as unknown as ShiftRow;
  const descriptionParts: string[] = [];

  if (shift.events?.name) {
    descriptionParts.push(`Part of ${shift.events.name}.`);
  }

  if (shift.notes) {
    descriptionParts.push(shift.notes);
  }

  const ics = buildIcsCalendar(
    [
      {
        uid: `${shift.id}@prog-scheduler`,
        summary: shift.title,
        description: descriptionParts.length > 0 ? descriptionParts.join(" ") : undefined,
        location: shift.location ?? undefined,
        startsAt: shift.starts_at,
        endsAt: shift.ends_at,
      },
    ],
    { calendarName: shift.title },
  );

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${toIcsFilename(shift.title, "shift")}"`,
    },
  });
}
