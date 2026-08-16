import Link from "next/link";
import { notFound } from "next/navigation";
import { NeuCard } from "@/components/ui/neu-card";
import { CoverageBoard } from "@/components/coverage/coverage-board";
import { requireOrganizer } from "@/lib/scheduling/authorization";
import { getCoverageBoardData, getRosterForEvent } from "@/lib/scheduling/data";

export const dynamic = "force-dynamic";

type CoveragePageProps = {
  params: Promise<{ eventId: string }>;
};

export default async function CoveragePage({ params }: CoveragePageProps) {
  await requireOrganizer();
  const { eventId } = await params;
  const board = await getCoverageBoardData(eventId);

  if (!board) {
    notFound();
  }

  const roster = await getRosterForEvent(eventId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link className="text-sm font-medium text-purple-400" href={`/events/${eventId}`}>
          {board.event.name}
        </Link>
        <h1 className="mt-2 text-3xl font-semibold text-text-primary">Coverage board</h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          {board.summary.filled} of {board.summary.required} slots filled. Select a cell to assign
          or unassign a member.
        </p>
        {/* TODO(agent-6): presence dots slot goes here once realtime lands. */}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <CoverageBoard cells={board.cells} roster={roster} />
        <NeuCard className="h-fit">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Roster</h2>
          {roster.length === 0 ? (
            <p className="mt-2 text-sm text-text-secondary">No active members yet.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {roster.map((member) => (
                <li className="flex items-center justify-between text-sm" key={member.profileId}>
                  <span className="text-text-primary">{member.fullName}</span>
                  <span className={`font-mono text-xs tabular-nums ${member.overMax ? "text-danger" : "text-text-secondary"}`}>
                    {member.assignedHours}h{member.maxHours !== null ? ` / ${member.maxHours}h` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </NeuCard>
      </div>
    </div>
  );
}
