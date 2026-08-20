"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Flat nav rows: radius-pill is 6px now, reserved for avatars as a true stadium shape. Active item
// uses the real --active-tint-alpha token (bg-accent-primary/[0.13], docs/contracts/design.md "V4:
// precision instrument" tokens table), the same wash Sidebar's own active-nav-item uses.
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
    <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {items
        .filter((item) => isAdmin || !item.adminOnly)
        .map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              className={
                "rounded-[6px] px-3 py-2 text-[13px] font-medium transition-colors duration-fast ease-neu-out motion-reduce:transition-none " +
                (isActive
                  ? "bg-accent-primary/[0.13] text-text-primary"
                  : "bg-transparent text-text-secondary hover:text-text-primary")
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
