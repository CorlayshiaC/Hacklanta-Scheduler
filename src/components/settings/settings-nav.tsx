"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Pill nav items, matches the app shell's own nav treatment (design.md, "App shell": active item
// is a pill-white pill, selection semantics). Previously deferred pending pathname-aware active
// state; now added since usePathname needs a client component regardless.
const items = [
  { href: "/settings", label: "Profile", adminOnly: false },
  { href: "/settings/notifications", label: "Notifications", adminOnly: false },
  { href: "/settings/organization", label: "Organization", adminOnly: true },
  { href: "/settings/roles", label: "Roles", adminOnly: true },
  { href: "/settings/invites", label: "Invites", adminOnly: true },
] as const;

export function SettingsNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-row gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
      {items
        .filter((item) => isAdmin || !item.adminOnly)
        .map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              className={
                "rounded-pill px-4 py-2 text-sm font-medium transition-[filter] duration-fast ease-neu-out " +
                (isActive
                  ? "bg-pill-white text-on-accent"
                  : "bg-elevated text-text-primary hover:brightness-110")
              }
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}
