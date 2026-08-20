import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/neu-card";
import { buttonVariants } from "@/components/ui/neu-button";
import { NeuBadge } from "@/components/ui/neu-badge";
import { Hero } from "@/components/illustration/hero";
import { HeroEntrance } from "@/components/events/hero-entrance";
import { PageFadeIn } from "@/components/events/page-fade-in";
import { GenerateShiftsForm } from "@/components/shifts/generate-shifts-form";
import { PublishEventButton } from "@/components/events/publish-event-button";
import { AnnouncementsFeed } from "@/components/events/announcements-feed";
import { DirectorAssignment } from "@/components/events/director-assignment";
import { requireOrganizer } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCoverageBoardData, getEventDirectors, listDirectorCandidates } from "@/lib/scheduling/data";

export const dynamic = "force-dynamic";

const STATUS_VARIANT = { draft: "warning", published: "purple", archived: "default" } as const;

type EventDetailPageProps = {
  params: Promise<{ id: string }>;
};

type AnnouncementRow = {
  id: string;
  body: string;
  created_at: string;
  profiles: { full_name: string | null; email: string } | null;
};

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const context = await requireOrganizer();
  const { id } = await params;
  const board = await getCoverageBoardData(id);

  if (!board) {
    notFound();
  }

  const { event, stations, summary } = board;

  const supabase = await createSupabaseServerClient();
  const { data: announcementRows } = await supabase
    .from("announcements")
    .select("id,body,created_at,profiles!announcements_author_id_fkey(full_name,email)")
    .eq("event_id", event.id)
    .order("created_at", { ascending: false });
  // The Supabase client's select-string literal type inference does not resolve reliably in this
  // project (same workaround used in src/lib/auth/authorization.ts and src/app/(app)/settings/page.tsx).
  const announcements = ((announcementRows ?? []) as unknown as AnnouncementRow[]).map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    authorName: row.profiles?.full_name?.trim() || row.profiles?.email || "Unknown",
  }));

  const isAdmin = context.profile.role === "admin";
  const [currentDirectors, directorCandidates] = await Promise.all([
    getEventDirectors(event.id),
    listDirectorCandidates(),
  ]);

  return (
    <PageFadeIn>
    <div className="flex flex-col gap-6">
      <Link className="text-sm font-medium text-accent-go" href="/events">
        Events
      </Link>

      <Hero>
        <HeroEntrance>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-4xl font-bold normal-case tracking-tight text-text-primary">{event.name}</h1>
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
            <p className="mt-1 font-mono text-sm text-text-secondary">{event.timezone}</p>
            {event.description ? <p className="mt-2 max-w-xl text-sm text-text-primary">{event.description}</p> : null}
            {event.location ? <p className="mt-1 text-sm text-text-primary">{event.location}</p> : null}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-elevated px-3 py-1.5 text-xs">
                <span className="font-mono text-sm font-semibold tabular-nums text-text-primary">
                  {summary.filled}/{summary.required}
                </span>
                <span className="text-text-secondary">slots filled</span>
              </span>
            </div>
          </div>
          {event.status === "draft" ? <PublishEventButton eventId={event.id} /> : null}
        </div>
        </HeroEntrance>
      </Hero>

      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Coverage board</h2>
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

      <Card title="Announcements">
        <AnnouncementsFeed announcements={announcements} eventId={event.id} />
      </Card>

      {isAdmin ? (
        <Card title="Directors">
          <DirectorAssignment candidates={directorCandidates} currentDirectors={currentDirectors} eventId={event.id} />
        </Card>
      ) : null}
    </div>
    </PageFadeIn>
  );
}
