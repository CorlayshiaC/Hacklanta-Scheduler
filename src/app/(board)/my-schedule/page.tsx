import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { AppNav } from "@/components/layout/app-nav";
import { AppShell } from "@/components/layout/app-shell";
import { MemberScheduleWorkspace } from "@/components/member/member-schedule-workspace";
import { getMemberAvailabilityPageData } from "@/lib/availability/data";
import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { getPostAuthPath } from "@/lib/auth/route-protection";
import { getMemberSchedulePageData } from "@/lib/member/schedule";

export const dynamic = "force-dynamic";

type MySchedulePageProps = {
  searchParams?: Promise<{
    result?: string;
    message?: string;
  }>;
};

export default async function MySchedulePage({ searchParams }: MySchedulePageProps) {
  const context = await requireAuthenticatedUser();
  const params = await searchParams;
  const result =
    params?.result === "error" ? "error" : params?.result === "success" ? "success" : null;
  const [availabilityData, scheduleData] = await Promise.all([
    getMemberAvailabilityPageData(),
    getMemberSchedulePageData(),
  ]);

  return (
    <AppShell>
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="hl-label text-xs font-semibold">HackLanta Scheduler</p>
            <h1 className="mt-2 text-4xl font-semibold text-ink">My Schedule</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              See when you are scheduled to work, then manage when you are available.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {context.profile.role === "admin" ? (
              <Link className="text-sm font-medium text-signal" href={getPostAuthPath("admin")}>
                Admin
              </Link>
            ) : null}
            <SignOutButton />
          </div>
        </div>
        <AppNav current="my-schedule" mode="member" />
        {params?.message && result ? (
          <p
            className={
              result === "error"
                ? "mt-5 rounded-md border border-danger/35 bg-danger/10 px-3 py-2 text-sm text-danger"
                : "mt-5 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-300"
            }
            role={result === "error" ? "alert" : "status"}
          >
            {params.message}
          </p>
        ) : null}
        <div className="mt-6">
          <MemberScheduleWorkspace
            availabilityWindows={availabilityData.windows}
            data={scheduleData}
          />
        </div>
      </main>
    </AppShell>
  );
}
