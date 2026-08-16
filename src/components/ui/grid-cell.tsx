"use client";

import { forwardRef, type HTMLAttributes, type KeyboardEvent, type MouseEvent } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * The shared primitive behind every schedule grid (coverage board, availability grid, my-schedule
 * week view). Implements the product's semantic depth rule: empty is sunken (a hole in the
 * schedule you can feel), partial and full rise progressively with a purple coverage fill, full
 * stays calm rather than going to a flat solid purple. "selected" is a separate axis for
 * availability painting: a pressed well that fills toward purple as the member selects it, not a
 * headcount concept.
 *
 * Legible without color: pass filled/needed for a mono "2/3" count, the state also reads from
 * depth (sunken vs. raised) and, for conflict, a hairline plus a small warning dot, so colorblind
 * users are never relying on the coverage tint alone. See docs/contracts/design.md.
 */
export type GridCellState = "empty" | "partial" | "full" | "selected" | "conflict";
export type GridCellSize = "sm" | "md" | "lg";

export type GridCellProps = Omit<HTMLAttributes<HTMLDivElement>, "onClick"> & {
  state: GridCellState;
  /** 0 to 1. Drives the purple ramp for "partial" and "selected". Ignored for other states. */
  coverage?: number;
  interactive?: boolean;
  size?: GridCellSize;
  /** Color-independent legibility cue, rendered as a small mono count, e.g. "2/3". */
  filled?: number;
  needed?: number;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
};

const SIZE_CLASSES: Record<GridCellSize, string> = {
  sm: "min-h-8 p-1 text-[10px]",
  md: "min-h-12 p-1.5 text-xs",
  lg: "min-h-16 p-2 text-sm",
};

const COVERAGE_TINT = {
  0: "bg-coverage-0",
  1: "bg-coverage-1",
  2: "bg-coverage-2",
  3: "bg-coverage-3",
  4: "bg-coverage-4",
} as const;

function coverageStep(coverage: number): keyof typeof COVERAGE_TINT {
  if (coverage <= 0) return 0;
  if (coverage < 0.34) return 1;
  if (coverage < 0.67) return 2;
  if (coverage < 1) return 3;
  return 4;
}

export const GridCell = forwardRef<HTMLDivElement, GridCellProps>(
  (
    {
      className,
      state,
      coverage = 0,
      interactive = false,
      size = "md",
      filled,
      needed,
      onClick,
      onKeyDown,
      ...props
    },
    ref,
  ) => {
    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
      onKeyDown?.(event);
      if (!interactive || !onClick || event.defaultPrevented) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onClick(event as unknown as MouseEvent<HTMLDivElement>);
    }

    const showCount = filled !== undefined && needed !== undefined;
    const tinted = state === "partial" || state === "full" || state === "selected";
    const tintClass = state === "full" ? COVERAGE_TINT[4] : COVERAGE_TINT[coverageStep(coverage)];
    const isPressedWell = state === "empty" || state === "selected";

    return (
      <div
        ref={ref}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-pressed={interactive && state === "selected" ? true : undefined}
        onClick={onClick}
        onKeyDown={interactive ? handleKeyDown : onKeyDown}
        className={cn(
          "relative flex items-center justify-center overflow-hidden rounded-neu-sm border outline-none",
          "transition-[box-shadow,border-color] duration-fast ease-neu-out",
          SIZE_CLASSES[size],
          isPressedWell && "border-hairline bg-bg-sunken shadow-neu-pressed",
          state === "partial" && "border-hairline bg-bg-surface shadow-neu-raised-sm",
          state === "full" && "border-purple-400/50 bg-bg-surface shadow-neu-raised",
          state === "conflict" && "border-danger bg-bg-surface shadow-neu-raised-sm",
          interactive && [
            "cursor-pointer focus-visible:shadow-neu-focus",
            isPressedWell ? "hover:border-purple-400/40" : "hover:shadow-neu-raised-lg",
          ],
          className,
        )}
        {...props}
      >
        {tinted ? (
          <span aria-hidden className={cn("pointer-events-none absolute inset-0", tintClass)} />
        ) : null}
        {showCount ? (
          <span className="relative font-mono tabular-nums text-text-secondary">
            {filled}/{needed}
          </span>
        ) : null}
        {state === "conflict" ? (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-warning"
          />
        ) : null}
      </div>
    );
  },
);
GridCell.displayName = "GridCell";
