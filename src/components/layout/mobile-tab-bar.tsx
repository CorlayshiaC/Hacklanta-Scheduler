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
      className="fixed inset-x-0 bottom-0 z-40 flex gap-1 border-t border-hairline bg-app px-2 py-2 md:hidden"
    >
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex flex-1 items-center justify-center rounded-pill px-2 py-1.5 text-[11px] font-medium outline-none transition-[background-color,color,transform] duration-fast ease-neu-out motion-reduce:transition-none",
              "focus-visible:shadow-focus-ring active:scale-[0.97]",
              isActive ? "bg-pill-white text-on-accent" : "text-text-secondary",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
