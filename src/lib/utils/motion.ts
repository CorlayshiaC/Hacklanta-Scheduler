"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { Transition, Variants } from "framer-motion";

/**
 * The only motion vocabulary in the app. Feature code animates through these presets, never a
 * one-off duration/easing/variants object. See docs/contracts/design.md "Motion".
 *
 * V3 adds a shared spring (movement: drag settle, morph, draw-in, hover lift, theme crossfade)
 * alongside the existing ease-out cubic-bezier (opacity/fade only), per the shared spec: "Springs,
 * not linear tweens: one shared spring config for movement, gentle ease-out for opacity." The
 * cubic-bezier presets below are unchanged and still correct for fades; reach for SPRING_TRANSITION
 * whenever something moves (position, scale, width).
 */

export const MOTION_FAST: Transition = { duration: 0.12, ease: [0.16, 1, 0.3, 1] };
export const MOTION_BASE: Transition = { duration: 0.2, ease: [0.16, 1, 0.3, 1] };
/** The sidebar rail's width tween and any other drawer-like expand/collapse. */
export const MOTION_DRAWER: Transition = { duration: 0.18, ease: [0.16, 1, 0.3, 1] };
/** The one shared spring for anything that moves. Mirrors --motion-spring-* in tokens.css. */
export const SPRING_TRANSITION: Transition = { type: "spring", stiffness: 420, damping: 32, mass: 1 };
const NO_SPRING: Transition = { duration: 0 };

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

/**
 * V3 name for useListStagger, published in docs/contracts/design.md as "entranceCascade": cards
 * cascade in with a 40ms stagger. The default cadence and shape are identical to useListStagger
 * (kept as an alias below, existing call sites are unaffected); this is the name new code should
 * reach for.
 *
 * "Fires once per view, never on re-render": Framer Motion only re-runs an animate="visible"
 * transition when the component (re)mounts or the `animate` prop's target itself changes, so this
 * is a discipline of usage, not extra machinery: mount the cascade root once per route with a
 * stable key, keep `animate="visible"` constant, and never flip it back to "hidden" on a data
 * refetch. Do not wrap a cascade root in a key that changes on every fetch (e.g. `key={data.id}`
 * where data refreshes with the same id) or it will replay on every poll.
 */
export function useEntranceCascade(staggerMs = 40): { container: Variants; item: Variants } {
  return useListStagger(staggerMs);
}

/**
 * Schedule bars sweeping in left to right on first render, once (coverage board, timeline, my
 * schedule strip). Render each bar with `style={{ transformOrigin: "left" }}`, spread `transition`
 * with a per-index delay from `drawInDelay(index)` below, and these variants (initial="hidden"
 * animate="visible"). Reduced motion jumps straight to the drawn-in state.
 */
export function useDrawIn(): { variants: Variants; transition: Transition } {
  const reduced = useReducedMotion();

  return {
    variants: {
      hidden: { scaleX: reduced ? 1 : 0, opacity: reduced ? 1 : 0.4 },
      visible: { scaleX: 1, opacity: 1 },
    },
    transition: reduced ? NO_SPRING : SPRING_TRANSITION,
  };
}
/** Per-index delay helper for useDrawIn's stagger, so callers don't hand-roll the math. */
export function drawInDelay(index: number, staggerMs = 60): number {
  return (index * staggerMs) / 1000;
}

/**
 * Hover lift: cards rise 2px with the shadow deepening from soft to glow. Pure CSS (no JS motion
 * needed for a two-property hover), published as a class string so every owned primitive applies
 * the identical lift rather than hand-rolling translate/shadow values. motion-reduce collapses the
 * rise but keeps the shadow change, since a shadow swap alone doesn't trigger vestibular issues.
 */
export const HOVER_LIFT_CLASSES =
  "transition-[transform,box-shadow] duration-base ease-neu-out motion-reduce:transition-[box-shadow] hover:-translate-y-0.5 hover:shadow-glow";

/**
 * Shared-element morph (a shift capsule or event card morphing into its detail panel): give the
 * source element and the destination element the same Framer Motion `layoutId`, wrap both in
 * <AnimatePresence> if one unmounts while the other mounts (e.g. a card becoming a full page), and
 * pass this transition to whichever one needs an explicit `transition` prop (motion.* elements
 * sharing a layoutId animate the shared bounds automatically on layout change; this is the spring
 * to use for the surrounding fade/scale of content that isn't itself part of the shared bounds).
 * Where routing prevents a true layoutId morph (a hard navigation), fall back to useMotionPreset's
 * pageTransition instead, per docs/contracts/design.md.
 */
export const MORPH_TRANSITION: Transition = SPRING_TRANSITION;

/**
 * Crossfades the whole document between light and dark via the View Transitions API where
 * supported (Chromium/Safari 18+), falling back to an instant swap. Call this wrapping the actual
 * DOM mutation (setting the data-theme attribute), not after it: `startThemeTransition(() =>
 * setTheme(next))`. See src/lib/theme/use-theme.ts, the only caller. Reduced motion still uses the
 * View Transition (it's a single opacity crossfade, not a directional slide) but drops its
 * duration via the ::view-transition-* CSS in globals.css.
 */
export function startThemeTransition(applyTheme: () => void): void {
  type DocumentWithViewTransitions = Document & {
    startViewTransition?: (callback: () => void) => void;
  };
  const doc = document as DocumentWithViewTransitions;

  if (typeof doc.startViewTransition === "function") {
    doc.startViewTransition(applyTheme);
    return;
  }

  applyTheme();
}

/** V3 published name for PILL_TAP; identical value, see docs/contracts/design.md "Motion". */
export const pillPress = PILL_TAP;
