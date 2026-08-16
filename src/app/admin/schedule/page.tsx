import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ScheduleWorkspace } from "@/components/admin/schedule/schedule-workspace";
import { AppNav } from "@/components/layout/app-nav";
import { AppShell } from "@/components/layout/app-shell";
import { getAdminShiftPageData } from "@/lib/admin/shifts/data";
import { getScheduleReviewData } from "@/lib/admin/schedule/review";
import { requireAdmin } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";

type AdminSchedulePageProps = {
  searchParams?: Promise<{
    coverageRoleId?: string;
    date?: string;
    staffingStatus?: string;
    result?: string;
    message?: string;
  }>;
};

function normalizeStaffingStatus(value?: string) {
  return value === "fully_staffed" || value === "partially_staffed" || value === "unstaffed"
    ? value
    : "";
}

export default async function AdminSchedulePage({ searchParams }: AdminSchedulePageProps) {
  await requireAdmin();

  const params = await searchParams;
  const staffingStatus = normalizeStaffingStatus(params?.staffingStatus);
  const resultStatus =
    params?.result === "error" ? "error" : params?.result === "success" ? "success" : null;
  const [data, review] = await Promise.all([
    getAdminShiftPageData({
      coverageRoleId: params?.coverageRoleId,
      date: params?.date,
      staffingStatus,
    }),
    getScheduleReviewData(),
  ]);

  return (
    <AppShell>
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link className="text-sm font-medium text-signal" href="/admin">
              Admin
            </Link>
            <h1 className="mt-2 text-4xl font-semibold text-ink">Schedule Planning</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Plan HackLanta II coverage shifts, spot staffing gaps, review workloads, and confirm
              draft assignments from live recommendations.
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
          <ScheduleWorkspace
            data={data}
            filters={{
              coverageRoleId: params?.coverageRoleId ?? "",
              date: params?.date ?? "",
              staffingStatus,
            }}
            review={review}
          />
        </div>
      </main>
    </AppShell>
  );
}
