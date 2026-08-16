"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { navItemsForRole, type ShellRole } from "./nav-config";

export type SidebarProps = {
  role: ShellRole;
};

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const items = navItemsForRole(role);

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-hairline bg-bg-base px-3 py-6 md:flex">
      <div className="px-3 pb-6">
        <span className="font-mono text-sm font-semibold tracking-wide text-text-primary">
          prog scheduler
        </span>
      </div>
      <nav aria-label="Primary" className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "rounded-neu-sm px-3 py-2 text-sm font-medium outline-none transition-[background-color,box-shadow,color] duration-fast ease-neu-out",
                "focus-visible:shadow-neu-focus",
                isActive
                  ? "bg-bg-surface text-text-primary shadow-neu-raised-sm"
                  : "text-text-secondary hover:bg-bg-surface/60 hover:text-text-primary",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
