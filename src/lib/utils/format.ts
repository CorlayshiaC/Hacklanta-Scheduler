import { differenceInMinutes } from "date-fns";

type DateInput = Date | string;

function toDate(value: DateInput): Date {
  return typeof value === "string" ? new Date(value) : value;
}

/**
 * `new Intl.DateTimeFormat(...)` is expensive: it resolves locale and time-zone data on every
 * construction. These formatters were being rebuilt on every call, and the call sites are inside
 * render loops, so selecting one shift on a 200-capsule coverage board constructed roughly 600 of
 * them (measured, see docs/perf-baseline.md), as did every keystroke in the assign panel's notes
 * field.
 *
 * The cache is keyed by time zone and bounded by the number of distinct zones the app renders,
 * which is one per event, so it cannot grow unbounded. Formatters are immutable and stateless, so
 * sharing an instance across call sites is safe and produces byte-identical output. This is a pure
 * memoization: no call site changes, no formatting behavior changes.
 */
const timeFormatters = new Map<string, Intl.DateTimeFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function timeFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = timeFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone });
    timeFormatters.set(timeZone, formatter);
  }
  return formatter;
}

function dateFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = dateFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone,
    });
    dateFormatters.set(timeZone, formatter);
  }
  return formatter;
}

/** "9:00 AM" in the given IANA time zone. Pair with the tabular-nums utility for display. */
export function formatShiftTime(value: DateInput, timeZone: string): string {
  return timeFormatter(timeZone).format(toDate(value));
}

/** "Mon, Oct 9" in the given IANA time zone. */
export function formatShiftDate(value: DateInput, timeZone: string): string {
  return dateFormatter(timeZone).format(toDate(value));
}

/** "9:00 AM–5:00 PM" in the given IANA time zone. En dash, not an em dash, per the copy rules. */
export function formatShiftRange(start: DateInput, end: DateInput, timeZone: string): string {
  return `${formatShiftTime(start, timeZone)}–${formatShiftTime(end, timeZone)}`;
}

/** Whole-minute duration between two instants, floored at 0 (never negative). */
export function getShiftDurationMinutes(start: DateInput, end: DateInput): number {
  return Math.max(0, differenceInMinutes(toDate(end), toDate(start)));
}

/** "8h", "45m", or "8h 30m" from a start/end pair. */
export function formatShiftDuration(start: DateInput, end: DateInput): string {
  const totalMinutes = getShiftDurationMinutes(start, end);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
