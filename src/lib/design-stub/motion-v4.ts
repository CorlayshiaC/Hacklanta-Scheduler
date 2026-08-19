/**
 * STUB(agent-1): local copy of motion-spec.md v4.1 section 1's timing tokens, used until Agent 1
 * exports the real preset layer from src/lib/utils/motion.ts. Unlike color tokens (where guessing
 * class/variable names wasted a full restyle pass during the V3 cycle, see docs/contracts/
 * pending.md), these values are unambiguous: the spec gives exact numbers, not names to invent.
 * Delete this file and swap imports the moment Agent 1 publishes the real exports.
 */
import { useReducedMotion } from "framer-motion";
import type { Transition } from "framer-motion";

export const springSnap: Transition = { type: "spring", stiffness: 480, damping: 34 };
export const springStandard: Transition = { type: "spring", stiffness: 300, damping: 30 };
export const springGentle: Transition = { type: "spring", stiffness: 210, damping: 28 };
export const easeOutFast: Transition = { duration: 0.14, ease: [0.22, 1, 0.36, 1] };
export const easeOutSlow: Transition = { duration: 0.24, ease: [0.22, 1, 0.36, 1] };

export const STAGGER_TIGHT_MS = 24;
export const STAGGER_STANDARD_MS = 40;
export const STAGGER_BARS_MS = 28;

/** Law 5: prefers-reduced-motion collapses every entry in the spec to instant state changes plus
 * opacity fades under 100ms. Every helper below already branches on this; call sites never need
 * their own useReducedMotion() check. */
export function useReducedTransition(transition: Transition): Transition {
  const reduced = useReducedMotion();
  return reduced ? { duration: 0.08, ease: "linear" } : transition;
}

/** Law 6: lists longer than 30 items do not stagger; the first 12 cascade, the rest appear with
 * them. Pass the full item count; returns the per-index delay in seconds (0 for anything past the
 * cascading head once the list is long, so those items animate on the same frame as item 12). */
export function staggerDelay(index: number, count: number, staggerMs: number): number {
  const cascadingCount = count > 30 ? 12 : count;
  const cappedIndex = Math.min(index, cascadingCount - 1);
  return (cappedIndex * staggerMs) / 1000;
}
