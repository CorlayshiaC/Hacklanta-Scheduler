import { describe, expect, it } from "vitest";
import { rankAutofillCandidates } from "@/lib/ai/kinds/autofill";
import type { ConflictCheckInput } from "@/lib/scheduling/conflict-engine";

const shift = { id: "shift-1", startsAt: "2026-10-10T14:00:00.000Z", endsAt: "2026-10-10T18:00:00.000Z" };

function baseInput(overrides: Partial<ConflictCheckInput> = {}): ConflictCheckInput {
  return {
    shift,
    existingAssignments: [],
    capacity: { assigned: 0, required: 3 },
    availabilityWindows: [],
    maxHoursPerWeek: null,
    assignedHoursThisWeek: 0,
    minimumBreakMinutes: null,
    ...overrides,
  };
}

describe("rankAutofillCandidates", () => {
  it("drops blocked candidates entirely", () => {
    const ranked = rankAutofillCandidates([
      {
        profileId: "blocked",
        input: baseInput({ existingAssignments: [shift] }), // overlaps itself: blocked
      },
      { profileId: "ok", input: baseInput() },
    ]);

    expect(ranked.map((c) => c.profileId)).toEqual(["ok"]);
  });

  it("ranks ok candidates before warning candidates regardless of input order", () => {
    const ranked = rankAutofillCandidates([
      { profileId: "warning-1", input: baseInput({ availabilityWindows: [{ startsAt: shift.startsAt, endsAt: shift.startsAt }] }) },
      { profileId: "ok-1", input: baseInput() },
    ]);

    expect(ranked.map((c) => c.profileId)).toEqual(["ok-1", "warning-1"]);
    expect(ranked[0].conflict.status).toBe("ok");
    expect(ranked[1].conflict.status).toBe("warning");
  });

  it("breaks ties within the same status by fewest hours assigned this week", () => {
    const ranked = rankAutofillCandidates([
      { profileId: "busy", input: baseInput({ assignedHoursThisWeek: 8 }) },
      { profileId: "free", input: baseInput({ assignedHoursThisWeek: 1 }) },
    ]);

    expect(ranked.map((c) => c.profileId)).toEqual(["free", "busy"]);
  });

  it("assigns sequential anonymized ids in final rank order, never a real id", () => {
    const ranked = rankAutofillCandidates([
      { profileId: "real-profile-id-b", input: baseInput({ assignedHoursThisWeek: 5 }) },
      { profileId: "real-profile-id-a", input: baseInput({ assignedHoursThisWeek: 0 }) },
    ]);

    expect(ranked.map((c) => c.anonId)).toEqual(["candidate_1", "candidate_2"]);
    expect(ranked[0].profileId).toBe("real-profile-id-a");
  });
});
