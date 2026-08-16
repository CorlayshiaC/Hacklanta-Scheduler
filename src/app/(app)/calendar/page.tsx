import Link from "next/link";
import { NeuCard } from "@/components/ui/neu-card";
import { requireOrganizer } from "@/lib/scheduling/authorization";
import { listUpcomingShifts } from "@/lib/scheduling/data";

export const dynamic = "force-dynamic";

// TODO(agent-1): agenda view only. Week grid (time columns, now-line, drag to move/resize with
// 15-minute snap) and month view are the next unit of work, gated on GridCell composition and
// @dnd-kit (not installed yet, requested in docs/contracts/requests.md). URL-held view state
// (`?view=week|agenda`), `t` for today, and arrow-key paging land alongside the week grid.

function dayKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

function dayLabel(iso: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(new Date(iso));
}

export default async function CalendarPage() {
  await requireOrganizer();
  const shifts = await listUpcomingShifts();

  const byDay = new Map<string, typeof shifts>();
  for (const shift of shifts) {
    const key = dayKey(shift.startsAt);
    const rows = byDay.get(key) ?? [];
    rows.push(shift);
    byDay.set(key, rows);
  }
  const days = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold text-text-primary">Calendar</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
          Every shift across every event, agenda style. Week and month views land once the coverage
          board&apos;s grid composition is further along.
        </p>
      </div>

      {days.length === 0 ? (
        <NeuCard className="p-8 text-center">
          <p className="text-sm text-text-secondary">No shifts yet. Officers can generate them from an event page.</p>
        </NeuCard>
      ) : (
        <div className="flex flex-col gap-6">
          {days.map(([key, dayShifts]) => (
            <section key={key}>
              <h2 className="sticky top-0 bg-bg-base py-1 font-mono text-sm font-semibold text-text-primary">
                {dayLabel(dayShifts[0]!.startsAt)}
              </h2>
              <ul className="mt-2 flex flex-col gap-2">
                {dayShifts.map((shift) => (
                  <li key={shift.id}>
                    <NeuCard className="flex items-center justify-between">
                      <div>
                        {shift.eventId ? (
                          <Link
                            className="text-sm font-semibold text-text-primary hover:text-purple-400"
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
                      <p className="font-mono text-xs tabular-nums text-text-secondary">
                        {new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(
                          new Date(shift.startsAt),
                        )}
                        {" - "}
                        {new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(
                          new Date(shift.endsAt),
                        )}
                        {" · "}
                        {shift.headcountAssigned}/{shift.headcountRequired}
                      </p>
                    </NeuCard>
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
