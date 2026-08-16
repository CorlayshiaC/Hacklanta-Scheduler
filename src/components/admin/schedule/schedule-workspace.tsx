import Link from "next/link";
import { ShiftManagement } from "@/components/admin/shifts/shift-management";
import {
  getHealthStatus,
  getMemberWorkloads,
  getNeedsAttentionItems,
  getScheduleSummary,
} from "@/lib/admin/schedule/metrics";
import type { AdminShiftPageData } from "@/lib/admin/shifts/data";
import type { ScheduleReviewData } from "@/lib/admin/schedule/review";
import {
  formatDateInTimeZone,
  formatTimeInTimeZone,
} from "@/lib/availability/time";

type ScheduleWorkspaceProps = {
  data: AdminShiftPageData;
  filters: {
    coverageRoleId: string;
    date: string;
    staffingStatus: string;
  };
  review: ScheduleReviewData;
};

function formatHours(hours: number) {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function healthLabel(status: ReturnType<typeof getHealthStatus>) {
  if (status === "blocking") {
    return "Blocking issue";
  }

  if (status === "warning") {
    return "Needs attention";
  }

  return "Healthy";
}

function healthClass(status: ReturnType<typeof getHealthStatus>) {
  if (status === "blocking") {
    return "border-danger/35 bg-danger/10 text-danger";
  }

  if (status === "warning") {
    return "border-warning/35 bg-warning/10 text-warning";
  }

  return "border-signal/35 bg-signal/10 text-signal";
}

function workloadClass(status: string) {
  if (status === "exceeds") {
    return "border-danger/35 bg-danger/10 text-danger";
  }

  if (status === "approaching") {
    return "border-warning/35 bg-warning/10 text-warning";
  }

  return "border-signal/35 bg-signal/10 text-signal";
}

export function ScheduleWorkspace({ data, filters, review }: ScheduleWorkspaceProps) {
  const summary = getScheduleSummary(data.shifts);
  const blockers = review.issues.filter((issue) => issue.severity === "blocker");
  const warnings = review.issues.filter((issue) => issue.severity === "warning");
  const healthStatus = getHealthStatus({
    blockerCount: blockers.length,
    openPositions: review.summary.openPositions,
    partiallyStaffed: review.summary.partiallyStaffedShifts,
    unstaffed: review.summary.unstaffedShifts,
  });
  const workloads = getMemberWorkloads(data.shifts, data.memberSettings);
  const attentionItems = getNeedsAttentionItems(data.shifts);

  return (
    <div className="space-y-5">
      <section className="hl-card rounded-lg p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold text-ink">{data.event.name}</h2>
              <span className="rounded-md bg-warning/10 px-2.5 py-1 text-xs font-semibold uppercase text-warning">
                Draft
              </span>
            </div>
            <div className="mt-3 grid gap-3 text-sm text-muted sm:grid-cols-3">
              <p><span className="block font-medium text-ink">Dates</span>October 9-11, 2026</p>
              <p><span className="block font-medium text-ink">Timezone</span>{data.event.timezone}</p>
              <p><span className="block font-medium text-ink">Window</span>Fri 7:00 AM - Sun 3:00 PM</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              className="hl-button-secondary inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold"
              href="/admin/schedule/review"
            >
              Review & Publish
            </Link>
            <Link
              className="hl-button-primary inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold"
              href="#create-shift"
            >
              + Create Shift
            </Link>
          </div>
        </div>
      </section>

      <section className={`rounded-lg border p-4 ${healthClass(healthStatus)}`}>
        <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.6fr)_minmax(0,1.4fr)_auto] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase">Schedule Health</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">{healthLabel(healthStatus)}</h2>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["Blockers", blockers.length],
              ["Warnings", warnings.length],
              ["Open", summary.openPositions],
            ].map(([label, value]) => (
              <div className="rounded-md border border-line bg-panel/60 p-2 text-center" key={label}>
                <p className="text-xl font-semibold text-ink">{value}</p>
                <p className="text-[11px] font-semibold uppercase text-muted">{label}</p>
              </div>
            ))}
          </div>
          <Link
            className="hl-button-secondary inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold"
            href="/admin/schedule/review"
          >
            Open Review
          </Link>
        </div>
      </section>

      <section aria-label="Schedule summary" className="grid gap-3 sm:grid-cols-4">
        {[
          ["Total shifts", summary.totalShifts],
          ["Fully staffed", summary.fullyStaffed],
          ["Partially staffed", summary.partiallyStaffed],
          ["Unstaffed", summary.unstaffed],
          ["Required positions", summary.totalRequiredAssignments],
          ["Assigned positions", summary.totalAssignedAssignments],
          ["Draft assignments", summary.totalDraftAssignments],
          ["Published assignments", summary.totalPublishedAssignments],
        ].map(([label, value]) => (
          <div className="hl-card rounded-lg p-3 shadow-sm" key={label}>
            <p className="text-xs font-medium uppercase text-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
          </div>
        ))}
      </section>

      <form className="grid gap-3 hl-card rounded-lg p-4 lg:grid-cols-[180px_1fr_200px_auto]">
        <label className="sr-only" htmlFor="schedule-date-filter">
          Date
        </label>
        <select
          className="hl-input h-10 rounded-md px-3 text-sm"
          defaultValue={filters.date}
          id="schedule-date-filter"
          name="date"
        >
          <option value="">All dates</option>
          <option value="2026-10-09">Friday</option>
          <option value="2026-10-10">Saturday</option>
          <option value="2026-10-11">Sunday</option>
        </select>
        <label className="sr-only" htmlFor="schedule-coverage-role-filter">
          Coverage role
        </label>
        <select
          className="hl-input h-10 rounded-md px-3 text-sm"
          defaultValue={filters.coverageRoleId}
          id="schedule-coverage-role-filter"
          name="coverageRoleId"
        >
          <option value="">All coverage roles</option>
          {data.coverageRoles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="schedule-staffing-filter">
          Staffing
        </label>
        <select
          className="hl-input h-10 rounded-md px-3 text-sm"
          defaultValue={filters.staffingStatus}
          id="schedule-staffing-filter"
          name="staffingStatus"
        >
          <option value="">All staffing</option>
          <option value="unstaffed">Unstaffed</option>
          <option value="partially_staffed">Partially staffed</option>
          <option value="fully_staffed">Fully staffed</option>
        </select>
        <button
          className="hl-button-secondary rounded-md px-4 py-2 text-sm font-semibold"
          type="submit"
        >
          Filter
        </button>
      </form>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="min-w-0 space-y-4">
          <ShiftManagement
            candidatesByShiftRole={data.candidatesByShiftRole}
            coverageRoles={data.coverageRoles}
            eventTimezone={data.event.timezone}
            returnPath="/admin/schedule"
            shifts={data.shifts}
            shiftRoles={data.shiftRoles}
          />
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4">
        <section className="hl-card rounded-lg p-4 shadow-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <h2 className="text-lg font-semibold text-ink">Needs Attention</h2>
            <p className="text-sm text-muted">
              {summary.unstaffed} unstaffed shifts · {summary.openPositions} open positions
            </p>
          </div>
          {attentionItems.length > 0 ? (
            <>
            <ul className="mt-4 space-y-2">
              {attentionItems.slice(0, 8).map((item) => (
                <li key={`${item.shift.id}-${item.coverageRoleName ?? "general"}`}>
                  <a
                    className="flex flex-col gap-1 rounded-md border border-line p-3 text-sm transition hover:border-signal/40 hover:bg-field sm:flex-row sm:items-center sm:justify-between"
                    href={`#${item.shift.id}`}
                  >
                    <span>
                      <span className="block font-semibold uppercase text-ink">{item.shift.title}</span>
                      <span className="block text-muted">
                        {item.coverageRoleName ?? "General coverage"} ·{" "}
                        {formatDateInTimeZone(item.shift.starts_at, data.event.timezone)} ·{" "}
                        {formatTimeInTimeZone(item.shift.starts_at, data.event.timezone)}-
                        {formatTimeInTimeZone(item.shift.ends_at, data.event.timezone)}
                      </span>
                    </span>
                    <span className="text-warning">
                      {item.currentStaffing}/{item.requiredStaffing} staffed ·{" "}
                      {item.openPositions} open
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            {attentionItems.length > 8 ? (
              <p className="mt-3 text-xs text-muted">{attentionItems.length - 8} more attention item{attentionItems.length - 8 === 1 ? "" : "s"} in the shift list.</p>
            ) : null}
            </>
          ) : (
            <p className="mt-4 rounded-md border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-300">
              No positions open in the current view.
            </p>
          )}
        </section>

        <section className="hl-card rounded-lg p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-ink">Member Workload</h2>
          {workloads.length > 0 ? (
            <>
            <ul className="mt-4 space-y-3">
              {workloads.slice(0, 6).map((workload) => (
                <li className="rounded-md border border-line p-3" key={workload.profileId}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{workload.fullName}</p>
                      <p className="mt-1 text-xs text-muted">
                        {workload.coverageRoles.join(", ") || "General coverage"}
                      </p>
                    </div>
                    <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${workloadClass(workload.workloadStatus)}`}>
                      {workload.maxHours === null
                        ? "No max"
                        : workload.workloadStatus === "exceeds"
                          ? "Over max"
                          : workload.workloadStatus === "approaching"
                            ? "Near max"
                            : "OK"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    {formatHours(workload.assignedHours)} hours · {workload.shiftCount} shift
                    {workload.shiftCount === 1 ? "" : "s"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {workload.maxHours === null
                      ? "Maximum hours not configured"
                      : `${formatHours(workload.remainingHours ?? 0)} hours remaining of ${formatHours(workload.maxHours)} max`}
                  </p>
                </li>
              ))}
            </ul>
            {workloads.length > 6 ? (
              <p className="mt-3 text-xs text-muted">{workloads.length - 6} more member workload{workloads.length - 6 === 1 ? "" : "s"} hidden from this summary.</p>
            ) : null}
            </>
          ) : (
            <p className="mt-4 rounded-lg border border-line bg-elevated/60 p-3 text-sm text-muted">
              No draft assignments yet.
            </p>
          )}
        </section>

      <section className="hl-card rounded-lg p-4 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-lg font-semibold text-ink">Conflict Center</h2>
          <p className="text-sm text-muted">
            {blockers.length} blocker{blockers.length === 1 ? "" : "s"} from the publish review
          </p>
        </div>
        {blockers.length > 0 ? (
          <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {blockers.map((issue) => (
              <li className="rounded-md border border-danger/35 bg-danger/10 p-3" key={issue.id}>
                <p className="text-xs font-semibold uppercase text-danger">
                  {issue.type.replaceAll("_", " ")}
                </p>
                <h3 className="mt-1 text-sm font-semibold text-ink">{issue.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted">{issue.details}</p>
                {issue.entityHref ? (
                  <a className="mt-2 inline-flex text-sm font-semibold text-signal" href={issue.entityHref}>
                    Inspect shift
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-md border border-signal/35 bg-signal/10 p-3 text-sm text-signal">
            No blocking schedule conflicts found.
          </p>
        )}
      </section>
        </aside>
      </div>
    </div>
  );
}
