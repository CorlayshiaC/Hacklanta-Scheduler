"use client";

import { useState, type SVGAttributes } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { EASE_OUT_FAST, SPRING_COLLAPSE, SPRING_STANDARD } from "@/lib/utils/motion";
import { useHoverPrefetch, useIdleRoutePrefetch } from "@/lib/navigation/use-route-prefetch";
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

  /**
   * Warm every nav target this role can reach, during idle time after first paint, so a click does
   * not wait on a chunk fetch. Role-gated by construction: `items` is already
   * `navItemsForRole(role)`, so a member never prefetches the director-only coverage/approval/events
   * routes they would just be redirected away from.
   *
   * Deliberately NOT filtered by `pathname`. Excluding the current route looks like an obvious
   * saving but puts `pathname` in the dependency array, which changes the queue's identity on every
   * navigation and so tears down and re-runs the whole queue after every single click, for the life
   * of the session. Each queued prefetch is a real request that passes through middleware's auth
   * round trip, so that "optimization" costs far more than the one prefetch it skips. Re-prefetching
   * the route you are already on is cheap by comparison and Next dedupes it.
   *
   * No useMemo: `navItemsForRole` returns a fresh array every render anyway, so memoizing on
   * `items` would never hit. `useIdleRoutePrefetch` keys on the joined href string precisely so
   * array identity does not matter, and that string is constant for a given role.
   */
  useIdleRoutePrefetch(items.map((item) => item.href));
  const hoverPrefetch = useHoverPrefetch();

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <motion.aside
      animate={{ width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
      className="sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-hairline bg-surface-canvas py-6 md:flex"
      transition={reduced ? { duration: 0 } : collapsed ? SPRING_COLLAPSE : SPRING_STANDARD}
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
                "relative flex items-center gap-2.5 overflow-hidden rounded-control px-3 py-2 text-sm font-medium outline-none transition-colors duration-fast ease-neu-out motion-reduce:transition-none",
                "focus-visible:shadow-focus-ring active:scale-[0.97]",
                collapsed && "justify-center px-0 py-2.5",
                isActive ? "text-text-primary" : "text-text-secondary hover:bg-elevated hover:text-text-primary",
              )}
              href={item.href}
              // Hover/focus intent: warm anything the idle queue has not reached yet, so even a
              // cold target is in the router cache by the time the click lands.
              {...hoverPrefetch(item.href)}
            >
              {/* The active-item tint is one continuous element sliding between nav items
                  (layoutId), not a per-item background fade: switching pages reads as one light
                  moving, per docs/contracts/motion-spec.md section 2. */}
              {isActive ? (
                <motion.span
                  aria-hidden
                  className="absolute inset-0 rounded-control bg-accent-primary/[0.13]"
                  layoutId="nav-active-tint"
                  transition={reduced ? { duration: 0 } : SPRING_STANDARD}
                />
              ) : null}
              <Icon className="relative z-10 shrink-0" />
              <AnimatePresence initial={false}>
                {!collapsed ? (
                  <motion.span
                    animate={{ opacity: 1, x: 0 }}
                    className="relative z-10 whitespace-nowrap"
                    exit={{ opacity: 0, x: -4 }}
                    initial={{ opacity: 0, x: -4 }}
                    transition={reduced ? { duration: 0 } : { ...EASE_OUT_FAST, delay: index * 0.02 }}
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
