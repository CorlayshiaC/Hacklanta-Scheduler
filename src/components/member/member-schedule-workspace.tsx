import { AvailabilityManager } from "@/components/availability/availability-manager";
import { formatDateInTimeZone, formatTimeInTimeZone } from "@/lib/availability/time";
import { groupMemberAssignmentsByDay, type MemberSchedulePageData } from "@/lib/member/schedule";
import type { AvailabilityWindow } from "@/lib/availability/data";

type MemberScheduleWorkspaceProps = {
  availabilityWindows: AvailabilityWindow[];
  data: MemberSchedulePageData;
};

function formatHours(hours: number) {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function statusBadgeClass(status: "draft" | "published") {
  return status === "published" ? "border-purple-400/40 bg-purple-500/15 text-purple-400" : "border-warning/40 bg-warning/10 text-warning";
}

function statusLabel(status: "draft" | "published") {
  return status === "published" ? "Published assignment" : "Draft assignment";
}

export function MemberScheduleWorkspace({ availabilityWindows, data }: MemberScheduleWorkspaceProps) {
  const groupedAssignments = groupMemberAssignmentsByDay(data.assignments, data.event);
  const nextAssignment = data.summary.nextAssignment;
  const isPublished = Boolean(data.publication);
  const dateRange = `${formatDateInTimeZone(data.event.starts_at, data.event.timezone)} to ${formatDateInTimeZone(
    data.event.ends_at,
    data.event.timezone,
  )}`;

  return (
    <div className="space-y-5">
      <section className="rounded-neu border border-hairline bg-bg-surface p-4 shadow-neu-raised sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-purple-400">{data.event.name}</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">My schedule</h2>
            <div className="mt-3 grid gap-3 text-sm text-text-secondary sm:grid-cols-3">
              <p>
                <span className="block font-medium text-text-primary">{dateRange}</span>
                Event window
              </p>
              <p>
                <span className="block font-medium text-text-primary">Timezone</span>
                {data.event.timezone}
              </p>
              <p>
                <span className="block font-medium text-text-primary">Schedule status</span>
                {isPublished ? "Published" : "Draft"}
              </p>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">
              {isPublished
                ? `This is the published schedule for ${data.event.name}.`
                : "Your schedule is still being finalized. Draft assignments may change before it is published."}
            </p>
          </div>
          <span
            className={
              isPublished
                ? "inline-flex w-fit rounded-neu-sm border border-purple-400/40 bg-purple-500/15 px-3 py-1.5 text-xs font-semibold uppercase text-purple-400"
                : "inline-flex w-fit rounded-neu-sm border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs font-semibold uppercase text-warning"
            }
          >
            {isPublished ? "Published schedule" : "Draft schedule"}
          </span>
        </div>
      </section>

      <section aria-label="Schedule summary" className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-neu border border-hairline bg-bg-surface p-3 shadow-neu-raised-sm">
          <p className="text-xs font-medium uppercase text-text-secondary">Assigned shifts</p>
          <p className="mt-1 font-mono text-3xl font-semibold text-text-primary">{data.summary.assignedShiftCount}</p>
        </div>
        <div className="rounded-neu border border-hairline bg-bg-surface p-3 shadow-neu-raised-sm">
          <p className="text-xs font-medium uppercase text-text-secondary">Scheduled hours</p>
          <p className="mt-1 font-mono text-3xl font-semibold text-text-primary">{formatHours(data.summary.assignedHours)}</p>
        </div>
        <div className="rounded-neu border border-hairline bg-bg-surface p-3 shadow-neu-raised-sm">
          <p className="text-xs font-medium uppercase text-text-secondary">Next shift</p>
          {nextAssignment ? (
            <>
              <p className="mt-2 text-lg font-semibold text-text-primary">{nextAssignment.shift.title}</p>
              <p className="mt-1 font-mono text-sm text-text-secondary">
                {formatDateInTimeZone(nextAssignment.shift.starts_at, data.event.timezone)} at{" "}
                {formatTimeInTimeZone(nextAssignment.shift.starts_at, data.event.timezone)}
              </p>
            </>
          ) : (
            <p className="mt-2 text-lg font-semibold text-text-primary">No shifts assigned</p>
          )}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-400">My schedule</p>
            <h2 className="mt-2 text-2xl font-semibold text-text-primary">When you are scheduled to work.</h2>
          </div>

          {data.assignments.length === 0 ? (
            <div className="rounded-neu border border-hairline bg-bg-sunken p-6 shadow-neu-pressed">
              <h3 className="text-lg font-semibold text-text-primary">No shifts assigned yet</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
                Your availability has been submitted. Your schedule will appear here once an organizer assigns you
                to a shift.
              </p>
            </div>
          ) : (
            groupedAssignments.map((group) =>
              group.assignments.length > 0 ? (
                <div className="space-y-3" key={group.value}>
                  <h3 className="text-sm font-semibold uppercase text-text-secondary">{group.label}</h3>
                  <div className="grid gap-3">
                    {group.assignments.map((assignment) => (
                      <article className="rounded-neu border border-hairline bg-bg-surface p-4 shadow-neu-raised-sm" key={assignment.id}>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-purple-400">
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
                            className={`inline-flex w-fit rounded-neu-sm border px-3 py-1.5 text-xs font-semibold uppercase ${statusBadgeClass(
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
                          <p className="mt-3 rounded-neu-sm border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                            Your schedule is still being finalized.
                          </p>
                        ) : null}

                        {assignment.shift.notes ? (
                          <p className="mt-3 text-sm leading-6 text-text-secondary">
                            <span className="font-medium text-text-primary">Notes: </span>
                            {assignment.shift.notes}
                          </p>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </div>
              ) : null,
            )
          )}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-400">My availability</p>
            <h2 className="mt-1 text-xl font-semibold text-text-primary">When you can work.</h2>
          </div>
          <AvailabilityManager event={data.event} showEventHeader={false} windows={availabilityWindows} />
        </aside>
      </div>
    </div>
  );
}
