import { describe, expect, it } from "vitest";
import { generateShiftGrid } from "@/lib/scheduling/bulk-generation";

const opsRoleId = "11111111-1111-4111-8111-111111111111";
const checkinRoleId = "22222222-2222-4222-8222-222222222222";

describe("generateShiftGrid", () => {
  it("generates one shift per station per block across the full window", () => {
    const result = generateShiftGrid({
      windowStart: "2026-10-09T12:00:00.000Z",
      windowEnd: "2026-10-09T16:00:00.000Z",
      blockLengthMinutes: 120,
      stations: [
        { stationId: opsRoleId, name: "Operations", headcount: 2 },
        { stationId: checkinRoleId, name: "Check-in", headcount: 1 },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value).toHaveLength(4);
    expect(result.value.filter((draft) => draft.stationId === opsRoleId)).toEqual([
      {
        title: "Operations",
        stationId: opsRoleId,
        startsAt: "2026-10-09T12:00:00.000Z",
        endsAt: "2026-10-09T14:00:00.000Z",
        requiredPeople: 2,
      },
      {
        title: "Operations",
        stationId: opsRoleId,
        startsAt: "2026-10-09T14:00:00.000Z",
        endsAt: "2026-10-09T16:00:00.000Z",
        requiredPeople: 2,
      },
    ]);
  });

  it("truncates the final block at the window end instead of overshooting", () => {
    const result = generateShiftGrid({
      windowStart: "2026-10-09T12:00:00.000Z",
      windowEnd: "2026-10-09T15:00:00.000Z",
      blockLengthMinutes: 120,
      stations: [{ stationId: opsRoleId, name: "Operations", headcount: 1 }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.map((draft) => [draft.startsAt, draft.endsAt])).toEqual([
      ["2026-10-09T12:00:00.000Z", "2026-10-09T14:00:00.000Z"],
      ["2026-10-09T14:00:00.000Z", "2026-10-09T15:00:00.000Z"],
    ]);
  });

  it("rejects a window where start is not before end", () => {
    const result = generateShiftGrid({
      windowStart: "2026-10-09T15:00:00.000Z",
      windowEnd: "2026-10-09T12:00:00.000Z",
      blockLengthMinutes: 60,
      stations: [{ stationId: opsRoleId, name: "Operations", headcount: 1 }],
    });

    expect(result).toEqual({ ok: false, message: "Window start must be before window end." });
  });

  it("rejects an empty station list", () => {
    const result = generateShiftGrid({
      windowStart: "2026-10-09T12:00:00.000Z",
      windowEnd: "2026-10-09T15:00:00.000Z",
      blockLengthMinutes: 60,
      stations: [],
    });

    expect(result).toEqual({ ok: false, message: "Add at least one station." });
  });
});
