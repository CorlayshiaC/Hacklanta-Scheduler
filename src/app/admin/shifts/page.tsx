import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ShiftManagement } from "@/components/admin/shifts/shift-management";
import { AppNav } from "@/components/layout/app-nav";
import { AppShell } from "@/components/layout/app-shell";
import { getAdminShiftPageData } from "@/lib/admin/shifts/data";
import { requireAdmin } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";

type AdminShiftsPageProps = {
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

export default async function AdminShiftsPage({ searchParams }: AdminShiftsPageProps) {
  await requireAdmin();

  const params = await searchParams;
  const staffingStatus = normalizeStaffingStatus(params?.staffingStatus);
  const resultStatus =
    params?.result === "error" ? "error" : params?.result === "success" ? "success" : null;
  const data = await getAdminShiftPageData({
    date: params?.date,
    coverageRoleId: params?.coverageRoleId,
    staffingStatus,
  });

  return (
    <AppShell>
      <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link className="text-sm font-medium text-signal" href="/admin">
              Admin
            </Link>
            <h1 className="mt-2 text-4xl font-semibold text-ink">Shifts</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Build HackLanta II coverage shifts, define role requirements, and confirm draft
              assignments from ranked recommendations.
            </p>
          </div>
          <SignOutButton />
        </div>
        <AppNav current="shifts" mode="admin" />

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

        <form className="mt-6 grid gap-3 hl-card rounded-lg p-4 lg:grid-cols-[180px_1fr_200px_auto]">
          <label className="sr-only" htmlFor="shift-date-filter">
            Date
          </label>
          <select
            className="hl-input h-10 rounded-md px-3 text-sm"
            defaultValue={params?.date ?? ""}
            id="shift-date-filter"
            name="date"
          >
            <option value="">All dates</option>
            <option value="2026-10-09">Friday, Oct 9</option>
            <option value="2026-10-10">Saturday, Oct 10</option>
            <option value="2026-10-11">Sunday, Oct 11</option>
          </select>
          <label className="sr-only" htmlFor="coverage-role-filter">
            Coverage role
          </label>
          <select
            className="hl-input h-10 rounded-md px-3 text-sm"
            defaultValue={params?.coverageRoleId ?? ""}
            id="coverage-role-filter"
            name="coverageRoleId"
          >
            <option value="">All coverage roles</option>
            {data.coverageRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="staffing-status-filter">
            Staffing status
          </label>
          <select
            className="hl-input h-10 rounded-md px-3 text-sm"
            defaultValue={staffingStatus}
            id="staffing-status-filter"
            name="staffingStatus"
          >
            <option value="">All staffing states</option>
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

        <div className="mt-6">
          <ShiftManagement
            candidatesByShiftRole={data.candidatesByShiftRole}
            coverageRoles={data.coverageRoles}
            eventTimezone={data.event.timezone}
            shifts={data.shifts}
            shiftRoles={data.shiftRoles}
          />
        </div>
      </main>
    </AppShell>
  );
}
