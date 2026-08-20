"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { Transition, Variants } from "framer-motion";

/**
 * The only motion vocabulary in the app. Feature code animates through these presets, never a
 * one-off duration/easing/variants object. Full spec: docs/contracts/motion-spec.md. Every export
 * below is reduced-motion-aware internally so callers never write their own useReducedMotion()
 * check, and every existing export keeps its exact name and call signature across this V4 pass:
 * Agents 3, 4, and 6 already consume useEntranceCascade/useDrawIn/useCountUp/MORPH_TRANSITION/etc.
 * in shipped screens, and a signature change would break them without a compiler error to catch it
 * (they're passed straight into Framer Motion props, not type-checked against this module).
 *
 * V4 section 1 (motion-spec.md) timing tokens, mirrored in tokens.css as bare numbers for non-JS
 * consumers:
 */

export const SPRING_SNAP: Transition = { type: "spring", stiffness: 480, damping: 34, mass: 1 };
export const SPRING_STANDARD: Transition = { type: "spring", stiffness: 300, damping: 30, mass: 1 };
export const SPRING_GENTLE: Transition = { type: "spring", stiffness: 210, damping: 28, mass: 1 };
/** Sidebar rail collapse: same spring family, tuned snappier than its own expand ("reverses at
 * 0.8x the energy" per the spec); higher stiffness at the same damping ratio is the direct
 * Framer-spring reading of "less energy, faster settle" without inventing a fourth spring token. */
export const SPRING_COLLAPSE: Transition = { type: "spring", stiffness: 375, damping: 34, mass: 1 };

export const EASE_OUT_FAST: Transition = { duration: 0.14, ease: [0.22, 1, 0.36, 1] };
export const EASE_OUT_SLOW: Transition = { duration: 0.24, ease: [0.22, 1, 0.36, 1] };

export const STAGGER_TIGHT = 0.024;
export const STAGGER_STANDARD = 0.04;
export const STAGGER_BARS = 0.028;

const NO_SPRING: Transition = { duration: 0 };

/** entrance-rise: 10px translateY plus opacity 0 to 1, paired with spring-standard. */
const ENTRANCE_RISE: Variants = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } };
/** entrance-rise-large: 16px, paired with spring-gentle. Heroes only. */
const ENTRANCE_RISE_LARGE: Variants = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };
const NO_MOTION: Variants = { hidden: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0 } };

// ---------------------------------------------------------------------------------------------
// Back-compat: V2/V3 names and shapes, unchanged behavior, still exported and still correct to use
// where a call site already reaches for them. New code should prefer the V4 names below them.
// ---------------------------------------------------------------------------------------------

export const MOTION_FAST: Transition = EASE_OUT_FAST;
export const MOTION_BASE: Transition = EASE_OUT_SLOW;
/** The sidebar rail's width tween and any other drawer-like expand/collapse (the "open" energy). */
export const MOTION_DRAWER: Transition = SPRING_STANDARD;
/** V3 name for the shared spring; now equal to SPRING_STANDARD ("cards, panels, morphs, drags" is
 * exactly spring-standard's bucket), see motion-spec.md section 1. */
export const SPRING_TRANSITION: Transition = SPRING_STANDARD;
const RISE_IN = ENTRANCE_RISE;

/**
 * One orchestrated entrance moment per view, honoring prefers-reduced-motion. Spread `transition`
 * onto a motion component and use `variants` with initial="hidden" animate="visible". This is the
 * `pageTransition` preset: fade + 10px rise on spring-standard (outgoing content on a route change
 * is a separate, simpler 90ms opacity fade, not exposed as a hook since it has no state: just fade
 * the outgoing tree over EASE_OUT_FAST's duration on unmount).
 */
export function useMotionPreset(): {
  transition: Transition;
  fast: Transition;
  variants: Variants;
} {
  const reduced = useReducedMotion();

  return {
    transition: reduced ? { duration: 0 } : SPRING_STANDARD,
    fast: reduced ? { duration: 0 } : EASE_OUT_FAST,
    variants: reduced ? NO_MOTION : RISE_IN,
  };
}

