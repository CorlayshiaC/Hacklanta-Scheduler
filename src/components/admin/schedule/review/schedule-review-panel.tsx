import Link from "next/link";
import { publishScheduleAction } from "@/lib/admin/schedule/actions";
import { getHealthStatus } from "@/lib/admin/schedule/metrics";
import type { ScheduleReviewData, ReviewIssue } from "@/lib/admin/schedule/review";

type ScheduleReviewPanelProps = {
  review: ScheduleReviewData;
};

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(new Date(iso));
}

function IssueList({ issues, title }: { issues: ReviewIssue[]; title: string }) {
  if (issues.length === 0) {
    return (
      <section className="hl-card rounded-lg p-4">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        <p className="mt-2 text-sm text-muted">None found.</p>
      </section>
    );
  }

  return (
    <section className="hl-card rounded-lg p-4">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <ul className="mt-3 space-y-2">
        {issues.map((issue) => (
          <li className="rounded-md border border-line bg-elevated/60 p-3" key={issue.id}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p
                  className={
                    issue.severity === "blocker"
                      ? "text-sm font-semibold text-danger"
                      : "text-sm font-semibold text-warning"
                  }
                >
                  {issue.severity === "blocker" ? "Hard blocker" : "Warning"}
                </p>
                <h3 className="mt-1 font-semibold text-ink">{issue.title}</h3>
                <p className="mt-1 text-sm leading-5 text-muted">{issue.details}</p>
              </div>
              {issue.entityHref ? (
                <Link className="text-sm font-semibold text-signal" href={issue.entityHref}>
                  Open
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
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

export function ScheduleReviewPanel({ review }: ScheduleReviewPanelProps) {
  const blockers = review.issues.filter((issue) => issue.severity === "blocker");
  const warnings = review.issues.filter((issue) => issue.severity === "warning");
  const healthStatus = getHealthStatus({
    blockerCount: blockers.length,
    openPositions: review.summary.openPositions,
    partiallyStaffed: review.summary.partiallyStaffedShifts,
    unstaffed: review.summary.unstaffedShifts,
  });
  const readyToPublish = blockers.length === 0 && !review.alreadyPublished;

  return (
    <div className="space-y-5">
      <section className="hl-card hl-card-accent rounded-lg p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="hl-label text-xs font-semibold">{review.event.name}</p>
            <h2 className="mt-1 text-2xl font-semibold text-ink sm:text-3xl">Schedule Readiness</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              October 9-11, 2026 · {review.event.timezone} · Draft Schedule
            </p>
          </div>
          <span
            className={
              review.alreadyPublished
                ? "inline-flex rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold uppercase text-emerald-300"
                : readyToPublish
                  ? "inline-flex rounded-md border border-signal/40 bg-signal/10 px-3 py-1.5 text-xs font-semibold uppercase text-signal"
                  : "inline-flex rounded-md border border-warning/35 bg-warning/10 px-3 py-1.5 text-xs font-semibold uppercase text-warning"
            }
          >
            {review.alreadyPublished
              ? "Published"
              : readyToPublish
                ? "Ready to publish"
                : "Attention required"}
          </span>
        </div>
        {review.latestPublication ? (
          <p className="mt-4 rounded-md border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-300">
            Schedule already published at {formatDateTime(review.latestPublication.published_at)}.
            Republishing is intentionally left for a future phase.
          </p>
        ) : null}
      </section>

      <section className={`rounded-lg border p-4 ${healthClass(healthStatus)}`}>
        <p className="text-xs font-semibold uppercase">Schedule Health</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-5">
          {[
            ["Fully staffed", review.summary.fullyStaffedShifts],
            ["Partially staffed", review.summary.partiallyStaffedShifts],
            ["Unstaffed", review.summary.unstaffedShifts],
            ["Open positions", review.summary.openPositions],
            ["Blocking issues", blockers.length],
          ].map(([label, value]) => (
            <div className="rounded-md border border-line bg-panel/60 p-3" key={label}>
              <p className="text-xs font-medium uppercase text-muted">{label}</p>
              <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="min-w-0 space-y-4">
      <section aria-label="Readiness summary" className="grid gap-3 sm:grid-cols-3">
        {[
          ["Total shifts", review.summary.totalShifts],
          ["Required positions", review.summary.totalRequiredPositions],
          ["Assigned positions", review.summary.totalAssignedPositions],
          ["Draft assignments", review.summary.draftAssignments],
          ["Published assignments", review.summary.publishedAssignments],
        ].map(([label, value]) => (
          <div className="hl-card rounded-lg p-3" key={label}>
            <p className="text-xs font-medium uppercase text-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
          </div>
        ))}
      </section>

        <IssueList issues={blockers} title="Blockers: Cannot Publish" />
        <IssueList issues={warnings} title="Warnings: May Publish After Review" />
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4">
      <section className="hl-card rounded-lg p-4">
        <h2 className="text-lg font-semibold text-ink">Publish HackLanta II Schedule?</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          This will mark the current valid draft assignments as published and make them official
          in member schedule views. Removed assignments will remain removed.
        </p>

        {review.alreadyPublished ? (
          <p className="mt-4 rounded-md border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-300">
            Publishing is unavailable because this schedule has already been published.
          </p>
        ) : blockers.length > 0 ? (
          <p className="mt-4 rounded-md border border-danger/35 bg-danger/10 p-3 text-sm text-danger">
            Publishing unavailable. Resolve the hard blockers before publishing.
          </p>
        ) : (
          <form action={publishScheduleAction} className="mt-4 space-y-4">
            {warnings.length > 0 ? (
              <div className="rounded-md border border-warning/35 bg-warning/10 p-3 text-sm text-warning">
                {warnings.length} warning{warnings.length === 1 ? "" : "s"} remain. Publishing is
                allowed, but the schedule is not fully staffed.
              </div>
            ) : null}
            <label className="flex items-start gap-3 text-sm text-muted">
              <input
                className="mt-1 size-4 rounded border-line bg-panel text-signal"
                name="publishConfirmation"
                required
                type="checkbox"
                value="publish-hacklanta-ii"
              />
              <span>
                I understand this publishes the current HackLanta II schedule for members.
              </span>
            </label>
            <button className="hl-button-primary rounded-md px-4 py-2 text-sm font-semibold" type="submit">
              Publish Schedule
            </button>
          </form>
        )}
      </section>
      <section className="hl-card rounded-lg p-4">
        <h2 className="text-sm font-semibold text-ink">Review Snapshot</h2>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          {[
            ["Fully staffed", review.summary.fullyStaffedShifts],
            ["Partially", review.summary.partiallyStaffedShifts],
            ["Unstaffed", review.summary.unstaffedShifts],
            ["Open", review.summary.openPositions],
          ].map(([label, value]) => (
            <div className="rounded-md border border-line bg-elevated/60 p-2" key={label}>
              <dt className="text-xs uppercase text-muted">{label}</dt>
              <dd className="mt-1 text-xl font-semibold text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      </aside>
      </div>
    </div>
  );
}
