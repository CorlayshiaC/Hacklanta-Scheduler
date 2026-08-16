import Link from "next/link";
import { NeuCard } from "@/components/ui/neu-card";
import { NeuBadge } from "@/components/ui/neu-badge";
import { requireOrganizer } from "@/lib/scheduling/authorization";
import { listEvents } from "@/lib/scheduling/data";

export const dynamic = "force-dynamic";

const STATUS_VARIANT = { draft: "warning", published: "purple", archived: "default" } as const;

/** Landing page for the "Coverage" nav item: coverage is inherently per-event, so this just picks one. */
export default async function CoverageIndexPage() {
  await requireOrganizer();
  const events = await listEvents();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold text-text-primary">Coverage</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
          Choose an event to open its coverage board.
        </p>
      </div>

      {events.length === 0 ? (
        <NeuCard className="p-8 text-center">
          <p className="text-sm text-text-secondary">
            No events yet. Officers can create one from the Events page.
          </p>
        </NeuCard>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((event) => (
            <li key={event.id}>
              <Link href={`/coverage/${event.id}`}>
                <NeuCard className="flex items-center justify-between gap-3 transition-[transform,box-shadow] duration-base ease-neu-out hover:-translate-y-0.5 hover:shadow-neu-raised-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-text-primary">{event.name}</span>
                    <NeuBadge variant={STATUS_VARIANT[event.status] ?? "default"}>{event.status}</NeuBadge>
                  </div>
                  <span className="font-mono text-sm tabular-nums text-text-secondary">
                    {event.coverage.filled}/{event.coverage.required} filled
                  </span>
                </NeuCard>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
