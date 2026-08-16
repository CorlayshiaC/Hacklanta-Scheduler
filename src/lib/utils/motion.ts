"use client";

import { useReducedMotion } from "framer-motion";
import type { Transition, Variants } from "framer-motion";

export const MOTION_FAST: Transition = { duration: 0.12, ease: [0.16, 1, 0.3, 1] };
export const MOTION_BASE: Transition = { duration: 0.2, ease: [0.16, 1, 0.3, 1] };

const RISE_IN: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

const NO_MOTION: Variants = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0 },
};

/**
 * One orchestrated entrance moment per view, honoring prefers-reduced-motion. Spread `transition`
 * onto a motion component and use `variants` with initial="hidden" animate="visible".
 */
export function useMotionPreset(): {
  transition: Transition;
  fast: Transition;
  variants: Variants;
} {
  const reduced = useReducedMotion();

  return {
    transition: reduced ? { duration: 0 } : MOTION_BASE,
    fast: reduced ? { duration: 0 } : MOTION_FAST,
    variants: reduced ? NO_MOTION : RISE_IN,
  };
}
