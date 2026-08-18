"use client";

import { forwardRef, type ButtonHTMLAttributes, type KeyboardEvent, type MouseEvent } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * The availability primitive: a single cell in a dot matrix. Idle dots are dim, painting snaps a
 * dot to purple with a small scale pop, an AI-drafted (unconfirmed) window renders as a hollow
 * purple ring. Designed for drag-paint and touch-paint grids: interactive dots are real buttons so
 * pointerdown/pointerenter/pointerup handlers on the caller's grid container work unmodified
 * (pass them through via className/props, this component does not swallow pointer events).
 */
export type MatrixDotState = "idle" | "painted" | "draft";
export type MatrixDotSize = "sm" | "md" | "lg";

export type MatrixDotProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  state: MatrixDotState;
  interactive?: boolean;
  size?: MatrixDotSize;
  /** Accessible label, e.g. "Tuesday 2:00 PM". Required when interactive so the grid stays usable by screen readers. */
  "aria-label"?: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
};

const SIZE_CLASSES: Record<MatrixDotSize, string> = {
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
};

export const MatrixDot = forwardRef<HTMLButtonElement, MatrixDotProps>(
  ({ className, state, interactive = false, size = "md", onClick, onKeyDown, type = "button", ...props }, ref) => {
    function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
      onKeyDown?.(event);
      if (!interactive || !onClick || event.defaultPrevented) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onClick(event as unknown as MouseEvent<HTMLButtonElement>);
    }

    return (
      <button
        ref={ref}
        type={type}
        tabIndex={interactive ? 0 : -1}
        aria-pressed={interactive ? state === "painted" : undefined}
        disabled={!interactive}
        onClick={onClick}
        onKeyDown={interactive ? handleKeyDown : onKeyDown}
        className={cn(
          "inline-flex shrink-0 touch-none items-center justify-center rounded-full outline-none",
          "transition-transform duration-fast ease-neu-out motion-reduce:transition-none",
          "disabled:pointer-events-none",
          interactive && "cursor-pointer focus-visible:shadow-focus-ring",
          className,
        )}
        {...props}
      >
        <span
          aria-hidden
          className={cn(
            "block rounded-full transition-[transform,background-color,border-color] duration-fast ease-neu-out motion-reduce:transition-none",
            SIZE_CLASSES[size],
            state === "idle" && "bg-elevated",
            state === "painted" && "scale-110 bg-accent-go",
            state === "draft" && "border-2 border-accent-go bg-transparent",
          )}
        />
      </button>
    );
  },
);
MatrixDot.displayName = "MatrixDot";
