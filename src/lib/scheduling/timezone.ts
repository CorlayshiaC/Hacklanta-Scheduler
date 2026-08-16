/**
 * Converts a `datetime-local` input value (wall-clock, no timezone information per the HTML spec)
 * into a UTC ISO instant, interpreting it in the given IANA timezone rather than the browser's
 * ambient one. Dependency-free: this project avoids adding date-fns-tz for one conversion, see
 * docs/contracts/requests.md.
 *
 * Not exact across a DST transition instant itself (the offset is sampled at the first guess, not
 * solved iteratively), the same ambiguity every "local time in named zone" library has for the one
 * repeated or skipped hour twice a year. Fine for event/shift scheduling at whole- or
 * quarter-hour granularity.
 */
export function zonedTimeToUtcIso(localDateTimeValue: string, timeZone: string): string {
  const [datePart, timePart] = localDateTimeValue.split("T");
  const [year, month, day] = (datePart ?? "").split("-").map(Number);
  const [hour, minute] = (timePart ?? "").split(":").map(Number);

  const utcGuessMs = Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0);
  const offsetMinutes = timeZoneOffsetMinutes(new Date(utcGuessMs), timeZone);

  return new Date(utcGuessMs - offsetMinutes * 60_000).toISOString();
}

/** Minutes the given timezone is ahead of UTC at `date` (negative for zones behind UTC). */
function timeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  const asUtcMs = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );

  return (asUtcMs - date.getTime()) / 60_000;
}
