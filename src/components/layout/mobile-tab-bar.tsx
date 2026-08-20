"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { useHoverPrefetch } from "@/lib/navigation/use-route-prefetch";
import { mobileTabItemsForRole, type ShellRole } from "./nav-config";

export type MobileTabBarProps = {
  role: ShellRole;
};

export function MobileTabBar({ role }: MobileTabBarProps) {
  const pathname = usePathname();
  const items = mobileTabItemsForRole(role);
  // Touch fires pointerenter just before the tap, so intent prefetching helps here too. The idle
  // queue itself lives in Sidebar, which is mounted (visually hidden) at this breakpoint, so the
  // same role-gated set is already being warmed and this is not a second queue.
  const hoverPrefetch = useHoverPrefetch();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex gap-1 border-t border-hairline bg-surface-canvas px-2 py-2 md:hidden"
    >
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            {...hoverPrefetch(item.href)}
            className={cn(
              "flex flex-1 items-center justify-center rounded-control px-2 py-1.5 text-[11px] font-medium outline-none transition-[background-color,color,transform] duration-fast ease-neu-out motion-reduce:transition-none",
              "focus-visible:shadow-focus-ring active:scale-[0.97]",
              isActive ? "bg-accent-primary/[0.13] text-text-primary" : "text-text-secondary",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