/** Alias of useMotionPreset's variants/transition, named to match the "pageTransition" preset. */
export const PAGE_TRANSITION_VARIANTS = RISE_IN;

/**
 * entrance-rise-large: the hero-only variant of useMotionPreset, 16px rise on spring-gentle instead
 * of 10px on spring-standard. Reserved for the single hero moment on a view (motion-spec.md section
 * 3's dashboard hero card, an event header), never a plain card.
 */
export function useHeroEntrance(): { transition: Transition; variants: Variants } {
  const reduced = useReducedMotion();

  return {
    transition: reduced ? { duration: 0 } : SPRING_GENTLE,
    variants: reduced ? NO_MOTION : ENTRANCE_RISE_LARGE,
  };
}

/**
 * A list/grid whose children reveal 40ms apart via the container's staggerChildren. Spread
 * `container` onto the parent (initial="hidden" animate="visible") and `item` onto each child.
 * Reduced motion collapses the stagger to a single instant reveal. Unbounded: for a list that can
 * exceed 30 items, prefer useEntranceCascade below, which implements motion-spec.md law 6 (cap the
 * cascade at the first 12, the rest appear together) instead of staggering every row.
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

/** whileTap target for any pressable control driven by Framer Motion rather than CSS :active. */
export const PILL_TAP = { scale: 0.97 };
/** V3 published name for PILL_TAP; identical value. */
export const pillPress = PILL_TAP;

/**
 * Panel/sheet entrance: slides in from an edge plus a fade, on spring-standard. Covers the
 * notification panel ("slides from the right edge 16px plus fade"), a change-request sheet, and
 * any other edge-anchored panel; the command palette's center-anchored scale-fade is a different
 * shape (`useMotionPreset`'s rise, scaled, not an edge slide) and doesn't use this. `edge` picks
 * the axis and direction the panel travels from; `distance` defaults to 16px per the notification
 * panel's spec value, override for a wider sheet (e.g. 24 to 32px reads better on a full-height
 * side sheet).
 *
 *   const { variants, transition } = useSheetEntrance("right");
 *   <motion.div initial="hidden" animate="visible" exit="hidden" variants={variants} transition={transition}>
 */
export function useSheetEntrance(
  edge: "left" | "right" | "top" | "bottom",
  distance = 16,
): { variants: Variants; transition: Transition } {
  const reduced = useReducedMotion();
  const offset = reduced ? 0 : distance;
  const axis = edge === "left" || edge === "right" ? "x" : "y";
  const sign = edge === "right" || edge === "bottom" ? 1 : -1;

  return {
    variants: {
      hidden: { opacity: 0, [axis]: offset * sign },
      visible: { opacity: 1, [axis]: 0 },
    },
    transition: reduced ? NO_SPRING : SPRING_STANDARD,
  };
}

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
 * Animates a numeral from its previous value to `target`. Entrance (first mount) rolls over 480ms;
 * a live value change on an already-mounted numeral rolls over 320ms, matching motion-spec.md
 * section 6 ("count-up... 480ms... changed live values roll... over 320ms"); pass `durationMs` to
 * override either case explicitly. Values under 10 keep one decimal of precision instead of
 * rounding to an integer ("values under 10 animate the decimal smoothly rather than stepping",
 * e.g. an hours stat reading 4.5), 10 and over round to a whole number. Pair with `font-mono
 * tabular-nums` on the display element so digit width never shifts. Reduced motion and an unchanged
 * target both jump straight to `target`, no re-roll on a re-render that doesn't actually change the
 * value.
 */
