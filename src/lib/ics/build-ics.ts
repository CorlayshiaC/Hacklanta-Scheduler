/**
 * Pure RFC 5545 (iCalendar) builder. No Next.js/Supabase imports on purpose, unit testable in isolation
 * (see tests/unit/build-ics.test.ts) and reusable across every /api/feeds/* route without those routes
 * duplicating fold/escape logic.
 *
 * Deliberately UTC-only: every DTSTART/DTEND is emitted as a trailing-"Z" UTC timestamp computed
 * directly from the input ISO string's UTC representation, no VTIMEZONE block. Google Calendar and
 * Apple Calendar both interpret bare "Z" timestamps correctly without one, and hand-encoding
 * America/New_York's DST transition rules would be a lot of surface area for no behavioral gain.
 */

const PRODID = "-//progsu//prog-scheduler//EN";

/** RFC 5545 section 3.1: content lines SHOULD NOT exceed 75 octets, excluding the line break. */
const FOLD_LIMIT_OCTETS = 75;

const textEncoder = new TextEncoder();

export type IcsEvent = {
  /** Stable across regenerations of the same underlying row, e.g. "${assignment.id}@prog-scheduler". */
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  /** ISO 8601. Any offset is accepted; only the UTC instant it represents is used. */
  startsAt: string;
  /** ISO 8601. Any offset is accepted; only the UTC instant it represents is used. */
  endsAt: string;
};

export type BuildIcsCalendarOptions = {
  calendarName: string;
};

/**
 * Escapes a TEXT-valued property per RFC 5545 section 3.3.11: backslash, semicolon, and comma get a
 * backslash prefix, and any line break becomes the two-character literal "\n". Order matters, backslash
 * must be escaped first or the escaping of the other three characters would itself get re-escaped.
 */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Formats an ISO 8601 instant as a UTC iCalendar DATE-TIME, e.g. "20260816T070000Z". Truncates to whole
 * seconds (iCalendar DATE-TIME has no fractional-second form) rather than rounding, matching how a
 * calendar app itself would read the value back.
 */
export function toIcsUtcTimestamp(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`toIcsUtcTimestamp: invalid date "${iso}"`);
  }

  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/**
 * Folds one unfolded logical content line into RFC 5545's physical-line form: no physical line exceeds
 * 75 octets (continuation lines included, whose leading single space counts toward that budget), and no
 * multi-octet UTF-8 character is ever split across a fold boundary. Splits on Unicode code points (not
 * UTF-16 code units) so an astral character is also never torn in half.
 */
export function foldIcsLine(line: string): string {
  if (textEncoder.encode(line).length <= FOLD_LIMIT_OCTETS) {
    return line;
  }

  let result = "";
  let currentLineOctets = 0;

  for (const char of line) {
    const charOctets = textEncoder.encode(char).length;

    if (currentLineOctets + charOctets > FOLD_LIMIT_OCTETS) {
      result += "\r\n ";
      currentLineOctets = 1; // the folding space itself occupies one octet of the new physical line
    }

    result += char;
    currentLineOctets += charOctets;
  }

  return result;
}

function buildEventLines(event: IcsEvent, dtstamp: string): string[] {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(event.uid)}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${toIcsUtcTimestamp(event.startsAt)}`,
    `DTEND:${toIcsUtcTimestamp(event.endsAt)}`,
    `SUMMARY:${escapeIcsText(event.summary)}`,
  ];

  if (event.location) {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  }

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  }

  lines.push("END:VEVENT");

  return lines;
}

/**
 * Turns arbitrary user-entered text (a shift or event title) into an ASCII-safe ".ics" filename for a
 * Content-Disposition header: strips accents to their base letter, drops anything left outside the
 * printable-ASCII range, then collapses whitespace/punctuation to single hyphens. Falls back to
 * `fallbackStem` when that leaves nothing usable (e.g. a title that was emoji-only).
 */
export function toIcsFilename(title: string, fallbackStem = "calendar"): string {
  const asciiOnly = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // combining diacritical marks left behind by NFKD normalization
    .replace(/[^\x20-\x7e]/g, "");

  const slug = asciiOnly
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || fallbackStem}.ics`;
}

/**
 * Renders a full VCALENDAR document: one VEVENT per entry in `events`, in the order given. DTSTAMP is
 * computed once (the moment this function runs) and shared by every VEVENT in the document, matching
 * what a real calendar generator would do for one feed fetch.
 */
export function buildIcsCalendar(events: IcsEvent[], options: BuildIcsCalendarOptions): string {
  const dtstamp = toIcsUtcTimestamp(new Date().toISOString());

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(options.calendarName)}`,
    ...events.flatMap((event) => buildEventLines(event, dtstamp)),
    "END:VCALENDAR",
  ];

  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
