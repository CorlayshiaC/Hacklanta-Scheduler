import { describe, expect, it } from "vitest";
import { buildIcsCalendar, escapeIcsText, foldIcsLine, toIcsUtcTimestamp } from "@/lib/ics/build-ics";
import type { IcsEvent } from "@/lib/ics/build-ics";

const baseEvent: IcsEvent = {
  uid: "11111111-1111-1111-1111-111111111111@prog-scheduler",
  summary: "Check-in desk",
  startsAt: "2026-08-16T07:00:00.000Z",
  endsAt: "2026-08-16T10:00:00.000Z",
};

function unfold(ics: string): string[] {
  // Inverse of the RFC 5545 folding algorithm: a physical line that starts with a single space is a
  // continuation of the previous logical line, so it gets rejoined with the leading space stripped.
  const physicalLines = ics.split("\r\n").filter((line) => line.length > 0);
  const logicalLines: string[] = [];

  for (const line of physicalLines) {
    if (line.startsWith(" ") && logicalLines.length > 0) {
      logicalLines[logicalLines.length - 1] += line.slice(1);
    } else {
      logicalLines.push(line);
    }
  }

  return logicalLines;
}

describe("foldIcsLine", () => {
  it("leaves a short line untouched", () => {
    expect(foldIcsLine("SUMMARY:Check-in desk")).toBe("SUMMARY:Check-in desk");
  });

  it("folds a line over 75 octets so no physical line exceeds the limit", () => {
    const longLine = `DESCRIPTION:${"a".repeat(200)}`;
    const folded = foldIcsLine(longLine);
    const physicalLines = folded.split("\r\n");

    expect(physicalLines.length).toBeGreaterThan(1);
    for (const line of physicalLines) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it("indents every continuation line with exactly one leading space", () => {
    const folded = foldIcsLine(`DESCRIPTION:${"a".repeat(200)}`);
    const physicalLines = folded.split("\r\n");

    for (const line of physicalLines.slice(1)) {
      expect(line.startsWith(" ")).toBe(true);
      expect(line.startsWith("  ")).toBe(false);
    }
  });

  it("round-trips through unfolding back to the original content", () => {
    const original = `DESCRIPTION:${"the quick brown fox jumps over the lazy dog ".repeat(5)}`;
    const folded = foldIcsLine(original);
    const rejoined = folded
      .split("\r\n")
      .map((line, index) => (index === 0 ? line : line.slice(1)))
      .join("");

    expect(rejoined).toBe(original);
  });

  it("never splits a multi-byte UTF-8 character across a fold boundary", () => {
    // Each of these emoji is a 4-octet UTF-8 character. Placed so a naive byte-count split would land
    // mid-character; the fold must instead break before it.
    const longLine = `SUMMARY:${"a".repeat(70)}🎉${"b".repeat(20)}`;
    const folded = foldIcsLine(longLine);

    for (const line of folded.split("\r\n")) {
      const bytes = new TextEncoder().encode(line);
      // Decoding must not throw/replace, which it would if a 4-byte sequence got truncated.
      expect(new TextDecoder("utf-8", { fatal: true }).decode(bytes)).not.toContain("\uFFFD");
    }
    expect(folded.replace(/\r\n /g, "")).toBe(longLine);
  });
});

describe("escapeIcsText", () => {
  it("escapes a backslash", () => {
    expect(escapeIcsText("C:\\path")).toBe("C:\\\\path");
  });

  it("escapes a semicolon", () => {
    expect(escapeIcsText("Room A; Building B")).toBe("Room A\\; Building B");
  });

  it("escapes a comma", () => {
    expect(escapeIcsText("Atlanta, GA")).toBe("Atlanta\\, GA");
  });

  it("escapes a newline as the two-character literal \\n", () => {
    expect(escapeIcsText("Line one\nLine two")).toBe("Line one\\nLine two");
  });

  it("escapes a CRLF newline as a single \\n, not two", () => {
    expect(escapeIcsText("Line one\r\nLine two")).toBe("Line one\\nLine two");
  });

  it("escapes backslashes before other characters so escaping isn't doubled", () => {
    expect(escapeIcsText("back\\,slash")).toBe("back\\\\\\,slash");
  });
});

describe("toIcsUtcTimestamp", () => {
  it("formats a UTC ISO string as a trailing-Z DATE-TIME", () => {
    expect(toIcsUtcTimestamp("2026-08-16T07:00:00.000Z")).toBe("20260816T070000Z");
  });

  it("converts a non-UTC offset to its correct UTC instant", () => {
    // 2026-08-16T03:00:00-04:00 is 2026-08-16T07:00:00Z.
    expect(toIcsUtcTimestamp("2026-08-16T03:00:00-04:00")).toBe("20260816T070000Z");
  });

  it("truncates fractional seconds rather than rounding them away silently", () => {
    expect(toIcsUtcTimestamp("2026-08-16T07:00:00.999Z")).toBe("20260816T070000Z");
  });

  it("throws on an unparseable date", () => {
    expect(() => toIcsUtcTimestamp("not-a-date")).toThrow();
  });
});

describe("buildIcsCalendar", () => {
  it("includes the required calendar-level properties", () => {
    const ics = buildIcsCalendar([baseEvent], { calendarName: "My schedule" });

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//progsu//prog-scheduler//EN");
    expect(ics).toContain("CALSCALE:GREGORIAN");
    expect(ics).toContain("METHOD:PUBLISH");
    expect(ics).toContain("X-WR-CALNAME:My schedule");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("uses CRLF line endings throughout", () => {
    const ics = buildIcsCalendar([baseEvent], { calendarName: "My schedule" });

    expect(ics).toContain("\r\n");
    expect(ics.includes("\n") && !ics.match(/[^\r]\n/)).toBe(true);
  });

  it("renders one VEVENT per input event, in order", () => {
    const second: IcsEvent = { ...baseEvent, uid: "second@prog-scheduler", summary: "Registration" };
    const ics = buildIcsCalendar([baseEvent, second], { calendarName: "My schedule" });
    const logicalLines = unfold(ics);

    const summaryIndexes = logicalLines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => line.startsWith("SUMMARY:"))
      .map(({ index }) => index);

    expect(logicalLines.filter((line) => line === "BEGIN:VEVENT")).toHaveLength(2);
    expect(logicalLines[summaryIndexes[0]]).toBe("SUMMARY:Check-in desk");
    expect(logicalLines[summaryIndexes[1]]).toBe("SUMMARY:Registration");
  });

  it("produces an event-free but otherwise valid calendar for an empty input", () => {
    const ics = buildIcsCalendar([], { calendarName: "My schedule" });

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("round-trips DTSTART/DTEND back to the same UTC instant that was passed in", () => {
    const ics = buildIcsCalendar([baseEvent], { calendarName: "My schedule" });
    const logicalLines = unfold(ics);

    const dtstart = logicalLines.find((line) => line.startsWith("DTSTART:"));
    const dtend = logicalLines.find((line) => line.startsWith("DTEND:"));

    expect(dtstart).toBe(`DTSTART:${toIcsUtcTimestamp(baseEvent.startsAt)}`);
    expect(dtend).toBe(`DTEND:${toIcsUtcTimestamp(baseEvent.endsAt)}`);

    // And that formatted value, read back through Date, is the exact same instant.
    const dtstartValue = dtstart!.slice("DTSTART:".length);
    const parsedBack = new Date(
      `${dtstartValue.slice(0, 4)}-${dtstartValue.slice(4, 6)}-${dtstartValue.slice(6, 8)}T${dtstartValue.slice(9, 11)}:${dtstartValue.slice(11, 13)}:${dtstartValue.slice(13, 15)}Z`,
    );
    expect(parsedBack.toISOString()).toBe(baseEvent.startsAt);
  });

  it("includes DTSTAMP, and DTSTAMP is shared across every VEVENT in one build", () => {
    const second: IcsEvent = { ...baseEvent, uid: "second@prog-scheduler" };
    const ics = buildIcsCalendar([baseEvent, second], { calendarName: "My schedule" });
    const logicalLines = unfold(ics);
    const dtstamps = logicalLines.filter((line) => line.startsWith("DTSTAMP:"));

    expect(dtstamps).toHaveLength(2);
    expect(dtstamps[0]).toBe(dtstamps[1]);
  });

  it("escapes commas in the summary so the field boundary can't be confused", () => {
    const ics = buildIcsCalendar([{ ...baseEvent, summary: "Check-in, Main" }], {
      calendarName: "My schedule",
    });

    expect(unfold(ics)).toContain("SUMMARY:Check-in\\, Main");
  });

  it("omits LOCATION and DESCRIPTION when not provided", () => {
    const ics = buildIcsCalendar([baseEvent], { calendarName: "My schedule" });

    expect(ics).not.toContain("LOCATION:");
    expect(ics).not.toContain("DESCRIPTION:");
  });

  it("includes LOCATION and DESCRIPTION, escaped, when provided", () => {
    const ics = buildIcsCalendar(
      [{ ...baseEvent, location: "Room A; Annex", description: "Bring a laptop.\nArrive early." }],
      { calendarName: "My schedule" },
    );
    const logicalLines = unfold(ics);

    expect(logicalLines).toContain("LOCATION:Room A\\; Annex");
    expect(logicalLines).toContain("DESCRIPTION:Bring a laptop.\\nArrive early.");
  });

  it("keeps the given UID stable, so regenerating the same event does not change it", () => {
    const ics = buildIcsCalendar([baseEvent], { calendarName: "My schedule" });

    expect(unfold(ics)).toContain(`UID:${baseEvent.uid}`);
  });
});
