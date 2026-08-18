"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import { useCountUp } from "@/lib/utils/motion";

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
        <span className="truncate text-xs font-medium uppercase tracking-wide text-text-secondary">{label}</span>
        {delta ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 font-mono text-xs",
              delta.direction === "up" ? "text-accent-go" : "text-accent-warn",
            )}
          >
            {delta.direction === "up" ? <TriangleUp /> : <TriangleDown />}
            {delta.value}
          </span>
        ) : null}
      </div>
    );
  },
);
StatBlock.displayName = "StatBlock";