export function useCountUp(target: number, durationMs?: number): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const hasMountedRef = useRef(false);
  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const from = fromRef.current;
    const isEntrance = !hasMountedRef.current;
    hasMountedRef.current = true;

    if (reduced || from === target) {
      setValue(target);
      fromRef.current = target;
      return;
    }

    const duration = durationMs ?? (isEntrance ? 480 : 320);
    const decimals = Math.abs(target) < 10 ? 1 : 0;
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const raw = from + (target - from) * eased;
      setValue(Number(raw.toFixed(decimals)));
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

/** V3 name for useListStagger, kept as an alias: identical shape and behavior. New code (and any
 * list that can plausibly exceed 30 items) should reach for useEntranceCascade below instead. */
export function useEntranceCascade(staggerMs = 40): { container: Variants; item: Variants } {
  return useListStagger(staggerMs);
}

/**
 * Per-item entrance for a list that must obey motion-spec.md law 6 ("lists longer than 30 items do
 * not stagger; the first 12 cascade, the rest appear with them"). Unlike useEntranceCascade (which
 * staggers via a parent's staggerChildren and has no item count to cap against), this returns an
 * `item(index, total)` function: call it per row for `variants`/`transition`, with
 * initial="hidden" animate="visible" set once on each row directly (not on a shared parent).
 *
 *   const cascade = useCascadeItem();
 *   rows.map((row, i) => <motion.div key={row.id} initial="hidden" animate="visible"
 *     {...cascade.item(i, rows.length)} />)
 */
export function useCascadeItem(staggerMs = 40): {
  item: (index: number, total: number) => { variants: Variants; transition: Transition };
} {
  const reduced = useReducedMotion();
  const stagger = staggerMs / 1000;

  return {
    item: (index, total) => {
      if (reduced) return { variants: NO_MOTION, transition: NO_SPRING };
      const cappedIndex = total > 30 ? Math.min(index, 12) : index;
      return { variants: RISE_IN, transition: { ...SPRING_STANDARD, delay: cappedIndex * stagger } };
    },
  };
}

/**
 * Schedule bars sweeping in left to right on first render, once (coverage board, timeline, my
 * schedule strip). Render each bar with `style={{ transformOrigin: "left" }}`, spread `transition`
 * with a per-index delay from `drawInDelay(index)` below, and these variants (initial="hidden"
 * animate="visible"). Caps at the first 24 bars per motion-spec.md section 4 ("stagger-bars ordered
 * left to right by start time, capped at the first 24 bars"): pass the bar's clamped index (e.g.
 * `Math.min(index, 24)`) into drawInDelay yourself, same capping shape as useCascadeItem, kept as a
 * plain function here since the caller already has to sort bars by start time regardless. Reduced
 * motion jumps straight to the drawn-in state.
 */
export function useDrawIn(): { variants: Variants; transition: Transition } {
  const reduced = useReducedMotion();

  return {
    variants: {
      hidden: { scaleX: reduced ? 1 : 0, opacity: reduced ? 1 : 0.4 },
      visible: { scaleX: 1, opacity: 1 },
    },
    transition: reduced ? NO_SPRING : SPRING_STANDARD,
  };
}
/** Per-index delay helper for useDrawIn's stagger. Clamp `index` to 24 yourself for lists longer
 * than that (see useDrawIn's doc comment) so the remainder lands with the 24th bar, not later. */
export function drawInDelay(index: number, staggerMs = 28): number {
  return (index * staggerMs) / 1000;
}

/**
 * Hover lift: cards rise 2px with the shadow deepening. V4 note: the glow budget is zero by
 * default (motion-spec.md law "nothing glows outside the gradient panel and the AI reveal"), so
 * this class string now deepens shadow-soft's ambient 1px/2px shadow rather than introducing
 * shadow-glow on every hovered card the way V3 did; components that are allowed to glow (the
 * gradient panel) opt into shadow-glow directly in their own markup, not through this preset.
 */
export const HOVER_LIFT_CLASSES =
  "transition-[transform,box-shadow] duration-base ease-neu-out motion-reduce:transition-[box-shadow] hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(0,0,0,0.4)]";

