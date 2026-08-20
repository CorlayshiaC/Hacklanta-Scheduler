import { describe, expect, it } from "vitest";
import {
  buildEventGridSpec,
  buildRecurringGridSpec,
  cellKey,
  cellsToWindows,
  eventWindowsToNormalizedWindows,
  generateGridRows,
  minuteToLocalTime,
  normalizedWindowsToEventWindows,
  parseCellKey,
  windowsToCells,
} from "@/lib/availability/grid";

describe("grid cell keys", () => {
  it("round-trips through cellKey/parseCellKey", () => {
    const key = cellKey({ dayId: "2026-10-09", minute: 90 });
    expect(key).toBe("2026-10-09:90");
    expect(parseCellKey(key)).toEqual({ dayId: "2026-10-09", minute: 90 });
  });

  it("formats minutes as HH:MM, rolling over past midnight", () => {
    expect(minuteToLocalTime(90)).toBe("01:30");
    expect(minuteToLocalTime(0)).toBe("00:00");
    expect(minuteToLocalTime(24 * 60)).toBe("00:00");
  });
});

describe("generateGridRows", () => {
  it("generates rows at the given granularity within bounds", () => {
    const rows = generateGridRows({
      days: [{ id: "0", label: "Sun" }],
      granularityMinutes: 30,
      startMinute: 60,
      endMinute: 150,
    });

    expect(rows).toEqual([60, 90, 120]);
  });
});

describe("cellsToWindows / windowsToCells", () => {
  const spec = {
    days: [
      { id: "2026-10-09", label: "Fri" },
      { id: "2026-10-10", label: "Sat" },
    ],
    granularityMinutes: 30 as const,
    startMinute: 0,
    endMinute: 120,
  };

  it("merges adjacent selected cells on the same day into one window", () => {
    const selected = new Set([
      cellKey({ dayId: "2026-10-09", minute: 0 }),
      cellKey({ dayId: "2026-10-09", minute: 30 }),
      cellKey({ dayId: "2026-10-09", minute: 60 }),
    ]);

    expect(cellsToWindows(selected, spec)).toEqual([{ dayId: "2026-10-09", startMinute: 0, endMinute: 90 }]);
  });

  it("keeps non-adjacent runs as separate windows, per day", () => {
    const selected = new Set([
      cellKey({ dayId: "2026-10-09", minute: 0 }),
      cellKey({ dayId: "2026-10-09", minute: 90 }),
      cellKey({ dayId: "2026-10-10", minute: 30 }),
    ]);

    expect(cellsToWindows(selected, spec)).toEqual([
      { dayId: "2026-10-09", startMinute: 0, endMinute: 30 },
      { dayId: "2026-10-09", startMinute: 90, endMinute: 120 },
      { dayId: "2026-10-10", startMinute: 30, endMinute: 60 },
    ]);
  });

  it("round-trips windows back into the same cell selection", () => {
    const windows = [
      { dayId: "2026-10-09", startMinute: 0, endMinute: 90 },
      { dayId: "2026-10-10", startMinute: 30, endMinute: 60 },
    ];

    const cells = windowsToCells(windows, spec);
    expect(cellsToWindows(cells, spec)).toEqual(windows);
  });
});

describe("event window <-> normalized timestamp conversion", () => {
  const timeZone = "America/New_York";

  it("converts a same-day grid window to absolute UTC timestamps", () => {
    const normalized = eventWindowsToNormalizedWindows(
      [{ dayId: "2026-10-10", startMinute: 10 * 60, endMinute: 18 * 60 }],
      timeZone,
    );

    expect(normalized).toEqual([{ startsAt: "2026-10-10T14:00:00.000Z", endsAt: "2026-10-10T22:00:00.000Z" }]);
  });

  it("rolls a window past midnight onto the next calendar day", () => {
    const normalized = eventWindowsToNormalizedWindows(
      [{ dayId: "2026-10-10", startMinute: 23 * 60, endMinute: 25 * 60 }],
      timeZone,
    );

    expect(normalized).toEqual([{ startsAt: "2026-10-11T03:00:00.000Z", endsAt: "2026-10-11T05:00:00.000Z" }]);
  });

  it("reads stored timestamps back into grid-local minute windows", () => {
    const windows = normalizedWindowsToEventWindows(
      [{ startsAt: "2026-10-10T14:00:00.000Z", endsAt: "2026-10-10T22:00:00.000Z" }],
      timeZone,
    );

    expect(windows).toEqual([{ dayId: "2026-10-10", startMinute: 10 * 60, endMinute: 18 * 60 }]);
  });

  it("round-trips overnight windows without losing the day rollover", () => {
    const original = [{ dayId: "2026-10-10", startMinute: 23 * 60, endMinute: 25 * 60 }];
    const normalized = eventWindowsToNormalizedWindows(original, timeZone);
    const roundTripped = normalizedWindowsToEventWindows(normalized, timeZone);

    expect(roundTripped).toEqual(original);
  });
});

describe("buildRecurringGridSpec", () => {
  it("produces 7 day columns, Sunday first, at the requested granularity", () => {
    const spec = buildRecurringGridSpec(60);

    expect(spec.days.map((day) => day.id)).toEqual(["0", "1", "2", "3", "4", "5", "6"]);
    expect(spec.granularityMinutes).toBe(60);
  });
});

describe("buildEventGridSpec", () => {
  it("derives one day column per calendar day the event touches, from its own start/end", () => {
    const spec = buildEventGridSpec({
      eventStartsAt: "2026-10-09T11:00:00.000Z",
      eventEndsAt: "2026-10-11T19:00:00.000Z",
      timeZone: "America/New_York",
      granularityMinutes: 30,
    });

    expect(spec.days.map((day) => day.id)).toEqual(["2026-10-09", "2026-10-10", "2026-10-11"]);
  });
});
