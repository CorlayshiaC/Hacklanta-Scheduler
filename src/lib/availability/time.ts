export const HACKLANTA_TIME_ZONE = "America/New_York";

const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string) {
  const cached = dateTimeFormatterCache.get(timeZone);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  dateTimeFormatterCache.set(timeZone, formatter);
  return formatter;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getFormatter(timeZone).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  return asUtc - date.getTime();
}

export function localDateTimeToUtcIso(
  dateValue: string,
  timeValue: string,
  timeZone = HACKLANTA_TIME_ZONE,
): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue);

  if (!match || !timeMatch) {
    return null;
  }

  const [, year, month, day] = match;
  const [, hour, minute] = timeMatch;
  const localAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
  );
  let utcTime = localAsUtc;

  for (let index = 0; index < 2; index += 1) {
    const nextUtcTime = localAsUtc - getTimeZoneOffsetMs(new Date(utcTime), timeZone);

    if (nextUtcTime === utcTime) {
      break;
    }

    utcTime = nextUtcTime;
  }

  return new Date(utcTime).toISOString();
}

export function formatDateInTimeZone(iso: string, timeZone = HACKLANTA_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export function formatInputDateInTimeZone(iso: string, timeZone = HACKLANTA_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

export function formatTimeInTimeZone(iso: string, timeZone = HACKLANTA_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatInputTimeInTimeZone(iso: string, timeZone = HACKLANTA_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.hour}:${values.minute}`;
}

export function differenceInHours(startsAt: string, endsAt: string): number {
  return (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / (1000 * 60 * 60);
}

export function intervalsOverlap(
  a: { startsAt: string; endsAt: string },
  b: { startsAt: string; endsAt: string },
): boolean {
  return (
    new Date(a.startsAt).getTime() < new Date(b.endsAt).getTime() &&
    new Date(a.endsAt).getTime() > new Date(b.startsAt).getTime()
  );
}

/**
 * Lists the calendar dates (in `timeZone`) an event window touches, inclusive of both ends.
 * Used to derive day columns/groupings from an event's own start/end instead of a hardcoded
 * day array.
 */
export function listCalendarDaysInRange(startsAt: string, endsAt: string, timeZone = HACKLANTA_TIME_ZONE): string[] {
  const startDay = formatInputDateInTimeZone(startsAt, timeZone);
  const endDay = formatInputDateInTimeZone(endsAt, timeZone);
  const days: string[] = [];
  let cursor = startDay;
  let guard = 0;

  while (guard < 366) {
    days.push(cursor);

    if (cursor === endDay) {
      break;
    }

    const [year, month, day] = cursor.split("-").map(Number);
    cursor = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
    guard += 1;
  }

  return days;
}
