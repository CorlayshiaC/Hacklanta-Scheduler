import Link from "next/link";
import { NeuCard } from "@/components/ui/neu-card";
import { buttonVariants } from "@/components/ui/neu-button";
import { NeuBadge } from "@/components/ui/neu-badge";
import { requireOrganizer } from "@/lib/scheduling/authorization";
import { listEvents } from "@/lib/scheduling/data";

export const dynamic = "force-dynamic";

const STATUS_VARIANT = {
  draft: "warning",
  published: "purple",
  archived: "default",
} as const;

export default async function EventsPage() {
  await requireOrganizer();
  const events = await listEvents();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary">Events</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
            Scheduling contexts that group shifts. Publish an event to make its shifts visible to
            members.
          </p>
        </div>
        <Link className={buttonVariants({ variant: "primary" })} href="/events/new">
          Create event
        </Link>
      </div>

      {events.length === 0 ? (
        <NeuCard className="p-8 text-center">
          <p className="text-sm text-text-secondary">No events yet. Create one to start building shifts.</p>
        </NeuCard>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((event) => (
            <li key={event.id}>
              <Link href={`/events/${event.id}`}>
                <NeuCard className="flex flex-col gap-3 transition-[transform,box-shadow] duration-base ease-neu-out hover:-translate-y-0.5 hover:shadow-neu-raised-lg sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-semibold text-text-primary">{event.name}</span>
                      <NeuBadge variant={STATUS_VARIANT[event.status] ?? "default"}>{event.status}</NeuBadge>
                    </div>
                    <p className="mt-1 font-mono text-sm text-text-secondary">
                      {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(event.startsAt))} to{" "}
                      {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(event.endsAt))}
                    </p>
                  </div>
                  <div className="text-sm text-text-secondary">
                    <span className="font-mono tabular-nums text-text-primary">
                      {event.coverage.filled}/{event.coverage.required}
                    </span>{" "}
                    slots filled
                  </div>
                </NeuCard>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
