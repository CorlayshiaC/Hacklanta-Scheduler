import Link from "next/link";
import { Card } from "@/components/ui/neu-card";
import { NeuBadge } from "@/components/ui/neu-badge";
import { ShiftCapsule, type ShiftCapsuleState } from "@/components/ui/shift-capsule";
import { requireOrganizer } from "@/lib/auth/authorization";
import { listEvents } from "@/lib/scheduling/data";

export const dynamic = "force-dynamic";

const STATUS_VARIANT = { draft: "warning", published: "purple", archived: "default" } as const;

function coverageState(filled: number, required: number): ShiftCapsuleState {
  if (filled >= required && required > 0) return "full";
  if (filled > 0) return "partial";
  return "empty";
}

/** Landing page for the "Coverage" nav item: coverage is inherently per-event, so this just picks one. */
export default async function CoverageIndexPage() {
  await requireOrganizer();
  const events = await listEvents();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold uppercase tracking-tight text-text-primary">Coverage</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
          Choose an event to open its coverage board.
        </p>
      </div>

      {events.length === 0 ? (
        <Card className="text-center">
          <p className="text-sm text-text-secondary">
            No events yet. Officers can create one from the Events page.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((event) => (
            <li key={event.id}>
              <Link href={`/coverage/${event.id}`}>
                <Card className="flex items-center justify-between gap-3 transition-colors duration-base ease-neu-out hover:bg-elevated/60">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-text-primary">{event.name}</span>
                    <NeuBadge variant={STATUS_VARIANT[event.status] ?? "default"}>{event.status}</NeuBadge>
                  </div>
                  <ShiftCapsule
                    aria-label={`${event.coverage.filled} of ${event.coverage.required} shifts filled`}
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
