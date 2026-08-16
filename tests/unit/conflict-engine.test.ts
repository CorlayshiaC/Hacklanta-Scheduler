import { describe, expect, it } from "vitest";
import { checkAssignmentConflicts, windowsOverlap } from "@/lib/scheduling/conflict-engine";

const shift = {
  id: "shift-1",
  startsAt: "2026-10-10T14:00:00.000Z",
  endsAt: "2026-10-10T18:00:00.000Z",
};

function baseInput(overrides: Partial<Parameters<typeof checkAssignmentConflicts>[0]> = {}) {
  return {
    shift,
    existingAssignments: [],
    capacity: { assigned: 0, required: 2 },
    availabilityWindows: [],
    maxHoursPerWeek: null,
    assignedHoursThisWeek: 0,
    minimumBreakMinutes: null,
    ...overrides,
  };
}

describe("windowsOverlap", () => {
  it("treats adjacent windows as non-overlapping and true intersections as overlapping", () => {
    expect(windowsOverlap(shift, { startsAt: "2026-10-10T18:00:00.000Z", endsAt: "2026-10-10T20:00:00.000Z" })).toBe(
      false,
    );
    expect(windowsOverlap(shift, { startsAt: "2026-10-10T17:59:00.000Z", endsAt: "2026-10-10T20:00:00.000Z" })).toBe(
      true,
    );
  });
});

describe("checkAssignmentConflicts", () => {
  it("returns ok with no existing assignments, availability, or hour limits", () => {
    expect(checkAssignmentConflicts(baseInput())).toEqual({ status: "ok" });
  });

  it("blocks on an overlapping existing assignment before checking capacity", () => {
    const result = checkAssignmentConflicts(
      baseInput({
        existingAssignments: [{ id: "other", startsAt: "2026-10-10T15:00:00.000Z", endsAt: "2026-10-10T17:00:00.000Z" }],
        capacity: { assigned: 5, required: 2 },
      }),
    );
    expect(result).toEqual({ status: "blocked", reason: "Already assigned to an overlapping shift." });
  });

  it("blocks when the shift is at capacity", () => {
    const result = checkAssignmentConflicts(baseInput({ capacity: { assigned: 2, required: 2 } }));
    expect(result).toEqual({ status: "blocked", reason: "This shift is already at capacity." });
  });

  it("warns when outside submitted availability", () => {
    const result = checkAssignmentConflicts(
      baseInput({
        availabilityWindows: [{ startsAt: "2026-10-10T14:00:00.000Z", endsAt: "2026-10-10T16:00:00.000Z" }],
      }),
    );
    expect(result).toEqual({ status: "warning", reasons: ["Outside submitted availability."] });
  });

  it("does not warn about availability when no windows were submitted at all", () => {
    expect(checkAssignmentConflicts(baseInput({ availabilityWindows: [] }))).toEqual({ status: "ok" });
  });

  it("warns when the assignment would exceed the weekly hour limit", () => {
    const result = checkAssignmentConflicts(
      baseInput({ maxHoursPerWeek: 5, assignedHoursThisWeek: 3 }),
    );
    expect(result).toEqual({ status: "warning", reasons: ["Would exceed the 5h weekly limit."] });
  });

  it("warns on a zero-gap back-to-back shift", () => {
    const result = checkAssignmentConflicts(
      baseInput({
        existingAssignments: [{ id: "prev", startsAt: "2026-10-10T10:00:00.000Z", endsAt: "2026-10-10T14:00:00.000Z" }],
      }),
    );
    expect(result).toEqual({ status: "warning", reasons: ["Back-to-back with another shift, no gap."] });
  });

  it("warns when the gap is shorter than the configured minimum break", () => {
    const result = checkAssignmentConflicts(
      baseInput({
        existingAssignments: [{ id: "prev", startsAt: "2026-10-10T10:00:00.000Z", endsAt: "2026-10-10T13:45:00.000Z" }],
        minimumBreakMinutes: 30,
      }),
    );
    expect(result).toEqual({
      status: "warning",
      reasons: ["Only 15m between shifts, minimum break is 30m."],
    });
  });

  it("does not warn about the break when the gap meets the minimum", () => {
    const result = checkAssignmentConflicts(
      baseInput({
        existingAssignments: [{ id: "prev", startsAt: "2026-10-10T10:00:00.000Z", endsAt: "2026-10-10T13:30:00.000Z" }],
        minimumBreakMinutes: 30,
      }),
    );
    expect(result).toEqual({ status: "ok" });
  });

  it("collects multiple simultaneous warnings", () => {
    const result = checkAssignmentConflicts(
      baseInput({
        availabilityWindows: [{ startsAt: "2026-10-10T00:00:00.000Z", endsAt: "2026-10-10T01:00:00.000Z" }],
        maxHoursPerWeek: 2,
        assignedHoursThisWeek: 2,
      }),
    );
    expect(result.status).toBe("warning");
    if (result.status === "warning") {
      expect(result.reasons).toEqual([
        "Outside submitted availability.",
        "Would exceed the 2h weekly limit.",
      ]);
    }
  });
});
