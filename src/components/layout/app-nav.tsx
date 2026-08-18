import Link from "next/link";
import { cn } from "@/lib/utils/cn";

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

/** Legacy per-page tab row, superseded by the real Sidebar/MobileTabBar. See app-shell.tsx. */
export function AppNav({ current, mode }: AppNavProps) {
  const links = mode === "admin" ? adminLinks : memberLinks;

  return (
    <nav aria-label={`${mode === "admin" ? "Admin" : "Member"} navigation`} className="mt-6">
      <div className="flex gap-1 overflow-x-auto rounded-pill bg-elevated p-1">
        {links.map((link) => {
          const isCurrent = link.key === current;

          return (
            <Link
              aria-current={isCurrent ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-pill px-3 py-2 text-sm font-medium outline-none transition-[background-color,color] duration-fast ease-neu-out",
                "focus-visible:shadow-focus-ring",
                isCurrent
                  ? "bg-pill-white text-on-accent"
                  : "text-text-secondary hover:text-text-primary",
              )}
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
