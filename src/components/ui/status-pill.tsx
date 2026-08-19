"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { STATUS_TEXT_SLIDE_TRANSITION, STATUS_TEXT_SLIDE_VARIANTS } from "@/lib/utils/motion";

export type StatusPillState = "approved" | "in_approval" | "not_assigned";

export type StatusPillProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  state: StatusPillState;
  /** Overrides the default label text for this state. */
  label?: string;
};

const STATUS_PILL_LABELS: Record<StatusPillState, string> = {
  approved: "Approved",
  in_approval: "Pending approval",
  not_assigned: "Not assigned",
};

/**
 * V4: "status rendering" per docs/contracts/design.md, "never outlined badge pills". A 5px dot
 * plus plain text, dot color only carries the state, text stays readable at the same weight
 * everywhere (muted for the neutral not_assigned state, matching the shared spec's exact wording).
 * Fixed per-state styling only (no variant props): renders identically everywhere in the app.
 */
const STATUS_DOT_STYLES: Record<StatusPillState, string> = {
  approved: "bg-accent-primary",
  in_approval: "bg-accent-warn",
  not_assigned: "bg-text-secondary",
};
const STATUS_TEXT_STYLES: Record<StatusPillState, string> = {
  approved: "text-text-primary",
  in_approval: "text-text-primary",
  not_assigned: "text-text-secondary",
};

/**
 * The status-change atom (motion-spec.md section 7): the dot crossfades color over 200ms (a plain
 * CSS transition-colors, no Framer needed for a solid-fill swap) while the text swaps via a 6px
 * vertical slot-machine slide, old up-out and new up-in, 180ms, overlapping via
 * AnimatePresence mode="popLayout" rather than a sequential fade. "This is the atom of the
 * approval experience; it must feel precise."
 */
export const StatusPill = forwardRef<HTMLSpanElement, StatusPillProps>(
  ({ state, label, className, ...props }, ref) => {
    const text = label ?? STATUS_PILL_LABELS[state];

    return (
      <span
        ref={ref}
        className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium", className)}
        {...props}
      >
        <span aria-hidden className={cn("h-[5px] w-[5px] shrink-0 rounded-full transition-colors duration-200", STATUS_DOT_STYLES[state])} />
        <span className="relative inline-block overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={text}
              animate="center"
              className={cn("inline-block", STATUS_TEXT_STYLES[state])}
              exit="exit"
              initial="enter"
              transition={STATUS_TEXT_SLIDE_TRANSITION}
              variants={STATUS_TEXT_SLIDE_VARIANTS}
            >
              {text}
            </motion.span>
          </AnimatePresence>
        </span>
      </span>
    );
  },
);
StatusPill.displayName = "StatusPill";
