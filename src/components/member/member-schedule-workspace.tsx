import Link from "next/link";
import { AvailabilityManager } from "@/components/availability/availability-manager";
import { Card } from "@/components/ui/neu-card";
import { StatBlock } from "@/components/ui/stat-block";
import { buttonVariants as pillButtonVariants } from "@/components/ui/neu-button";
import { formatDateInTimeZone, formatTimeInTimeZone } from "@/lib/availability/time";
import { groupMemberAssignmentsByDay, type MemberSchedulePageData } from "@/lib/member/schedule";
import type { AvailabilityWindow } from "@/lib/availability/data";

type MemberScheduleWorkspaceProps = {
  availabilityWindows: AvailabilityWindow[];
  calendarUrl: string | null;
  data: MemberSchedulePageData;
};

function formatHours(hours: number) {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function statusPillClass(status: "draft" | "published") {
  return status === "published" ? "bg-accent-go text-on-accent" : "bg-accent-warn text-on-accent";
}

function statusLabel(status: "draft" | "published") {
  return status === "published" ? "Confirmed" : "Pending";
}

/** "3d 4h" down to the minute, then "Starting now" once the shift has begun. */
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

export function MemberScheduleWorkspace({ availabilityWindows, calendarUrl, data }: MemberScheduleWorkspaceProps) {
  const groupedAssignments = groupMemberAssignmentsByDay(data.assignments, data.event);
  const nextAssignment = data.summary.nextAssignment;
  const isPublished = Boolean(data.publication);
  const daysWithAssignment = new Set(
    data.assignments.map((assignment) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: data.event.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
        new Date(assignment.shift.starts_at),
      ),
    ),
  );

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-go">{data.event.name}</p>
            {nextAssignment ? (
              <>
                <span className="mt-2 inline-flex w-fit items-center rounded-pill bg-elevated px-2.5 py-1 text-xs font-semibold uppercase text-text-secondary">
                  {nextAssignment.coverageRole?.name ?? "General coverage"}
                </span>
                <h1 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl">{nextAssignment.shift.title}</h1>
                <p className="mt-2 font-mono text-sm text-text-secondary">
                  {formatDateInTimeZone(nextAssignment.shift.starts_at, data.event.timezone)} at{" "}
                  {formatTimeInTimeZone(nextAssignment.shift.starts_at, data.event.timezone)}
                </p>
                {nextAssignment.shift.location ? (
                  <p className="mt-1 text-sm text-text-secondary">{nextAssignment.shift.location}</p>
                ) : null}
              </>
            ) : (
              <h1 className="mt-2 text-2xl font-semibold text-text-primary sm:text-3xl">No shifts assigned</h1>
            )}
          </div>

          {nextAssignment ? <StatBlock label="Next shift" value={formatCountdown(nextAssignment.shift.starts_at)} /> : null}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {calendarUrl ? (
            <a className={pillButtonVariants({ variant: "primary" })} href={calendarUrl}>
              Add to calendar
            </a>
          ) : null}
          {nextAssignment ? (
            <Link className={pillButtonVariants({ variant: "default" })} href="/swaps">
              Manage swap
            </Link>
          ) : null}
        </div>
      </Card>

      <section aria-label="Schedule summary" className="grid gap-3 sm:grid-cols-3">
        <Card padded={false} className="p-4">
          <StatBlock label="Assigned shifts" value={data.summary.assignedShiftCount} />
        </Card>
        <Card padded={false} className="p-4">
          <StatBlock label="Scheduled hours" value={formatHours(data.summary.assignedHours)} />
        </Card>
        <Card padded={false} className="p-4">
          <p className="text-xs font-medium uppercase text-text-secondary">Schedule status</p>
          <span
            className={`mt-2 inline-flex w-fit items-center rounded-pill px-3 py-1.5 text-xs font-semibold uppercase ${
              isPublished ? "bg-accent-go text-on-accent" : "bg-accent-warn text-on-accent"
            }`}
          >
            {isPublished ? "Published" : "Draft"}
          </span>
        </Card>
      </section>

      <Card title="This week">
        <div className="flex flex-wrap gap-2">
          {groupedAssignments.map((group) => {
            const hasShift = daysWithAssignment.has(group.value);
            return (
              <span
                className={`inline-flex h-9 min-w-[3.5rem] items-center justify-center rounded-pill px-3 font-mono text-xs ${
                  hasShift ? "bg-accent-go text-on-accent" : "bg-elevated text-text-muted"
                }`}
                key={group.value}
              >
                {new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", day: "numeric" }).format(
                  new Date(`${group.value}T12:00:00Z`),
                )}
              </span>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-go">My schedule</p>
            <h2 className="mt-2 text-2xl font-semibold text-text-primary">When you are scheduled to work.</h2>
          </div>

          {data.assignments.length === 0 ? (
            <Card>
              <h3 className="text-lg font-semibold text-text-primary">No shifts assigned yet</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
                Your availability has been submitted. Your schedule will appear here once an organizer assigns you
                to a shift.
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
                          <span
                            className={`inline-flex w-fit items-center rounded-pill px-3 py-1.5 text-xs font-semibold uppercase ${statusPillClass(
                              assignment.status,
                            )}`}
                          >
                            {statusLabel(assignment.status)}
                          </span>
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

                        {assignment.status === "draft" ? (
                          <p className="mt-3 rounded-card bg-elevated p-3 text-sm text-accent-warn">
                            Your schedule is still being finalized.
                          </p>
                        ) : null}

                        {assignment.shift.notes ? (
                          <p className="mt-3 text-sm leading-6 text-text-secondary">
                            <span className="font-medium text-text-primary">Notes: </span>
                            {assignment.shift.notes}
                          </p>
                        ) : null}
                      </Card>
                    ))}
                  </div>
                </div>
              ) : null,
            )
          )}
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
