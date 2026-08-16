import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ScheduleReviewPanel } from "@/components/admin/schedule/review/schedule-review-panel";
import { AppNav } from "@/components/layout/app-nav";
import { AppShell } from "@/components/layout/app-shell";
import { getScheduleReviewData } from "@/lib/admin/schedule/review";
import { requireAdmin } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";

type AdminScheduleReviewPageProps = {
  searchParams?: Promise<{
    message?: string;
    result?: string;
  }>;
};

export default async function AdminScheduleReviewPage({ searchParams }: AdminScheduleReviewPageProps) {
  await requireAdmin();

  const params = await searchParams;
  const resultStatus =
    params?.result === "error" ? "error" : params?.result === "success" ? "success" : null;
  const review = await getScheduleReviewData();

  return (
    <AppShell>
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link className="text-sm font-medium text-signal" href="/admin/schedule">
              Schedule
            </Link>
            <h1 className="mt-2 text-4xl font-semibold text-ink">Review & Publish</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Review readiness, resolve hard blockers, and explicitly publish the HackLanta II
              schedule when it is safe.
            </p>
          </div>
          <SignOutButton />
        </div>
        <AppNav current="schedule" mode="admin" />

        {params?.message && resultStatus ? (
          <p
            className={
              resultStatus === "error"
                ? "mt-5 rounded-md border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger"
                : "mt-5 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-300"
            }
            role={resultStatus === "error" ? "alert" : "status"}
          >
            {params.message}
          </p>
        ) : null}

        <div className="mt-6">
          <ScheduleReviewPanel review={review} />
        </div>
      </main>
    </AppShell>
  );
}
