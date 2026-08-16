import { describe, expect, it } from "vitest";
import { buildShiftCells, summarizeCoverage } from "@/lib/scheduling/coverage";

const now = new Date("2026-10-09T00:00:00.000Z");
const opsRoleId = "11111111-1111-4111-8111-111111111111";

const shift = {
  id: "shift-1",
  eventId: "event-1",
  title: "Operations block",
  startsAt: "2026-10-10T12:00:00.000Z",
  endsAt: "2026-10-10T14:00:00.000Z",
  location: "Main hall",
  requiredPeople: 2,
  station: null,
};

describe("buildShiftCells", () => {
  it("builds one general cell when a shift has no role requirements", () => {
    const cells = buildShiftCells({
      shifts: [shift],
      requirements: [],
      assignments: [
        { id: "a1", shiftId: "shift-1", profileId: "p1", fullName: "Alex", coverageRoleId: null, active: true },
      ],
      now,
    });

    expect(cells).toHaveLength(1);
    expect(cells[0]).toMatchObject({
      station: null,
      headcountRequired: 2,
      headcountAssigned: 1,
      status: "partial",
    });
  });

  it("splits a shift into one cell per station requirement and counts only matching assignments", () => {
    const cells = buildShiftCells({
      shifts: [shift],
      requirements: [
        { shiftId: "shift-1", coverageRoleId: opsRoleId, coverageRoleName: "Operations", requiredPeople: 2 },
      ],
      assignments: [
        { id: "a1", shiftId: "shift-1", profileId: "p1", fullName: "Alex", coverageRoleId: opsRoleId, active: true },
        { id: "a2", shiftId: "shift-1", profileId: "p2", fullName: "Sam", coverageRoleId: opsRoleId, active: true },
        { id: "a3", shiftId: "shift-1", profileId: "p3", fullName: "Jo", coverageRoleId: "other-role", active: true },
      ],
      now,
    });

    expect(cells).toHaveLength(1);
    expect(cells[0]?.status).toBe("full");
    expect(cells[0]?.assignees).toHaveLength(2);
  });

  it("uses the shift's own station tag when it has no fan-out requirements (bulk-generated shifts)", () => {
    const tagged = { ...shift, station: { id: opsRoleId, name: "Operations" } };
    const cells = buildShiftCells({ shifts: [tagged], requirements: [], assignments: [], now });

    expect(cells).toHaveLength(1);
    expect(cells[0]?.station).toEqual({ id: opsRoleId, name: "Operations" });
  });

  it("ignores inactive (dropped) assignments when computing coverage", () => {
    const cells = buildShiftCells({
      shifts: [shift],
      requirements: [],
      assignments: [
        { id: "a1", shiftId: "shift-1", profileId: "p1", fullName: "Alex", coverageRoleId: null, active: false },
      ],
      now,
    });

    expect(cells[0]).toMatchObject({ status: "empty", headcountAssigned: 0 });
  });

  it("flags understaffed shifts starting within 24h as urgent, but not fully staffed ones", () => {
    const soon = { ...shift, id: "shift-soon", startsAt: "2026-10-09T12:00:00.000Z", endsAt: "2026-10-09T14:00:00.000Z" };
    const cells = buildShiftCells({
      shifts: [soon],
      requirements: [],
      assignments: [],
      now,
    });

    expect(cells[0]?.understaffedUrgent).toBe(true);
  });

  it("does not flag shifts more than 24h out", () => {
    const far = { ...shift, id: "shift-far", startsAt: "2026-10-15T12:00:00.000Z", endsAt: "2026-10-15T14:00:00.000Z" };
    const cells = buildShiftCells({
      shifts: [far],
      requirements: [],
      assignments: [],
      now,
    });

    expect(cells[0]?.understaffedUrgent).toBe(false);
  });
});

describe("summarizeCoverage", () => {
  it("caps filled at required per cell so overstaffed cells do not inflate the total", () => {
    const summary = summarizeCoverage([
      {
        shiftId: "s1",
        eventId: "e1",
        title: "A",
        station: null,
        startsAt: "2026-10-10T12:00:00.000Z",
        endsAt: "2026-10-10T14:00:00.000Z",
        location: null,
        headcountRequired: 2,
        headcountAssigned: 3,
        status: "full",
        assignees: [],
        understaffedUrgent: false,
      },
    ]);

    expect(summary).toEqual({ filled: 2, required: 2 });
  });
});
