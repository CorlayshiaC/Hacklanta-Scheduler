"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { mobileTabItemsForRole, type ShellRole } from "./nav-config";

export type MobileTabBarProps = {
  role: ShellRole;
};

export function MobileTabBar({ role }: MobileTabBarProps) {
  const pathname = usePathname();
  const items = mobileTabItemsForRole(role);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-hairline bg-bg-base px-2 py-2 md:hidden"
    >
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-neu-sm py-1.5 text-[11px] font-medium outline-none transition-colors duration-fast",
              "focus-visible:shadow-neu-focus",
              isActive ? "text-purple-400" : "text-text-secondary",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
