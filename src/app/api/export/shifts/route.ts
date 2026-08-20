import "server-only";

import { unstable_rethrow } from "next/navigation";
import { generateShiftsCsv, getShiftsForCsv } from "@/lib/export/csv";

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    if (!eventId) {
      return Response.json({ error: "eventId is required." }, { status: 400 });
    }

    const rows = await getShiftsForCsv(eventId);
    const csv = generateShiftsCsv(rows);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="shifts.csv"',
      },
    });
  } catch (error) {
    // getShiftsForCsv calls requireAdmin, which redirects (via a thrown
    // Next.js control-flow signal, not a real error) when the caller is not
    // an admin. unstable_rethrow lets that signal continue propagating so
    // Next.js still turns it into a redirect instead of this catch turning it
    // into a bogus 500.
    unstable_rethrow(error);
    return Response.json({ error: "Unable to export shifts." }, { status: 500 });
  }
}
