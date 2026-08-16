import { AvailabilityManager } from "@/components/availability/availability-manager";
import {
  formatDateInTimeZone,
  formatTimeInTimeZone,
} from "@/lib/availability/time";
import {
  groupMemberAssignmentsByDay,
  type MemberSchedulePageData,
} from "@/lib/member/schedule";
import type { AvailabilityWindow } from "@/lib/availability/data";

type MemberScheduleWorkspaceProps = {
  availabilityWindows: AvailabilityWindow[];
  data: MemberSchedulePageData;
};

function formatHours(hours: number) {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function statusBadgeClass(status: "draft" | "published") {
  return status === "published"
    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
    : "border-warning/35 bg-warning/10 text-warning";
}

function statusLabel(status: "draft" | "published") {
  return status === "published" ? "Published assignment" : "Draft assignment";
}

export function MemberScheduleWorkspace({ availabilityWindows, data }: MemberScheduleWorkspaceProps) {
  const groupedAssignments = groupMemberAssignmentsByDay(data.assignments, data.event.timezone);
  const nextAssignment = data.summary.nextAssignment;
  const isPublished = Boolean(data.publication);

  return (
    <div className="space-y-5">
      <section className="hl-card hl-card-accent rounded-lg p-4 sm:p-5">
        <p className="hl-label text-xs font-semibold">{data.event.name}</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-ink sm:text-3xl">Member Workspace</h2>
            <div className="mt-3 grid gap-3 text-sm text-muted sm:grid-cols-3">
              <p>
                <span className="block font-medium text-ink">October 9-11, 2026</span>
                Operational event window
              </p>
              <p>
                <span className="block font-medium text-ink">Timezone</span>
                {data.event.timezone}
              </p>
              <p>
                <span className="block font-medium text-ink">Schedule status</span>
                {isPublished ? "Published" : "Draft"}
              </p>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
              {isPublished
                ? "This is the official HackLanta II schedule."
                : "Your schedule is still being finalized. Draft assignments may change before the schedule is published."}
            </p>
          </div>
          <span
            className={
              isPublished
                ? "inline-flex w-fit rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold uppercase text-emerald-300"
                : "inline-flex w-fit rounded-md border border-warning/35 bg-warning/10 px-3 py-1.5 text-xs font-semibold uppercase text-warning"
            }
          >
            {isPublished ? "Published Schedule" : "Draft Schedule"}
          </span>
        </div>
      </section>

      <section aria-label="Schedule summary" className="grid gap-3 sm:grid-cols-3">
        <div className="hl-card rounded-lg p-3">
          <p className="text-xs font-medium uppercase text-muted">Assigned shifts</p>
          <p className="mt-1 text-3xl font-semibold text-ink">{data.summary.assignedShiftCount}</p>
        </div>
        <div className="hl-card rounded-lg p-3">
          <p className="text-xs font-medium uppercase text-muted">Scheduled hours</p>
          <p className="mt-1 text-3xl font-semibold text-ink">
            {formatHours(data.summary.assignedHours)}
          </p>
        </div>
        <div className="hl-card rounded-lg p-3">
          <p className="text-xs font-medium uppercase text-muted">Next shift</p>
          {nextAssignment ? (
            <>
              <p className="mt-2 text-lg font-semibold text-ink">{nextAssignment.shift.title}</p>
              <p className="mt-1 text-sm text-muted">
                {formatDateInTimeZone(nextAssignment.shift.starts_at, data.event.timezone)} at{" "}
                {formatTimeInTimeZone(nextAssignment.shift.starts_at, data.event.timezone)}
              </p>
            </>
          ) : (
            <p className="mt-2 text-lg font-semibold text-ink">No shifts assigned</p>
          )}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <section className="space-y-4">
        <div>
          <p className="hl-label text-xs font-semibold">My Schedule</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">When you are scheduled to work.</h2>
        </div>

        {data.assignments.length === 0 ? (
          <div className="hl-card rounded-lg p-6">
            <h3 className="text-lg font-semibold text-ink">No shifts assigned yet</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Your availability has been submitted. Your schedule will appear here when an admin
              assigns you to a shift.
            </p>
          </div>
        ) : (
          groupedAssignments.map((group) =>
            group.assignments.length > 0 ? (
              <div className="space-y-3" key={group.value}>
                <h3 className="text-sm font-semibold uppercase text-muted">{group.label}</h3>
                <div className="grid gap-3">
                  {group.assignments.map((assignment) => (
                    <article className="hl-card rounded-lg p-4" key={assignment.id}>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="hl-label text-xs font-semibold">
                            {assignment.coverageRole?.name ?? "General coverage"}
                          </p>
                          <h4 className="mt-2 text-xl font-semibold text-ink">
                            {assignment.shift.title}
                          </h4>
                          <p className="mt-2 text-sm text-muted">
                            {formatDateInTimeZone(assignment.shift.starts_at, data.event.timezone)} ·{" "}
                            {formatTimeInTimeZone(assignment.shift.starts_at, data.event.timezone)}
                            {" - "}
                            {formatTimeInTimeZone(assignment.shift.ends_at, data.event.timezone)}
                          </p>
                        </div>
                        <span
                          className={`inline-flex w-fit rounded-md border px-3 py-1.5 text-xs font-semibold uppercase ${statusBadgeClass(
                            assignment.status,
                          )}`}
                        >
                          {statusLabel(assignment.status)}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-3 text-sm text-muted sm:grid-cols-2">
                        <p>
                          <span className="block font-medium text-ink">Coverage role</span>
                          {assignment.coverageRole?.name ?? "General coverage"}
                        </p>
                        {assignment.shift.location ? (
                          <p>
                            <span className="block font-medium text-ink">Location</span>
                            {assignment.shift.location}
                          </p>
                        ) : null}
                      </div>

                      {assignment.status === "draft" ? (
                        <p className="mt-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                          Your schedule is still being finalized.
                        </p>
                      ) : null}

                      {assignment.shift.notes ? (
                        <p className="mt-3 text-sm leading-6 text-muted">
                          <span className="font-medium text-ink">Notes: </span>
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
          <p className="hl-label text-xs font-semibold">My Availability</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">When you can work.</h2>
        </div>
        <AvailabilityManager
          event={data.event}
          showEventHeader={false}
          windows={availabilityWindows}
        />
      </aside>
      </div>
    </div>
  );
}
