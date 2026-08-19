"use client";

import type { SVGAttributes } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { useTheme } from "@/lib/theme/use-theme";
import { SPRING_SNAP, SPRING_TRANSITION, pillPress } from "@/lib/utils/motion";

function SunIcon(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}

export type ThemeToggleProps = { className?: string };

/**
 * Sun/moon pill, the one toggle instance the app mounts (topbar). Crossfades the whole document
 * via startThemeTransition (View Transitions API where supported, instant swap fallback) while the
 * icon itself rotates 180 degrees on spring-snap, per docs/contracts/motion-spec.md section 2.
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <motion.button
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={isDark}
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-hairline",
        "bg-surface-elevated text-text-secondary outline-none",
        "transition-colors duration-fast ease-neu-out hover:text-text-primary",
        "focus-visible:shadow-focus-ring disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      onClick={toggleTheme}
      transition={SPRING_TRANSITION}
      type="button"
      whileTap={pillPress}
    >
      <motion.span
        animate={{ rotate: isDark ? 180 : 0 }}
        className="flex items-center justify-center"
        transition={SPRING_SNAP}
      >
        {isDark ? <MoonIcon aria-hidden className="h-4 w-4" /> : <SunIcon aria-hidden className="h-4 w-4" />}
      </motion.span>
    </motion.button>
  );
}
