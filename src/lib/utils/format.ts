import { differenceInMinutes } from "date-fns";

type DateInput = Date | string;

function toDate(value: DateInput): Date {
  return typeof value === "string" ? new Date(value) : value;
}

/** "9:00 AM" in the given IANA time zone. Pair with the tabular-nums utility for display. */
export function formatShiftTime(value: DateInput, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(toDate(value));
}

/** "Mon, Oct 9" in the given IANA time zone. */
export function formatShiftDate(value: DateInput, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone,
  }).format(toDate(value));
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
