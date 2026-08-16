import Link from "next/link";
import { notFound } from "next/navigation";
import { NeuCard } from "@/components/ui/neu-card";
import { NeuBadge } from "@/components/ui/neu-badge";
import { buttonVariants } from "@/components/ui/neu-button";
import { GenerateShiftsForm } from "@/components/shifts/generate-shifts-form";
import { PublishEventButton } from "@/components/events/publish-event-button";
import { requireOrganizer } from "@/lib/scheduling/authorization";
import { getCoverageBoardData } from "@/lib/scheduling/data";

export const dynamic = "force-dynamic";

type EventDetailPageProps = {
  params: Promise<{ id: string }>;
};

const STATUS_VARIANT = { draft: "warning", published: "purple", archived: "default" } as const;

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  await requireOrganizer();
  const { id } = await params;
  const board = await getCoverageBoardData(id);

  if (!board) {
    notFound();
  }

  const { event, stations, summary } = board;
  const fillRatio = summary.required > 0 ? Math.round((summary.filled / summary.required) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <Link className="text-sm font-medium text-purple-400" href="/events">
        Events
      </Link>

      <NeuCard className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold text-text-primary">{event.name}</h1>
            <NeuBadge variant={STATUS_VARIANT[event.status] ?? "default"}>{event.status}</NeuBadge>
          </div>
          <p className="mt-2 font-mono text-sm text-text-secondary">
            {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: event.timezone }).format(
              new Date(event.starts_at),
            )}{" "}
            to{" "}
            {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: event.timezone }).format(
              new Date(event.ends_at),
            )}
          </p>
          <p className="mt-1 text-sm text-text-secondary">{event.timezone}</p>
          {event.description ? <p className="mt-2 max-w-xl text-sm text-text-secondary">{event.description}</p> : null}
          {event.location ? <p className="mt-1 text-sm text-text-secondary">{event.location}</p> : null}
          <div className="mt-4 max-w-sm">
            <p className="font-mono text-xs text-text-secondary">
              {summary.filled} of {summary.required} slots filled
            </p>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-bg-sunken shadow-neu-pressed">
              <div className="h-full rounded-full bg-purple-500" style={{ width: `${fillRatio}%` }} />
            </div>
          </div>
        </div>
        {event.status === "draft" ? <PublishEventButton eventId={event.id} /> : null}
      </NeuCard>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-text-primary">Coverage board</h2>
        <Link className={buttonVariants({ variant: "default" })} href={`/coverage/${event.id}`}>
          Open coverage board
        </Link>
      </div>
      <p className="-mt-4 text-sm text-text-secondary">
        {stations.length === 0
          ? "No stations yet. Add one from the shift generator below."
          : `Stations: ${stations.map((station) => station.name).join(", ")}`}
      </p>

      <GenerateShiftsForm
        eventId={event.id}
        eventTimezone={event.timezone}
        stations={stations.map((station) => ({ id: station.id, name: station.name }))}
      />
    </div>
  );
}
