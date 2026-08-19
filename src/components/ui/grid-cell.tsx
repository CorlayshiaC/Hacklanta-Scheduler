"use client";

import { forwardRef, type HTMLAttributes, type KeyboardEvent, type MouseEvent } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Legacy per-cell grid primitive, kept for the callers that already depend on its exact API
 * (dense availability/my-schedule grids). For a shift spanning a time range with headcount and
 * avatars, prefer ShiftCapsule; for a single availability dot, prefer MatrixDot. See
 * docs/contracts/design.md "Migration strategy".
 *
 * "selected" is a separate axis from headcount: availability painting, not fill count. Legible
 * without color: pass filled/needed for a mono "2/3" count, "conflict" also carries a small dot,
 * so colorblind users are never relying on the fill tint alone. See docs/contracts/design.md.
 */
export type GridCellState = "empty" | "partial" | "full" | "selected" | "conflict";
export type GridCellSize = "sm" | "md" | "lg";

export type GridCellProps = Omit<HTMLAttributes<HTMLDivElement>, "onClick"> & {
  state: GridCellState;
  /** 0 to 1. Unused for the flat fill treatment, kept for API compatibility. */
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

export const GridCell = forwardRef<HTMLDivElement, GridCellProps>(
  (
    {
      className,
      state,
      coverage,
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
    void coverage;

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
      onKeyDown?.(event);
      if (!interactive || !onClick || event.defaultPrevented) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onClick(event as unknown as MouseEvent<HTMLDivElement>);
    }

    const showCount = filled !== undefined && needed !== undefined;

    return (
      <div
        ref={ref}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-pressed={interactive && state === "selected" ? true : undefined}
        onClick={onClick}
        onKeyDown={interactive ? handleKeyDown : onKeyDown}
        className={cn(
          "relative flex items-center justify-center overflow-hidden rounded-full outline-none",
          "transition-[transform,background-color,border-color] duration-fast ease-neu-out motion-reduce:transition-none",
          SIZE_CLASSES[size],
          state === "empty" && "border border-dashed border-hairline bg-elevated text-text-secondary",
          // accent-warn-fill, not accent-warn: the everyday champagne shade fails contrast under
          // on-accent white text, see tokens.css's fill-vs-glow split.
          state === "partial" && "bg-accent-warn-fill text-on-accent",
          (state === "full" || state === "selected") && "bg-accent-go text-on-accent",
          state === "conflict" && "border-2 border-accent-warn bg-elevated text-text-secondary",
          interactive && [
            "cursor-pointer focus-visible:shadow-focus-ring active:scale-[0.97]",
            state === "empty" && "hover:border-accent-go/60",
          ],
          className,
        )}
        {...props}
      >
        {showCount ? (
          <span className="relative font-mono tabular-nums">
            {filled}/{needed}
          </span>
        ) : null}
        {state === "conflict" ? (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-accent-warn"
          />
        ) : null}
      </div>
    );
  },
);
GridCell.displayName = "GridCell";
