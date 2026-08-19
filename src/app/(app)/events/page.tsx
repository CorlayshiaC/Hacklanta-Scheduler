import Link from "next/link";
import { Card } from "@/components/ui/neu-card";
import { buttonVariants } from "@/components/ui/neu-button";
import { NeuBadge } from "@/components/ui/neu-badge";
import { ShiftCapsule, type ShiftCapsuleState } from "@/components/ui/shift-capsule";
import { EventsTimeline } from "@/components/events/events-timeline";
import { requireOrganizer } from "@/lib/auth/authorization";
import { listEvents } from "@/lib/scheduling/data";
import { formatShiftDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

const STATUS_VARIANT = { draft: "warning", published: "purple", archived: "default" } as const;

function coverageState(filled: number, required: number): ShiftCapsuleState {
  if (filled >= required && required > 0) return "full";
  if (filled > 0) return "partial";
  return "empty";
}

export default async function EventsPage() {
  await requireOrganizer();
  const events = await listEvents();
  const publishedEvents = events.filter((event) => event.status === "published");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight text-text-primary">Events</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
            Scheduling contexts that group shifts. Publish an event to make its shifts visible to
            members.
          </p>
        </div>
        <Link className={buttonVariants({ variant: "primary" })} href="/events/new">
          Create event
        </Link>
      </div>

      <EventsTimeline events={publishedEvents} />

      {events.length === 0 ? (
        <Card className="text-center">
          <p className="text-sm text-text-secondary">No events yet. Create one to start building shifts.</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((event) => (
            <li key={event.id}>
              <Link href={`/events/${event.id}`}>
                <Card className="flex flex-col gap-3 transition-colors duration-base ease-neu-out hover:bg-elevated/60 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-bold text-text-primary">{event.name}</span>
                      <NeuBadge variant={STATUS_VARIANT[event.status] ?? "default"}>{event.status}</NeuBadge>
                    </div>
                    <p className="mt-1 font-mono text-sm tabular-nums text-text-secondary">
                      {formatShiftDate(event.startsAt, event.timezone)} to {formatShiftDate(event.endsAt, event.timezone)}
                    </p>
                  </div>
                  <ShiftCapsule
                    aria-label={`${event.coverage.filled} of ${event.coverage.required} slots filled`}
                    filled={event.coverage.filled}
                    needed={event.coverage.required}
                    size="md"
                    state={coverageState(event.coverage.filled, event.coverage.required)}
                  />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
