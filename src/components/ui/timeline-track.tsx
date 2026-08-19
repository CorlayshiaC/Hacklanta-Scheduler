"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useMemo,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Generic horizontal time axis. Positions children by percentage through a numeric range via
 * context, so this file and TimelinePill know nothing about "events" or "shifts" — a semester-wide
 * events board and a compact personal-schedule strip both go through the same API. Row layout
 * (stacking pills that would otherwise overlap in time) is the caller's job, same as any
 * Gantt-style component: nest TimelinePill inside your own "relative" row wrapper per lane when
 * pills can overlap; a bare TimelinePill positions only its "left"/"width", its vertical position
 * follows normal block flow (CSS's static-position fallback for an inset-less absolute element),
 * so sequential pills in one row wrapper stack top-aligned by default.
 */

type TimelineRange = { startMs: number; endMs: number };

const TimelineRangeContext = createContext<TimelineRange | null>(null);

function useTimelineRange(): TimelineRange {
  const range = useContext(TimelineRangeContext);
  if (!range) {
    throw new Error("TimelinePill must be rendered inside a TimelineTrack.");
  }
  return range;
}

function toMs(value: Date | string): number {
  return typeof value === "string" ? new Date(value).getTime() : value.getTime();
}

function percentInRange(atMs: number, range: TimelineRange): number {
  const span = range.endMs - range.startMs;
  if (span <= 0) return 0;
  return ((atMs - range.startMs) / span) * 100;
}

/** Never smaller than this, so a single-point or very short pill is still visible/tappable. */
const MIN_VISIBLE_PERCENT = 2;

export type TimelineTick = { at: Date | string; label: string };

export type TimelineTrackProps = {
  rangeStart: Date | string;
  rangeEnd: Date | string;
  /** Defaults to now. Injectable so server-rendered output is deterministic if a caller wants that. */
  today?: Date | string;
  /** Mono axis labels; caller supplies already-formatted strings, this primitive does no date
      formatting or timezone math of its own — that is each feature agent's job with their own date
      utilities. */
  ticks?: TimelineTick[];
  /** Approximate pixels per day for the scrollable inner track's intrinsic width. Default 64. Lower
      it for compact personal strips, raise it for a roomier semester view. */
  pxPerDay?: number;
  /** TimelinePill elements (or anything else positioned via the internal range context, but
      TimelinePill is the normal case). */
  children: ReactNode;
  className?: string;
};

export const TimelineTrack = forwardRef<HTMLDivElement, TimelineTrackProps>(
  ({ rangeStart, rangeEnd, today, ticks, pxPerDay = 64, children, className }, ref) => {
    const range = useMemo<TimelineRange>(
      () => ({ startMs: toMs(rangeStart), endMs: toMs(rangeEnd) }),
      [rangeStart, rangeEnd],
    );

    const daysBetween = Math.max((range.endMs - range.startMs) / 86400000, 0);
    const innerWidthPx = Math.max(daysBetween * pxPerDay, 1);

    const todayMs = toMs(today ?? new Date());
    const todayVisible = todayMs >= range.startMs && todayMs <= range.endMs;
    const todayPercent = todayVisible ? percentInRange(todayMs, range) : 0;

    return (
      <TimelineRangeContext.Provider value={range}>
        <div ref={ref} className={cn("overflow-x-auto", className)}>
          <div className="relative pb-5" style={{ minWidth: `${innerWidthPx}px` }}>
            {children}
            {todayVisible ? (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-px bg-accent-go/60"
                style={{ left: `${todayPercent}%` }}
              />
            ) : null}
            {ticks?.map((tick, index) => (
              <span
                key={`${tick.label}-${index}`}
                className="pointer-events-none absolute bottom-0 whitespace-nowrap font-mono text-[10px] text-text-secondary"
                style={{ left: `${percentInRange(toMs(tick.at), range)}%` }}
              >
                {tick.label}
              </span>
            ))}
          </div>
        </div>
      </TimelineRangeContext.Provider>
    );
  },
);
TimelineTrack.displayName = "TimelineTrack";

export type TimelinePillTone = "go" | "warn" | "neutral" | "white";

export type TimelinePillProps = {
  /** Point-in-time or range start. */
  start: Date | string;
  /** Omit for a point-in-time marker (renders as a small dot + label, not a spanning bar). */
  end?: Date | string;
  label: string;
  tone?: TimelinePillTone;
  onClick?: () => void;
  className?: string;
};

const BAR_TONE_CLASSES: Record<TimelinePillTone, string> = {
  go: "bg-accent-go text-on-accent",
  // accent-warn is the everyday champagne shade, not fill-safe under on-accent white text (see
  // tokens.css); accent-warn-fill is the one shade computed to pass AA as a solid fill.
  warn: "bg-accent-warn-fill text-on-accent",
  white: "bg-pill-white text-on-accent",
  neutral: "border border-hairline bg-elevated text-text-secondary",
};

const DOT_TONE_CLASSES: Record<TimelinePillTone, string> = {
  go: "bg-accent-go",
  warn: "bg-accent-warn",
  white: "bg-pill-white",
  neutral: "border border-hairline bg-elevated",
};

export const TimelinePill = forwardRef<HTMLDivElement, TimelinePillProps>(
  ({ start, end, label, tone = "go", onClick, className }, ref) => {
    const range = useTimelineRange();
    const span = range.endMs - range.startMs;
    const hasEnd = end !== undefined;

    const startMs = toMs(start);
    const rawLeft = span > 0 ? ((startMs - range.startMs) / span) * 100 : 0;
    const leftPercent = Math.min(Math.max(rawLeft, 0), 100);

    let widthPercent: number | undefined;
    if (hasEnd) {
      const endMs = toMs(end);
      const rawWidth = span > 0 ? ((endMs - startMs) / span) * 100 : 0;
      widthPercent = Math.max(rawWidth, MIN_VISIBLE_PERCENT);
    }

    const interactive = Boolean(onClick);

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
      if (!interactive || event.defaultPrevented) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onClick?.();
    }

    function handleClick() {
      onClick?.();
    }

    const sharedProps = {
      ref,
      role: interactive ? ("button" as const) : undefined,
      tabIndex: interactive ? 0 : undefined,
      onClick: interactive ? handleClick : undefined,
      onKeyDown: interactive ? handleKeyDown : undefined,
    };

    if (hasEnd) {
      return (
        <div
          {...sharedProps}
          className={cn(
            "absolute top-0 flex h-6 min-w-0 items-center overflow-hidden rounded-pill px-2 text-xs font-medium outline-none",
            "transition-[transform,background-color,border-color] duration-fast ease-neu-out motion-reduce:transition-none",
            BAR_TONE_CLASSES[tone],
            interactive && "cursor-pointer focus-visible:shadow-focus-ring active:scale-[0.97]",
            className,
          )}
          style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
        >
          <span className="min-w-0 flex-1 truncate">{label}</span>
        </div>
      );
    }

    return (
      <div
        {...sharedProps}
        className={cn(
          "absolute top-0 flex items-center gap-1.5 rounded-pill outline-none",
          "transition-transform duration-fast ease-neu-out motion-reduce:transition-none",
          interactive && "cursor-pointer focus-visible:shadow-focus-ring active:scale-[0.97]",
          className,
        )}
        style={{ left: `${leftPercent}%` }}
      >
        <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", DOT_TONE_CLASSES[tone])} />
        <span
          className={cn(
            "whitespace-nowrap rounded-pill px-2 py-0.5 text-[10px] font-medium",
            BAR_TONE_CLASSES[tone],
          )}
        >
          {label}
        </span>
      </div>
    );
  },
);
TimelinePill.displayName = "TimelinePill";
