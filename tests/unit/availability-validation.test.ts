import { describe, expect, it } from "vitest";
import { localDateTimeToUtcIso } from "@/lib/availability/time";
import {
  availabilityFormInputSchema,
  findOverlappingWindow,
  parseAvailabilityFormInput,
  validateWindowInsideEvent,
} from "@/lib/availability/validation";

const hacklantaEvent = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "HackLanta II",
  starts_at: "2026-10-09T11:00:00.000Z",
  ends_at: "2026-10-11T19:00:00.000Z",
  timezone: "America/New_York",
};

describe("availability validation", () => {
  it("converts HackLanta local date/time input to UTC timestamps", () => {
    expect(localDateTimeToUtcIso("2026-10-09", "07:00")).toBe("2026-10-09T11:00:00.000Z");
    expect(localDateTimeToUtcIso("2026-10-11", "15:00")).toBe("2026-10-11T19:00:00.000Z");
  });

  it("accepts a valid availability window inside the event", () => {
    const parsed = parseAvailabilityFormInput({
      date: "2026-10-10",
      startsAt: "10:00",
      endsAt: "18:00",
      note: "Can help with setup.",
    });

    expect(parsed.ok).toBe(true);

    if (parsed.ok) {
      expect(
        validateWindowInsideEvent({
          startsAt: parsed.value.startsAt,
          endsAt: parsed.value.endsAt,
          event: hacklantaEvent,
        }),
      ).toEqual({ ok: true });
    }
  });

  it("rejects start times that are not before end times", () => {
    expect(
      parseAvailabilityFormInput({
        date: "2026-10-10",
        startsAt: "18:00",
        endsAt: "10:00",
      }),
    ).toEqual({ ok: false, message: "Start time must be before end time." });
  });

  it("rejects windows outside the event's operational boundary", () => {
    expect(
      validateWindowInsideEvent({
        startsAt: "2026-10-09T10:59:00.000Z",
        endsAt: "2026-10-09T12:00:00.000Z",
        event: hacklantaEvent,
      }),
    ).toEqual({
      ok: false,
      message: "Availability must stay within HackLanta II's operational window.",
    });
  });

  it("accepts a window submitted for any event, not just one hardcoded name", () => {
    expect(
      validateWindowInsideEvent({
        startsAt: "2026-10-10T14:00:00.000Z",
        endsAt: "2026-10-10T18:00:00.000Z",
        event: { ...hacklantaEvent, name: "Weekly Office Hours" },
      }),
    ).toEqual({ ok: true });
  });

  it("bounds optional notes", () => {
    expect(
      availabilityFormInputSchema.safeParse({
        date: "2026-10-10",
        startsAt: "10:00",
        endsAt: "18:00",
        note: "x".repeat(161),
      }).success,
    ).toBe(false);
  });

  it("detects overlapping windows but allows adjacent windows", () => {
    const existingWindows = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        starts_at: "2026-10-10T14:00:00.000Z",
        ends_at: "2026-10-10T18:00:00.000Z",
      },
    ];

    expect(
      findOverlappingWindow({
        startsAt: "2026-10-10T17:00:00.000Z",
        endsAt: "2026-10-10T19:00:00.000Z",
        existingWindows,
      })?.id,
    ).toBe("11111111-1111-4111-8111-111111111111");
    expect(
      findOverlappingWindow({
        startsAt: "2026-10-10T18:00:00.000Z",
        endsAt: "2026-10-10T19:00:00.000Z",
        existingWindows,
      }),
    ).toBeUndefined();
  });
});
