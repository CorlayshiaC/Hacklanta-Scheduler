"use client";

import { useEffect, useMemo, useState, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * STUB(agent-1): `TimelineTrack` + `TimelinePill` per the V2 shared directive ("a horizontal
 * scrollable track with a mono date axis and event pills placed along it, with a today marker
 * line... keep it generic enough for other horizontal time layouts"). Not published in
 * `components/ui/` yet. Generic on purpose: the semester events timeline (day-granularity ticks,
 * `TimelinePill` per event) and the horizontal by-person schedule (hour-granularity ticks,
 * `TimelinePill` per assignment) both compose it, nothing schedule- or event-specific lives here.
 * Swap the import for Agent 1's real version once published, same `timeToX`/`TimelinePill` shape.
 * Tracking removal: grep STUB(agent-1) in this file.
 */

export type TimelineAxisUnit = "hour" | "day";

export type TimelineTrackProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  /** Start of the visible window. */
  start: Date;
  end: Date;
  /** Pixels per millisecond, i.e. zoom level. Compute from a target px-per-hour or px-per-day. */
  pxPerMs: number;
  axisUnit: TimelineAxisUnit;
  timeZone: string;
  showTodayMarker?: boolean;
  /** Absolutely positioned content (typically a list of `TimelinePill`s), rendered under the axis. */
  children: ReactNode;
  /** Content height in px, excluding the axis row. */
  contentHeight?: number;
};

/** Pixel offset of `date` from `start`, in the current pxPerMs scale. */
export function timeToX(date: Date | string, start: Date, pxPerMs: number): number {
  return (new Date(date).getTime() - start.getTime()) * pxPerMs;
}

function buildTicks(start: Date, end: Date, unit: TimelineAxisUnit, timeZone: string) {
  const ticks: { date: Date; label: string }[] = [];

  if (unit === "hour") {
    const cursor = new Date(start);
    cursor.setMinutes(0, 0, 0);
    if (cursor.getTime() < start.getTime()) {
      cursor.setHours(cursor.getHours() + 1);
    }
    const formatter = new Intl.DateTimeFormat("en-US", { hour: "numeric", timeZone });
    while (cursor.getTime() <= end.getTime()) {
      ticks.push({ date: new Date(cursor), label: formatter.format(cursor) });
      cursor.setHours(cursor.getHours() + 1);
    }
    return ticks;
  }

  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  if (cursor.getTime() < start.getTime()) {
    cursor.setDate(cursor.getDate() + 1);
  }
  const formatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone });
  while (cursor.getTime() <= end.getTime()) {
    ticks.push({ date: new Date(cursor), label: formatter.format(cursor) });
    cursor.setDate(cursor.getDate() + 1);
  }
  return ticks;
}

export function TimelineTrack({
  className,
  start,
  end,
  pxPerMs,
  axisUnit,
  timeZone,
  showTodayMarker = true,
  children,
  contentHeight,
  ...props
}: TimelineTrackProps) {
  const totalWidth = Math.max(1, (end.getTime() - start.getTime()) * pxPerMs);
  const ticks = useMemo(() => buildTicks(start, end, axisUnit, timeZone), [start, end, axisUnit, timeZone]);

  // Deliberately not a lazy useState initializer: that runs during the SSR pass too (server has
  // no real "now" to agree on with the client), so it would hydration-mismatch the very first
  // client render against the server's. Starting at null and setting once in an effect is the
  // React-documented pattern for exactly this ("state that must differ between server and
  // client"), the one-time extra render this causes is the accepted cost of that, not a bug.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
    setNow(Date.now());
  }, []);

  const nowX = useMemo(() => {
    if (!showTodayMarker || now === null || now < start.getTime() || now > end.getTime()) {
      return null;
    }
    return timeToX(new Date(now), start, pxPerMs);
  }, [start, end, pxPerMs, showTodayMarker, now]);

  return (
    <div className={cn("relative", className)} style={{ width: totalWidth }} {...props}>
      <div className="sticky top-0 z-10 h-6 border-b border-hairline bg-card">
        {ticks.map((tick) => (
          <span
            className="absolute top-0 whitespace-nowrap font-mono text-[10px] tabular-nums text-text-secondary"
            key={tick.date.toISOString()}
            style={{ left: timeToX(tick.date, start, pxPerMs) + 4 }}
          >
            {tick.label}
          </span>
        ))}
      </div>
      <div className="relative" style={contentHeight !== undefined ? { height: contentHeight } : undefined}>
        {children}
        {nowX !== null ? (
          <div aria-hidden className="pointer-events-none absolute inset-y-0 z-10 w-px bg-accent-warn" style={{ left: nowX }} />
        ) : null}
      </div>
    </div>
  );
}

export type TimelinePillProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  start: Date | string;
  end: Date | string;
  trackStart: Date;
  pxPerMs: number;
  minWidth?: number;
  top?: number;
  children: ReactNode;
};

export function TimelinePill({
  className,
  start,
  end,
  trackStart,
  pxPerMs,
  minWidth = 24,
  top,
  children,
  ...props
}: TimelinePillProps) {
  const left = timeToX(start, trackStart, pxPerMs);
  const width = Math.max(minWidth, timeToX(end, trackStart, pxPerMs) - left);

  return (
    <div
      className={cn("absolute", className)}
      style={{ left, width, top }}
      {...props}
    >
      {children}
    </div>
  );
}
