import Link from "next/link";
import { buttonVariants } from "@/components/ui/neu-button";
import { Card } from "@/components/ui/neu-card";
import { cn } from "@/lib/utils/cn";
import { HorizontalSchedule } from "@/components/coverage/horizontal-schedule";
import type { PersonScheduleRow } from "@/lib/scheduling/data";
import type { ShiftCell } from "@/lib/scheduling/types";

function dayKey(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).format(new Date(iso));
}

function dayLabel(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone }).format(new Date(iso));
}

/** Single-day slice of the by-person schedule: same HorizontalSchedule, filtered to one day, which
 * naturally reads denser since the visible time range is much shorter. */
export function DayView({
  eventId,
  eventTimezone,
  people,
  unassigned,
  activeDate,
}: {
  eventId: string;
  eventTimezone: string;
  people: PersonScheduleRow[];
  unassigned: ShiftCell[];
  activeDate: string | null;
}) {
  const allStarts = [...people.flatMap((person) => person.assignments.map((a) => a.startsAt)), ...unassigned.map((c) => c.startsAt)];
  const days = Array.from(new Set(allStarts.map((iso) => dayKey(iso, eventTimezone)))).sort();
  const selectedDay = activeDate && days.includes(activeDate) ? activeDate : (days[0] ?? null);

  if (!selectedDay) {
    return (
      <Card className="text-center">
        <p className="text-sm text-text-secondary">No shifts yet. Generate them from the event page.</p>
      </Card>
    );
  }

  const filteredPeople = people
    .map((person) => ({
      ...person,
      assignments: person.assignments.filter((a) => dayKey(a.startsAt, eventTimezone) === selectedDay),
    }))
    .filter((person) => person.assignments.length > 0);
  const filteredUnassigned = unassigned.filter((cell) => dayKey(cell.startsAt, eventTimezone) === selectedDay);

  const starts = [...filteredPeople.flatMap((person) => person.assignments.map((a) => a.startsAt)), ...filteredUnassigned.map((c) => c.startsAt)];
  const ends = [...filteredPeople.flatMap((person) => person.assignments.map((a) => a.endsAt)), ...filteredUnassigned.map((c) => c.endsAt)];
  const windowStart = starts.length > 0 ? new Date(Math.min(...starts.map((s) => new Date(s).getTime()))).toISOString() : null;
  const windowEnd = ends.length > 0 ? new Date(Math.max(...ends.map((s) => new Date(s).getTime()))).toISOString() : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {days.map((day) => (
          <Link
            className={cn(buttonVariants({ variant: day === selectedDay ? "primary" : "default", size: "sm" }))}
            href={`/coverage/${eventId}?view=day&date=${day}`}
            key={day}
          >
            {dayLabel(`${day}T12:00:00`, eventTimezone)}
          </Link>
        ))}
      </div>
      <HorizontalSchedule
        eventTimezone={eventTimezone}
        people={filteredPeople}
        unassigned={filteredUnassigned}
        windowEnd={windowEnd}
        windowStart={windowStart}
      />
    </div>
  );
}