/**
 * Shared-element morph, spring-standard. The exact four seams (motion-spec.md section 5): shift
 * bar to shift detail panel, event card to event page header, quickchat chip to its answer card,
 * person chip to bar avatar on assignment. Give the source and destination the same Framer Motion
 * `layoutId`. Text inside the morphing element crossfades at the midpoint: outgoing text animates
 * opacity 1 to 0 over the transition's first 40%, incoming animates 0 to 1 over the last 40%; see
 * MORPH_TEXT_OUTGOING/MORPH_TEXT_INCOMING below for the two variant objects, both keyed on the same
 * "hidden"/"visible" states so they can share one `animate` prop with the parent morph.
 * Independent scrim: fade any backing scrim on its own opacity transition, not tied to the morph.
 * Where routing prevents a true layoutId morph (a hard navigation), fall back to useMotionPreset's
 * pageTransition instead of a broken half-morph.
 */
export const MORPH_TRANSITION: Transition = SPRING_STANDARD;
/** Spring-standard settles in roughly 240ms; the text crossfade timings below are fractions of
 * that window (40%/60% split, per the spec), not tied to the spring's own (non-duration-based)
 * transition, since a spring transition has no `duration` field to read. */
const MORPH_WINDOW_MS = 240;
export const MORPH_TEXT_OUTGOING: Variants = {
  visible: { opacity: 1 },
  hidden: { opacity: 0, transition: { duration: (MORPH_WINDOW_MS * 0.4) / 1000, ease: [0.22, 1, 0.36, 1] } },
};
export const MORPH_TEXT_INCOMING: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delay: (MORPH_WINDOW_MS * 0.6) / 1000, duration: (MORPH_WINDOW_MS * 0.4) / 1000, ease: [0.22, 1, 0.36, 1] },
  },
};

/**
 * Crossfades the whole document between light and dark via the View Transitions API where
 * supported (Chromium/Safari 18+), falling back to an instant swap. Call this wrapping the actual
 * DOM mutation (setting the data-theme attribute), not after it: `startThemeTransition(() =>
 * setTheme(next))`. See src/lib/theme/use-theme.ts and theme-toggle.tsx (the icon's own 180 degree
 * spring-snap rotation is separate, driven by the toggle component's own `animate` prop, not this
 * function). Reduced motion still uses the View Transition (it's a single opacity crossfade, not a
 * directional slide) but drops its duration via the ::view-transition-* CSS in globals.css.
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

// ---------------------------------------------------------------------------------------------
// V4: motion-spec.md sections 6 to 8 (numbers, state changes). New this pass.
// ---------------------------------------------------------------------------------------------

/**
 * Ticks a value once per second with no per-tick animation ("a ticking number IS the animation").
 * `targetDate` is a fixed timestamp (ms epoch); returns remaining whole seconds, floored at 0. The
 * caller decides display formatting (HH:MM:SS etc). `isFinalMinute` is true for the last 60
 * seconds, matching motion-spec.md's "the final 60 seconds shifts the value color to orange over
 * 1s": pair it with a plain `text-accent-warn` class change (CSS handles the 1s fade via
 * `transition-colors duration-1000`, no JS needed for that part). Reduced motion has no effect
 * here: a countdown's per-second tick is data, not decorative motion, so it never collapses.
 */
export function useCountdown(targetEpochMs: number): { secondsRemaining: number; isFinalMinute: boolean } {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const secondsRemaining = Math.max(0, Math.floor((targetEpochMs - now) / 1000));
  return { secondsRemaining, isFinalMinute: secondsRemaining <= 60 };
}

/**
 * Sparkline/chart path draw-in: dash-offset animates from the path's full length to 0 over 420ms
 * ease-out when the parent card enters. Apply `strokeDasharray={length}` and animate
 * `strokeDashoffset` from `length` to 0 with this transition (`useState`/`useRef` to measure
 * `path.getTotalLength()` is the caller's job, this only owns the timing). The area fill (if any)
 * fades in during the transition's last 150ms: pass AREA_FILL_DELAY_MS as that fade's `delay`.
 */
