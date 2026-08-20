import Link from "next/link";
import { notFound } from "next/navigation";
import { CoverageBoard } from "@/components/coverage/coverage-board";
import { HorizontalSchedule } from "@/components/coverage/horizontal-schedule";
import { DayView } from "@/components/coverage/day-view";
import { ListView } from "@/components/coverage/list-view";
import { parseScheduleView, ViewSwitcher } from "@/components/coverage/view-switcher";
import { requireOrganizer } from "@/lib/auth/authorization";
import { flattenPersonScheduleGrid, getCoverageBoardData, getPersonScheduleGrid, getRosterForEvent } from "@/lib/scheduling/data";

export const dynamic = "force-dynamic";

type CoveragePageProps = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ view?: string; date?: string }>;
};

export default async function CoveragePage({ params, searchParams }: CoveragePageProps) {
  await requireOrganizer();
  const { eventId } = await params;
  const { view: viewParam, date } = await searchParams;
  const view = parseScheduleView(viewParam);

  const grid = await getPersonScheduleGrid(eventId);

  if (!grid) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link className="text-sm font-medium text-accent-go" href={`/events/${eventId}`}>
          {grid.event.name}
        </Link>
        <h1 className="mt-2 text-3xl font-bold uppercase tracking-tight text-text-primary">Coverage board</h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          Select a shift to assign or unassign a member, or drag a roster chip onto a capsule.
        </p>
      </div>

      <ViewSwitcher active={view} eventId={eventId} />

      {view === "person" ? (
        <HorizontalSchedule
          eventTimezone={grid.event.timezone}
          people={grid.people}
          unassigned={grid.unassigned}
          windowEnd={grid.windowEnd}
          windowStart={grid.windowStart}
        />
      ) : null}

      {view === "day" ? (
        <DayView
          activeDate={date ?? null}
          eventId={eventId}
          eventTimezone={grid.event.timezone}
          people={grid.people}
          unassigned={grid.unassigned}
        />
      ) : null}

      {view === "list" ? <ListView rows={flattenPersonScheduleGrid(grid)} timeZone={grid.event.timezone} /> : null}

      {view === "station" ? <StationView eventId={eventId} eventTimezone={grid.event.timezone} /> : null}
    </div>
  );
}

/** By-station view: the original v1 coverage board. Owns its own roster fetch since it's the only
 * view that needs it (drag-to-assign source). */
async function StationView({ eventId, eventTimezone }: { eventId: string; eventTimezone: string }) {
  const [board, roster] = await Promise.all([getCoverageBoardData(eventId), getRosterForEvent(eventId)]);

  if (!board) {
    notFound();
  }

  return (
    <CoverageBoard
      cells={board.cells}
      eventName={board.event.name}
      eventTimezone={eventTimezone}
      roster={roster}
      summary={board.summary}
    />
  );
}
