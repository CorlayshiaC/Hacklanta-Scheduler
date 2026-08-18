import Link from "next/link";
import { AvailabilityManager } from "@/components/availability/availability-manager";
import { RequestChangeSheet } from "@/components/availability/request-change-sheet";
import { QuickchatRow } from "@/components/quickchat";
import { Card } from "@/components/ui/neu-card";
import { StatBlock } from "@/components/ui/stat-block";
import { StatusPill, type StatusPillState } from "@/components/ui/status-pill";
import { buttonVariants as pillButtonVariants } from "@/components/ui/neu-button";
import { formatDateInTimeZone, formatTimeInTimeZone } from "@/lib/availability/time";
import { groupMemberAssignmentsByDay, type MemberSchedulePageData } from "@/lib/member/schedule";
import type { AvailabilityWindow } from "@/lib/availability/data";
import type { RosterMember } from "@/lib/change-requests/data";

type MemberScheduleWorkspaceProps = {
  availabilityWindows: AvailabilityWindow[];
  calendarUrl: string | null;
  data: MemberSchedulePageData;
  roster: RosterMember[];
};

function formatHours(hours: number) {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

/** "3d 4h" down to the minute, then "Now" once the shift has begun. */
function formatCountdown(targetIso: string): string {
  const diffMs = new Date(targetIso).getTime() - Date.now();
  if (diffMs <= 0) return "Now";

  const totalMinutes = Math.floor(diffMs / (60 * 1000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function MemberScheduleWorkspace({ availabilityWindows, calendarUrl, data, roster }: MemberScheduleWorkspaceProps) {
  const groupedAssignments = groupMemberAssignmentsByDay(data.assignments, data.event);
  const nextAssignment = data.summary.nextAssignment;
  const dateRange = `${formatDateInTimeZone(data.event.starts_at, data.event.timezone)} to ${formatDateInTimeZone(
    data.event.ends_at,
    data.event.timezone,
  )}`;
  const upcomingStatus: StatusPillState = nextAssignment?.state ?? "not_assigned";

  return (
    <div className="space-y-5">
      {/* Dashboard: exactly these four regions plus a quickchat row (Agent 6 mounts it, see
          docs/contracts/requests.md), per the V2 shared brief's "ruthless declutter" note. */}
      <Card menuSlot={<StatusPill state={upcomingStatus} />} title="Upcoming event">
        <h1 className="text-2xl font-semibold text-text-primary sm:text-3xl">{data.event.name}</h1>
        <p className="mt-2 font-mono text-sm text-text-secondary">{dateRange}</p>
        {data.event.location ? <p className="mt-1 text-sm text-text-secondary">{data.event.location}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {calendarUrl ? (
            <a className={pillButtonVariants({ variant: "primary" })} href={calendarUrl}>
              Add to calendar
            </a>
          ) : null}
          {nextAssignment ? (
            <RequestChangeSheet
              assignment={{ id: nextAssignment.id, shiftTitle: nextAssignment.shift.title }}
              eventId={data.event.id}
              roster={roster}
            />
          ) : null}
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card title="Next shift">
          {nextAssignment ? (
            <>
              <span className="inline-flex w-fit items-center rounded-pill bg-elevated px-2.5 py-1 text-xs font-semibold uppercase text-text-secondary">
                {nextAssignment.coverageRole?.name ?? "General coverage"}
              </span>
              <p className="mt-2 font-mono text-2xl font-bold text-text-primary">{formatCountdown(nextAssignment.shift.starts_at)}</p>
              <p className="mt-1 text-sm text-text-secondary">{nextAssignment.shift.title}</p>
              {nextAssignment.shift.location ? <p className="mt-1 text-sm text-text-secondary">{nextAssignment.shift.location}</p> : null}
            </>
          ) : (
            <p className="text-sm text-text-secondary">No shift scheduled yet.</p>
          )}
        </Card>

        <Card title="Hours for next event">
          <StatBlock animated label="This event" value={formatHours(data.hours.event)} />
          <p className="mt-3 font-mono text-sm text-text-secondary">
            {formatHours(data.hours.semester)}h <span className="text-xs uppercase tracking-wide text-text-muted">Semester total</span>
          </p>
        </Card>

        <Card title="Schedule status">
          <StatusPill state={upcomingStatus} />
          <p className="mt-2 text-sm text-text-secondary">
            {upcomingStatus === "approved"
              ? "Your next shift is confirmed."
              : upcomingStatus === "in_approval"
                ? "Waiting on approval."
                : "No shift assigned yet."}
          </p>
        </Card>
      </section>

      {/* TODO(agent-3/agent-1): swap this row for the real EventsTimeline once it's published
          under components/ui/ (currently components/coverage/timeline-track.tsx, Agent 3's
          territory; importing across owned directories is fragile, see requests.md). Local
          stand-in kept minimal on purpose. */}

      <QuickchatRow />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-go">My schedule</p>
            <h2 className="mt-2 text-2xl font-semibold text-text-primary">When you are scheduled to work.</h2>
          </div>

          {data.assignments.length > 0 ? (
            <Card padded={false} className="overflow-x-auto p-3">
              <div className="flex gap-2">
                {data.assignments.map((assignment) => (
                  <span
                    className={`inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill px-3 font-mono text-xs ${
                      assignment.state === "approved"
                        ? "bg-accent-go text-on-accent"
                        : "border border-accent-warn text-accent-warn"
                    }`}
                    key={assignment.id}
                  >
                    {formatDateInTimeZone(assignment.shift.starts_at, data.event.timezone)}
                  </span>
                ))}
              </div>
            </Card>
          ) : null}

          {data.assignments.length === 0 ? (
            <Card>
              <h3 className="text-lg font-semibold text-text-primary">No shifts assigned yet</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
                Your availability has been submitted. Your schedule will appear here once a director or admin
                assigns you to a shift.
              </p>
            </Card>
          ) : (
            groupedAssignments.map((group) =>
              group.assignments.length > 0 ? (
                <div className="space-y-3" key={group.value}>
                  <h3 className="text-sm font-semibold uppercase text-text-secondary">{group.label}</h3>
                  <div className="grid gap-3">
                    {group.assignments.map((assignment) => (
                      <Card key={assignment.id} padded={false} className="p-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-accent-go">
                              {assignment.coverageRole?.name ?? "General coverage"}
                            </p>
                            <h4 className="mt-2 text-xl font-semibold text-text-primary">{assignment.shift.title}</h4>
                            <p className="mt-2 font-mono text-sm text-text-secondary">
                              {formatDateInTimeZone(assignment.shift.starts_at, data.event.timezone)} ·{" "}
                              {formatTimeInTimeZone(assignment.shift.starts_at, data.event.timezone)}
                              {" - "}
                              {formatTimeInTimeZone(assignment.shift.ends_at, data.event.timezone)}
                            </p>
                          </div>
                          <StatusPill state={assignment.state} />
                        </div>

                        <div className="mt-3 grid gap-3 text-sm text-text-secondary sm:grid-cols-2">
                          <p>
                            <span className="block font-medium text-text-primary">Coverage role</span>
                            {assignment.coverageRole?.name ?? "General coverage"}
                          </p>
                          {assignment.shift.location ? (
                            <p>
                              <span className="block font-medium text-text-primary">Location</span>
                              {assignment.shift.location}
                            </p>
                          ) : null}
                        </div>

                        {assignment.state === "in_approval" ? (
                          <p className="mt-3 rounded-card bg-elevated p-3 text-sm text-accent-warn">Waiting on approval.</p>
                        ) : null}

                        {assignment.shift.notes ? (
                          <p className="mt-3 text-sm leading-6 text-text-secondary">
                            <span className="font-medium text-text-primary">Notes: </span>
                            {assignment.shift.notes}
                          </p>
                        ) : null}

                        <div className="mt-3">
                          <RequestChangeSheet
                            assignment={{ id: assignment.id, shiftTitle: assignment.shift.title }}
                            eventId={data.event.id}
                            roster={roster}
                            trigger={
                              <button className={pillButtonVariants({ variant: "ghost", size: "sm" })} type="button">
                                Request a change
                              </button>
                            }
                          />
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : null,
            )
          )}

          <Link className="text-sm font-medium text-accent-go hover:underline" href="/swaps">
            View swap board and change requests
          </Link>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-go">My availability</p>
            <h2 className="mt-1 text-xl font-semibold text-text-primary">When you can work.</h2>
          </div>
          <AvailabilityManager event={data.event} showEventHeader={false} windows={availabilityWindows} />
        </aside>
      </div>
    </div>
  );
}