export const SPARKLINE_DRAW_TRANSITION: Transition = { duration: 0.42, ease: [0.22, 1, 0.36, 1] };
export const AREA_FILL_DELAY_MS = 270; // 420ms total minus the last 150ms

/**
 * MeterBar fill: springs from 0 to `value` (0 to 1) on spring-gentle when it first enters, and
 * springs between values on a live update (same spring, Framer retargets a running spring
 * automatically rather than restarting it, satisfying law 3 "springs retarget, they do not
 * restart"). Crossing into the orange/warn variant crossfades color over 200ms, handled by pairing
 * a plain `transition-colors duration-200` class on the fill element with whatever
 * threshold-crossing class swap the caller already does; no JS needed for the color part.
 */
export function useMeterFill(): { transition: Transition } {
  const reduced = useReducedMotion();
  return { transition: reduced ? NO_SPRING : SPRING_GENTLE };
}

/** Delta chip pop-in: scale 0.9 to 1 on spring-snap. Spec: fires 80ms after its number finishes
 * rolling, so pass `{ ...DELTA_CHIP_POP_TRANSITION, delay: 0.08 }` once the paired useCountUp
 * settles (or a fixed 0.08 delay against the count-up's own known duration if it's simpler to not
 * track completion state). */
export const DELTA_CHIP_POP_VARIANTS: Variants = { hidden: { opacity: 0, scale: 0.9 }, visible: { opacity: 1, scale: 1 } };
export const DELTA_CHIP_POP_TRANSITION: Transition = SPRING_SNAP;

/**
 * The status-change atom (motion-spec.md section 7): "the dot color crossfades 200ms while the
 * text swaps via a 6px vertical slot-machine slide (old up-out, new up-in, 180ms). This is the
 * atom of the approval experience; it must feel precise." Two paired variant sets: the dot's
 * `animate` target is just its own color class (a plain `transition-colors duration-200`, no
 * Framer needed for a solid-fill color crossfade), the text needs AnimatePresence with `mode="wait"`
 * or a manual old/new pair using these variants (initial="enter" animate="center" exit="exit").
 */
export const STATUS_TEXT_SLIDE_VARIANTS: Variants = {
  enter: { y: 6, opacity: 0 },
  center: { y: 0, opacity: 1 },
  exit: { y: -6, opacity: 0 },
};
export const STATUS_TEXT_SLIDE_TRANSITION: Transition = { duration: 0.18, ease: [0.22, 1, 0.36, 1] };

/**
 * Realtime glint: a single 1px hairline opacity sweep marking "this changed because of someone
 * else, not you" (motion-spec.md section 7: a member's own approval gets a 500ms glint, a realtime
 * change from another user gets 300ms). `durationMs` defaults to the "someone else changed this"
 * case; pass 500 for the self-approval variant. Render an absolutely positioned 1px-tall element
 * along the row's edge with `background: var(--accent-primary-glow)` and animate opacity through
 * these keyframes once (`animate={{ opacity: GLINT_KEYFRAMES }}`, no `variants` needed for a
 * fire-once keyframe array).
 */
export const GLINT_KEYFRAMES = [0, 1, 0];
export function glintTransition(durationMs = 300): Transition {
  return { duration: durationMs / 1000, ease: [0.22, 1, 0.36, 1], times: [0, 0.5, 1] };
}

/**
 * The "refusal" cue for a locked/blocked interaction (motion-spec.md section 8: painting over a
 * class-locked cell tilts its little book icon 2 degrees and back). Small, no color change, no
 * shake. Reuse for any similar "this can't happen right now" micro-feedback.
 */
export const TILT_REFUSE_VARIANTS: Variants = { rest: { rotate: 0 }, tilt: { rotate: 2 } };
export const TILT_REFUSE_TRANSITION: Transition = SPRING_SNAP;
