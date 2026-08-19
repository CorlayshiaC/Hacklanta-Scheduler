"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { DELTA_CHIP_POP_TRANSITION, DELTA_CHIP_POP_VARIANTS, useCountUp } from "@/lib/utils/motion";

export type StatBlockDelta = {
  direction: "up" | "down";
  value: string;
};

export type StatBlockProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  value: string | number;
  label: string;
  delta?: StatBlockDelta;
  /** Tweens a numeric value up/down on change via the countUp preset. Ignored for string values (e.g. "18/24"). */
  animated?: boolean;
};

const TriangleUp = () => (
  <svg aria-hidden width="7" height="7" viewBox="0 0 8 8" fill="currentColor">
    <path d="M4 0L8 8H0L4 0Z" />
  </svg>
);

const TriangleDown = () => (
  <svg aria-hidden width="7" height="7" viewBox="0 0 8 8" fill="currentColor">
    <path d="M4 8L0 0H8L4 8Z" />
  </svg>
);

/** Huge mono number/fraction, tiny secondary label (cap around 24 characters, it does not wrap), optional purple/orange delta triangle. Caller supplies its own card wrapper. */
export const StatBlock = forwardRef<HTMLDivElement, StatBlockProps>(
  ({ value, label, delta, animated = false, className, ...props }, ref) => {
    const numericTarget = typeof value === "number" ? value : null;
    const counted = useCountUp(numericTarget ?? 0);
    const displayValue = animated && numericTarget !== null ? counted : value;

    return (
      <div ref={ref} className={cn("flex flex-col gap-1", className)} {...props}>
        <span className="font-mono tabular-nums text-3xl font-bold leading-none text-text-primary md:text-4xl">
          {displayValue}
        </span>
        <span className="truncate text-[11px] font-medium text-text-secondary">{label}</span>
        {delta ? (
          <motion.span
            animate="visible"
            className={cn(
              "inline-flex w-fit items-center gap-1 rounded-control bg-surface-elevated px-2 py-0.5 font-mono text-xs",
              // Lime is reserved for positive deltas only, never a status color; down deltas stay
              // orange (warn), matching every other "needs attention" surface. See
              // docs/contracts/design.md "Data-viz".
              delta.direction === "up" ? "text-delta" : "text-accent-warn",
            )}
            initial="hidden"
            // Pops in 80ms after its number finishes rolling (motion-spec.md section 6); the
            // count-up entrance itself takes 480ms, so the pop waits that long only when this
            // block's number is actually animating.
            transition={{ ...DELTA_CHIP_POP_TRANSITION, delay: animated && numericTarget !== null ? 0.56 : 0.08 }}
            variants={DELTA_CHIP_POP_VARIANTS}
          >
            {delta.direction === "up" ? <TriangleUp /> : <TriangleDown />}
            {delta.value}
          </motion.span>
        ) : null}
      </div>
    );
  },
);
StatBlock.displayName = "StatBlock";
