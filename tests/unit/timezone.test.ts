import { describe, expect, it } from "vitest";
import { zonedTimeToUtcIso } from "@/lib/scheduling/timezone";

describe("zonedTimeToUtcIso", () => {
  it("converts a wall-clock value in a UTC-behind zone to the correct UTC instant", () => {
    // 9:00 AM Eastern Standard Time (UTC-5, January, outside DST) is 14:00 UTC.
    expect(zonedTimeToUtcIso("2026-01-15T09:00", "America/New_York")).toBe("2026-01-15T14:00:00.000Z");
  });

  it("accounts for daylight saving time", () => {
    // 9:00 AM Eastern Daylight Time (UTC-4, July) is 13:00 UTC.
    expect(zonedTimeToUtcIso("2026-07-15T09:00", "America/New_York")).toBe("2026-07-15T13:00:00.000Z");
  });

  it("converts a wall-clock value in a UTC-ahead zone to the correct UTC instant", () => {
    // 9:00 AM Central European Summer Time (UTC+2, July) is 07:00 UTC.
    expect(zonedTimeToUtcIso("2026-07-15T09:00", "Europe/Paris")).toBe("2026-07-15T07:00:00.000Z");
  });

  it("round-trips through midnight for a zone crossing the date line relative to UTC", () => {
    // 11:30 PM in America/New_York (UTC-4, July) rolls over to the next UTC day.
    expect(zonedTimeToUtcIso("2026-07-15T23:30", "America/New_York")).toBe("2026-07-16T03:30:00.000Z");
  });

  it("is a no-op for the UTC zone itself", () => {
    expect(zonedTimeToUtcIso("2026-01-15T09:00", "UTC")).toBe("2026-01-15T09:00:00.000Z");
  });
});
