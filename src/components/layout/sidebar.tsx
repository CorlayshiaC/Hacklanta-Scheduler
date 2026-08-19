"use client";

import { useState, type SVGAttributes } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { MOTION_DRAWER, MOTION_FAST } from "@/lib/utils/motion";
import { IconButton } from "@/components/ui/icon-button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { NAV_ICONS } from "./nav-icons";
import { navItemsForRole, type ShellRole } from "./nav-config";

const SIDEBAR_COOKIE = "sidebar-collapsed";
const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 72;

export type SidebarProps = {
  role: ShellRole;
  /** Initial state, read server-side from the persisted cookie so there is no client flash. */
  defaultCollapsed?: boolean;
};

function ChevronIcon({ collapsed, ...props }: SVGAttributes<SVGSVGElement> & { collapsed: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("h-4 w-4 transition-transform duration-fast ease-neu-out", collapsed && "rotate-180")}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.6}
      viewBox="0 0 20 20"
      {...props}
    >
      <path d="M12.5 4.5L7 10l5.5 5.5" />
    </svg>
  );
}

export function Sidebar({ role, defaultCollapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const items = navItemsForRole(role);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const reduced = useReducedMotion();

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <motion.aside
      animate={{ width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
      className="sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-hairline bg-surface-canvas/70 py-6 backdrop-blur-glass md:flex"
      transition={reduced ? { duration: 0 } : MOTION_DRAWER}
    >
      <div className={cn("flex items-center px-4 pb-6", collapsed ? "justify-center" : "justify-between")}>
        {!collapsed ? (
          <span className="whitespace-nowrap font-display text-sm font-bold uppercase tracking-tight text-text-primary">
            prog scheduler
          </span>
        ) : null}
        <IconButton
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={toggle}
          size="sm"
          variant="ghost"
        >
          <ChevronIcon collapsed={collapsed} />
        </IconButton>
      </div>
      <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 px-3">
        {items.map((item, index) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = NAV_ICONS[item.icon];

          const link = (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 overflow-hidden rounded-pill px-3 py-2 text-sm font-medium outline-none transition-[background-color,color,transform] duration-fast ease-neu-out motion-reduce:transition-none",
                "focus-visible:shadow-focus-ring active:scale-[0.97]",
                collapsed && "justify-center px-0 py-2.5",
                isActive
                  ? "bg-pill-white text-on-accent"
                  : "text-text-secondary hover:bg-elevated hover:text-text-primary",
              )}
              href={item.href}
            >
              <Icon className="shrink-0" />
              <AnimatePresence initial={false}>
                {!collapsed ? (
                  <motion.span
                    animate={{ opacity: 1, x: 0 }}
                    className="whitespace-nowrap"
                    exit={{ opacity: 0, x: -4 }}
                    initial={{ opacity: 0, x: -4 }}
                    transition={reduced ? { duration: 0 } : { ...MOTION_FAST, delay: index * 0.02 }}
                  >
                    {item.label}
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </Link>
          );

          return collapsed ? (
            <Tooltip key={item.key}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          ) : (
            <span key={item.key}>{link}</span>
          );
        })}
      </nav>
    </motion.aside>
  );
}
