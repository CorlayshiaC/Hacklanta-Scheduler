"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { Transition, Variants } from "framer-motion";

/**
 * The only motion vocabulary in the app. Feature code animates through these presets, never a
 * one-off duration/easing/variants object. See docs/contracts/design.md "Motion".
 */

export const MOTION_FAST: Transition = { duration: 0.12, ease: [0.16, 1, 0.3, 1] };
export const MOTION_BASE: Transition = { duration: 0.2, ease: [0.16, 1, 0.3, 1] };
/** The sidebar rail's width tween and any other drawer-like expand/collapse. */
export const MOTION_DRAWER: Transition = { duration: 0.18, ease: [0.16, 1, 0.3, 1] };

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
 * onto a motion component and use `variants` with initial="hidden" animate="visible". This is the
 * `pageTransition` preset: fade + 8px rise.
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

/** Alias of useMotionPreset's variants/transition, named to match the "pageTransition" preset. */
export const PAGE_TRANSITION_VARIANTS = RISE_IN;

/**
 * A list/grid whose children reveal 40ms apart. Spread `container` onto the parent
 * (initial="hidden" animate="visible") and `item` onto each child. Reduced motion collapses the
 * stagger to a single instant reveal.
 */
export function useListStagger(staggerMs = 40): { container: Variants; item: Variants } {
  const reduced = useReducedMotion();
  const stagger = reduced ? 0 : staggerMs / 1000;

  return {
    container: {
      hidden: {},
      visible: { transition: { staggerChildren: stagger } },
    },
    item: reduced ? NO_MOTION : RISE_IN,
  };
}

/** whileTap target for any pressable pill/capsule driven by Framer Motion rather than CSS :active. */
export const PILL_TAP = { scale: 0.97 };

/**
 * Capsule fill sweep for a schedule state change (e.g. an assignment flipping from in_approval to
 * approved). Render an absolutely positioned inner layer with `style={{ transformOrigin: "left" }}`
 * and these variants (initial="empty" animate="filled"). Reduced motion jumps straight to filled.
 */
export function useFillIn(): { variants: Variants; transition: Transition } {
  const reduced = useReducedMotion();

  return {
    variants: {
      empty: { scaleX: reduced ? 1 : 0 },
      filled: { scaleX: 1 },
    },
    transition: reduced ? { duration: 0 } : { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  };
}

/**
 * AI schedule proposals populating left to right, 30ms apart. Same shape as useListStagger with a
 * different default cadence and an item variant that also shifts in from the left slightly, since
 * this reads as a left-to-right reveal rather than a plain fade-up list.
 */
export function useReveal(): { container: Variants; item: Variants } {
  const reduced = useReducedMotion();

  return {
    container: {
      hidden: {},
      visible: { transition: { staggerChildren: reduced ? 0 : 0.03 } },
    },
    item: reduced
      ? NO_MOTION
      : {
          hidden: { opacity: 0, x: -6 },
          visible: { opacity: 1, x: 0 },
        },
  };
}

/**
 * Animates a numeral from its previous value to `target` over ~500ms, easing out. Pair with
 * font-mono tabular-nums on the caller's display element so digit width never shifts mid-count
 * (this hook only tweens the number, tabular-nums is what keeps it from jittering). Reduced motion
 * jumps straight to `target`. Only meaningful for a plain numeric StatBlock value; fraction/string
 * values ("18/24") are not animatable and should not use this hook.
 */
export function useCountUp(target: number, durationMs = 500): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const from = fromRef.current;
    if (reduced || from === target) {
      setValue(target);
      fromRef.current = target;
      return;
    }

    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    };
  }, [target, reduced, durationMs]);

  return value;
}
