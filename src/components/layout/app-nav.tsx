import Link from "next/link";

type AppNavProps = {
  current: "admin" | "members" | "my-schedule" | "schedule" | "shifts";
  mode: "admin" | "member";
};

const adminLinks = [
  { href: "/admin", key: "admin", label: "Dashboard" },
  { href: "/admin/schedule", key: "schedule", label: "Schedule" },
  { href: "/admin/members", key: "members", label: "Members" },
  { href: "/admin/shifts", key: "shifts", label: "Shifts" },
] as const;

const memberLinks = [
  { href: "/my-schedule", key: "my-schedule", label: "My Schedule" },
] as const;

export function AppNav({ current, mode }: AppNavProps) {
  const links = mode === "admin" ? adminLinks : memberLinks;

  return (
    <nav aria-label={`${mode === "admin" ? "Admin" : "Member"} navigation`} className="mt-6">
      <div className="flex gap-2 overflow-x-auto rounded-lg border border-line bg-panel/60 p-1">
        {links.map((link) => {
          const isCurrent = link.key === current;

          return (
            <Link
              aria-current={isCurrent ? "page" : undefined}
              className={
                isCurrent
                  ? "rounded-md bg-gradient-to-r from-signal/25 via-electric/25 to-pulse/25 px-3 py-2 text-sm font-semibold text-ink"
                  : "rounded-md px-3 py-2 text-sm font-medium text-muted transition hover:bg-white/5 hover:text-ink"
              }
              href={link.href}
              key={link.key}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
