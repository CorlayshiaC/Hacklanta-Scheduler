import Link from "next/link";
import { Card } from "@/components/ui/neu-card";
import { ShiftCapsule, type ShiftCapsuleState } from "@/components/ui/shift-capsule";
import { requireOrganizer } from "@/lib/auth/authorization";
import { listUpcomingShifts } from "@/lib/scheduling/data";

export const dynamic = "force-dynamic";

// TODO(agent-1): agenda view only. Week grid (time columns, now-line, drag to move/resize with
// 15-minute snap) and month view are the next unit of work, gated on GridCell composition and
// @dnd-kit (not installed yet, requested in docs/contracts/requests.md). URL-held view state
// (`?view=week|agenda`), `t` for today, and arrow-key paging land alongside the week grid.

// Groups and labels by the owning event's timezone, not the server's ambient one: a shift at
// 11:30pm America/New_York is still "today" there even when the server runs in UTC. Standalone
// shifts (timezone: null) have no per-shift timezone yet (schema-requests.md), so those still
// render in the server's default until that lands.
function dayKey(iso: string, timeZone: string | null) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timeZone ?? undefined,
  }).format(new Date(iso));
}

function dayLabel(iso: string, timeZone: string | null) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: timeZone ?? undefined,
  }).format(new Date(iso));
}

function timeLabel(iso: string, timeZone: string | null) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: timeZone ?? undefined }).format(
    new Date(iso),
  );
}

function capsuleState(filled: number, needed: number): ShiftCapsuleState {
  if (filled >= needed && needed > 0) return "full";
  if (filled > 0) return "partial";
  return "empty";
}

export default async function CalendarPage() {
  await requireOrganizer();
  const shifts = await listUpcomingShifts();

  const byDay = new Map<string, typeof shifts>();
  for (const shift of shifts) {
    const key = dayKey(shift.startsAt, shift.timezone);
    const rows = byDay.get(key) ?? [];
    rows.push(shift);
    byDay.set(key, rows);
  }
  const days = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold uppercase tracking-tight text-text-primary">Calendar</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
          Every shift across every event, agenda style. Week and month views land once the coverage
          board&apos;s grid composition is further along.
        </p>
      </div>

      {days.length === 0 ? (
        <Card className="text-center">
          <p className="text-sm text-text-secondary">No shifts yet. Officers can generate them from an event page.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {days.map(([key, dayShifts]) => (
            <section key={key}>
              <h2 className="sticky top-0 z-10 bg-app py-1 font-mono text-sm font-semibold uppercase tracking-wide text-text-primary">
                {dayLabel(dayShifts[0]!.startsAt, dayShifts[0]!.timezone)}
              </h2>
              <ul className="mt-2 flex flex-col gap-2">
                {dayShifts.map((shift) => (
                  <li key={shift.id}>
                    <Card className="flex items-center justify-between gap-4 p-4" padded={false}>
                      <div className="min-w-0">
                        {shift.eventId ? (
                          <Link
                            className="text-sm font-semibold text-text-primary hover:text-accent-go"
                            href={`/coverage/${shift.eventId}`}
                          >
                            {shift.title}
                          </Link>
                        ) : (
                          <p className="text-sm font-semibold text-text-primary">{shift.title}</p>
                        )}
                        <p className="text-xs text-text-secondary">
                          {shift.eventName}
                          {shift.station ? ` · ${shift.station}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <p className="font-mono text-xs tabular-nums text-text-secondary">
                          {timeLabel(shift.startsAt, shift.timezone)}
                          {" - "}
                          {timeLabel(shift.endsAt, shift.timezone)}
                        </p>
                        <ShiftCapsule
                          aria-label={`${shift.headcountAssigned} of ${shift.headcountRequired} filled`}
                          filled={shift.headcountAssigned}
                          needed={shift.headcountRequired}
                          size="sm"
                          state={capsuleState(shift.headcountAssigned, shift.headcountRequired)}
                        />
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
