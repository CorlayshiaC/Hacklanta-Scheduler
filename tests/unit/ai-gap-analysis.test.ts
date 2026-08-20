import { describe, expect, it } from "vitest";
import { buildGapDescriptorFromCell, templateHeadline } from "@/lib/ai/kinds/gap-analysis";
import type { ShiftCell } from "@/lib/scheduling/types";

function cell(overrides: Partial<ShiftCell> = {}): ShiftCell {
  return {
    shiftId: "shift-1",
    eventId: "event-1",
    title: "Teardown",
    station: { id: "station-1", name: "Setup crew" },
    startsAt: "2026-10-10T18:00:00.000Z",
    endsAt: "2026-10-10T20:00:00.000Z",
    location: null,
    headcountRequired: 5,
    headcountAssigned: 2,
    status: "partial",
    assignees: [],
    understaffedUrgent: false,
    notes: null,
    ...overrides,
  };
}

describe("buildGapDescriptorFromCell", () => {
  it("returns null for a fully staffed cell", () => {
    expect(buildGapDescriptorFromCell(cell({ status: "full", headcountAssigned: 5 }), 3)).toBeNull();
  });

  it("computes shortBy from required minus assigned and includes the station in the label", () => {
    const gap = buildGapDescriptorFromCell(cell(), 5);
    expect(gap).toEqual({ label: "Teardown (Setup crew)", shortBy: 3, availableUnassigned: 5 });
  });

  it("omits the station suffix when the cell has no station", () => {
    const gap = buildGapDescriptorFromCell(cell({ station: null }), 0);
    expect(gap?.label).toBe("Teardown");
  });
});

describe("templateHeadline", () => {
  it("matches the exact example sentence from the shared brief", () => {
    expect(templateHeadline({ label: "Saturday 2pm teardown", shortBy: 3, availableUnassigned: 5 })).toBe(
      "Saturday 2pm teardown is 3 short. 5 available members are unassigned.",
    );
  });

  it("uses the singular \"member\" for exactly one available person", () => {
    expect(templateHeadline({ label: "Setup", shortBy: 1, availableUnassigned: 1 })).toBe(
      "Setup is 1 short. 1 available member is unassigned.",
    );
  });
});
