"use client";

import { forwardRef, type HTMLAttributes, type KeyboardEvent, type MouseEvent } from "react";
import { cn } from "@/lib/utils/cn";
import { AvatarStack, type AvatarStackMember } from "@/components/ui/avatar-stack";

/**
 * The hero primitive of the schedule surfaces: a shift is a capsule, its color is its status. One
 * glance reads coverage across the whole board. Spans its time range on a coverage board timeline
 * (caller controls width/position via style or className, this component only owns height, shape,
 * and fill), or renders inline at a fixed size in a shift list row.
 *
 * - empty: hollow bg-elevated capsule, dashed hairline border. A hole in the schedule.
 * - partial: solid accent-warn-fill (champagne, the fill-safe shade under white text; see
 *   tokens.css) fill, filled/needed printed inside in mono. A gap.
 * - full: solid accent-go (purple) fill, AvatarStack of the assigned members inside. Staffed.
 * - selected: solid pill-white fill. "This is you" or "this is the one you picked", never headcount.
 *
 * Status must read without color: empty/partial both carry the count, full carries faces, selected
 * is a distinct fill (white, not purple or orange) so it never collides with the other three.
 */
export type ShiftCapsuleState = "empty" | "partial" | "full" | "selected";
export type ShiftCapsuleSize = "sm" | "md" | "lg";

export type ShiftCapsuleProps = Omit<HTMLAttributes<HTMLDivElement>, "onClick"> & {
  state: ShiftCapsuleState;
  /** Short label shown alongside the count/faces, e.g. a station name or time range. Truncates. */
  label?: string;
  /** Color-independent legibility cue for "empty"/"partial", rendered as a mono "2/3" count. */
  filled?: number;
  needed?: number;
  /** Rendered as an AvatarStack when state is "full". Ignored for other states. */
  members?: AvatarStackMember[];
  size?: ShiftCapsuleSize;
  interactive?: boolean;
  /** Understaffed within 24h: a slow champagne warn-hot pulse (one of warn-hot's three sanctioned
   * uses, see tokens.css). Reduced motion swaps to a static thicker warn-hot outline. */
  urgentPulse?: boolean;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
};

const SIZE_CLASSES: Record<ShiftCapsuleSize, string> = {
  sm: "h-6 gap-1 px-2 text-[10px]",
  md: "h-8 gap-1.5 px-3 text-xs",
  lg: "h-10 gap-2 px-4 text-sm",
};

export const ShiftCapsule = forwardRef<HTMLDivElement, ShiftCapsuleProps>(
  (
    {
      className,
      state,
      label,
      filled,
      needed,
      members,
      size = "md",
      interactive = false,
      urgentPulse = false,
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

    const showCount = (state === "empty" || state === "partial") && filled !== undefined && needed !== undefined;
    const showAvatars = state === "full" && members && members.length > 0;
    const pulseEligible = urgentPulse && (state === "empty" || state === "partial");

    return (
      <div
        ref={ref}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-pressed={interactive && state === "selected" ? true : undefined}
        onClick={onClick}
        onKeyDown={interactive ? handleKeyDown : onKeyDown}
        className={cn(
          "relative flex w-full min-w-0 items-center overflow-hidden rounded-pill font-medium outline-none",
          "transition-[transform,background-color,border-color] duration-fast ease-neu-out motion-reduce:transition-none",
          SIZE_CLASSES[size],
          state === "empty" && "border border-dashed border-hairline bg-elevated text-text-secondary",
          state === "partial" && "border-none bg-accent-warn-fill text-on-accent",
          state === "full" && "border-none bg-accent-go text-on-accent",
          state === "selected" && "border-none bg-pill-white text-on-accent",
          // Urgent (within 24h): a warn-hot ring, pulsing via opacity (transform/opacity only).
          // Reduced motion swaps the pulse for a static thicker warn-hot outline, still legible.
          pulseEligible && "border-2 border-accent-warn-hot animate-pulse motion-reduce:animate-none",
          interactive && "cursor-pointer focus-visible:shadow-focus-ring active:scale-[0.97]",
          className,
        )}
        {...props}
      >
        {showAvatars ? <AvatarStack className="shrink-0" max={3} members={members ?? []} size="sm" /> : null}
        {label ? <span className="min-w-0 flex-1 truncate">{label}</span> : null}
        {showCount ? (
          <span className="shrink-0 font-mono tabular-nums">
            {filled}/{needed}
          </span>
        ) : null}
      </div>
    );
  },
);
ShiftCapsule.displayName = "ShiftCapsule";
