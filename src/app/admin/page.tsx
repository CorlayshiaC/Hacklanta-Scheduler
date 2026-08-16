import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AppNav } from "@/components/layout/app-nav";
import { AppShell } from "@/components/layout/app-shell";
import { getHealthStatus } from "@/lib/admin/schedule/metrics";
import { getScheduleReviewData } from "@/lib/admin/schedule/review";
import { requireAdmin } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const review = await getScheduleReviewData();
  const blockers = review.issues.filter((issue) => issue.severity === "blocker");
  const warnings = review.issues.filter((issue) => issue.severity === "warning");
  const healthStatus = getHealthStatus({
    blockerCount: blockers.length,
    openPositions: review.summary.openPositions,
    partiallyStaffed: review.summary.partiallyStaffedShifts,
    unstaffed: review.summary.unstaffedShifts,
  });
  const healthClass =
    healthStatus === "blocking"
      ? "border-danger/35 bg-danger/10 text-danger"
      : healthStatus === "warning"
        ? "border-warning/35 bg-warning/10 text-warning"
        : "border-signal/35 bg-signal/10 text-signal";

  return (
    <AppShell>
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="hl-label text-xs font-semibold">HackLanta Scheduler</p>
            <h1 className="mt-2 text-3xl font-semibold text-ink sm:text-4xl">Admin Command Center</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              HackLanta II operations, staffing, and publishing at a glance.
            </p>
          </div>
          <SignOutButton />
        </div>
        <AppNav current="admin" mode="admin" />
        <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div className="hl-card hl-card-accent rounded-lg p-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold text-ink">HackLanta II</h2>
                <span className="rounded-md border border-warning/35 bg-warning/10 px-2.5 py-1 text-xs font-semibold uppercase text-warning">
                  Draft
                </span>
              </div>
              <p className="mt-2 text-sm text-muted">October 9-11, 2026 · America/New_York</p>
              <p className="mt-1 text-sm text-muted">Operational coverage: Friday 7:00 AM to Sunday 3:00 PM</p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Link className="hl-button-primary inline-flex justify-center rounded-md px-4 py-2 text-sm font-semibold" href="/admin/schedule">
                Schedule
              </Link>
              <Link className="hl-button-secondary inline-flex justify-center rounded-md px-4 py-2 text-sm font-semibold" href="/admin/shifts">
                Shifts
              </Link>
              <Link className="hl-button-secondary inline-flex justify-center rounded-md px-4 py-2 text-sm font-semibold" href="/admin/members">
                Members
              </Link>
            </div>
          </div>
          <div className={`rounded-lg border p-4 ${healthClass}`}>
            <p className="text-xs font-semibold uppercase">Schedule Health</p>
            <h2 className="mt-2 text-xl font-semibold text-ink">
              {healthStatus === "blocking"
                ? "Blocking issues need review"
                : healthStatus === "warning"
                  ? "Staffing needs attention"
                  : "Schedule is healthy"}
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
              {[
                ["Full", review.summary.fullyStaffedShifts],
                ["Open", review.summary.openPositions],
                ["Blockers", blockers.length],
                ["Warnings", warnings.length],
              ].map(([label, value]) => (
                <div className="rounded-md border border-line bg-panel/60 p-2" key={label}>
                  <p className="text-lg font-semibold text-ink">{value}</p>
                  <p className="text-[11px] font-semibold uppercase text-muted">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Link
            className="hl-card rounded-lg p-4 text-sm font-semibold text-ink transition hover:border-signal/40"
            href="/admin/schedule"
          >
            <span className="hl-label text-xs font-semibold">Primary</span>
            <span className="mt-2 block text-lg">Schedule Planning</span>
            <span className="mt-1 block text-sm font-normal leading-6 text-muted">
              Coverage, gaps, workloads, recommendations.
            </span>
          </Link>
          <Link
            className="hl-card rounded-lg p-4 text-sm font-semibold text-ink transition hover:border-signal/40"
            href="/admin/members"
          >
            <span className="hl-label text-xs font-semibold">Roster</span>
            <span className="mt-2 block text-lg">Members</span>
            <span className="mt-1 block text-sm font-normal leading-6 text-muted">
              Profiles, roles, availability, constraints.
            </span>
          </Link>
          <Link
            className="hl-card rounded-lg p-4 text-sm font-semibold text-ink transition hover:border-signal/40"
            href="/admin/shifts"
          >
            <span className="hl-label text-xs font-semibold">Builder</span>
            <span className="mt-2 block text-lg">Shifts</span>
            <span className="mt-1 block text-sm font-normal leading-6 text-muted">
              Create, edit, assign, and inspect candidates.
            </span>
          </Link>
        </div>
      </main>
    </AppShell>
  );
}
