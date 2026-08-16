import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { MemberManagement } from "@/components/admin/members/member-management";
import { AppNav } from "@/components/layout/app-nav";
import { AppShell } from "@/components/layout/app-shell";
import { getAdminMembersPageData } from "@/lib/admin/member-data";
import { requireAdmin } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";

type AdminMembersPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    result?: string;
    message?: string;
  }>;
};

function normalizeStatus(value?: string): "all" | "active" | "inactive" {
  return value === "active" || value === "inactive" ? value : "all";
}

export default async function AdminMembersPage({ searchParams }: AdminMembersPageProps) {
  await requireAdmin();

  const params = await searchParams;
  const status = normalizeStatus(params?.status);
  const resultStatus =
    params?.result === "error" ? "error" : params?.result === "success" ? "success" : null;
  const { event, members, coverageRoles } = await getAdminMembersPageData({
    query: params?.q,
    status,
  });

  return (
    <AppShell>
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link className="text-sm font-medium text-signal" href="/admin">
              Admin
            </Link>
            <h1 className="mt-2 text-4xl font-semibold text-ink">Members</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Manage existing authenticated profiles, event coverage roles, and work constraints.
            </p>
          </div>
          <SignOutButton />
        </div>
        <AppNav current="members" mode="admin" />

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

        <form className="mt-6 grid gap-3 hl-card rounded-lg p-4 sm:grid-cols-[1fr_180px_auto]">
          <label className="sr-only" htmlFor="member-search">
            Search by name or email
          </label>
          <input
            className="hl-input h-10 rounded-md px-3 text-sm"
            defaultValue={params?.q ?? ""}
            id="member-search"
            name="q"
            placeholder="Search by name or email"
            type="search"
          />
          <label className="sr-only" htmlFor="member-status">
            Status
          </label>
          <select
            className="hl-input h-10 rounded-md px-3 text-sm"
            defaultValue={status}
            id="member-status"
            name="status"
          >
            <option value="all">All members</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>
          <button
            className="hl-button-secondary rounded-md px-4 py-2 text-sm font-semibold"
            type="submit"
          >
            Filter
          </button>
        </form>

        <div className="mt-6">
          {event ? (
            <MemberManagement
              coverageRoles={coverageRoles}
              eventId={event.id}
              members={members}
            />
          ) : (
            <div className="hl-card rounded-lg p-6 text-sm text-muted">
              No HackLanta event is configured yet. Member coverage roles and work constraints need
              an event before they can be managed.
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
