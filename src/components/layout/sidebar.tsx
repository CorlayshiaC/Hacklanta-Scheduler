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
    <aside className="hidden w-60 shrink-0 flex-col border-r border-hairline bg-app px-3 py-6 md:flex">
      <div className="px-3 pb-6">
        <span className="font-display text-sm font-bold uppercase tracking-tight text-text-primary">
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
                "rounded-pill px-3 py-2 text-sm font-medium outline-none transition-[background-color,color,transform] duration-fast ease-neu-out motion-reduce:transition-none",
                "focus-visible:shadow-focus-ring active:scale-[0.97]",
                isActive
                  ? "bg-pill-white text-on-accent"
                  : "text-text-secondary hover:bg-elevated hover:text-text-primary",
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
