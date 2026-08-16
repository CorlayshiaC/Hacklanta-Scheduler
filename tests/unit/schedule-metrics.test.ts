import { describe, expect, it } from "vitest";
import {
  getHealthStatus,
  getMemberWorkloads,
  getNeedsAttentionItems,
  getOpenPositionCount,
  getScheduleSummary,
  groupShiftsByHackLantaDay,
} from "@/lib/admin/schedule/metrics";
import type { AdminShift } from "@/lib/admin/shifts/data";

const baseShift = {
  event_id: "event-1",
  shift_role_id: null,
  location: null,
  notes: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  required_people: 1,
  shiftRole: null,
  requirements: [],
  assignments: [],
  activeAssignmentCount: 0,
  requiredTotal: 1,
  staffingStatus: "unstaffed",
} satisfies Partial<AdminShift>;

function shift(overrides: Partial<AdminShift>): AdminShift {
  return {
    ...baseShift,
    id: overrides.id ?? "shift-1",
    title: overrides.title ?? "Coverage Shift",
    starts_at: overrides.starts_at ?? "2026-10-10T14:00:00.000Z",
    ends_at: overrides.ends_at ?? "2026-10-10T18:00:00.000Z",
    ...overrides,
  } as AdminShift;
}

function assignment(overrides: Partial<AdminShift["assignments"][number]> = {}) {
  return {
    id: overrides.id ?? "assignment-1",
    shift_id: overrides.shift_id ?? "shift-1",
    profile_id: overrides.profile_id ?? "profile-1",
    coverage_role_id: overrides.coverage_role_id ?? null,
    assigned_by: overrides.assigned_by ?? "admin-1",
    status: overrides.status ?? "draft",
    published_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    profile: overrides.profile ?? {
      id: overrides.profile_id ?? "profile-1",
      full_name: "Test Dummy",
      email: "dummy@example.com",
    },
    coverageRole: overrides.coverageRole ?? {
      id: overrides.coverage_role_id ?? "role-1",
      name: "Operations",
    },
    ...overrides,
  } as AdminShift["assignments"][number];
}

describe("admin schedule metrics", () => {
  it("groups HackLanta II shifts by event day and sorts chronologically", () => {
    const shifts = [
      shift({
        id: "late",
        title: "Late Saturday",
        starts_at: "2026-10-10T22:00:00.000Z",
        ends_at: "2026-10-11T00:00:00.000Z",
      }),
      shift({
        id: "friday",
        title: "Friday Check-in",
        starts_at: "2026-10-09T19:00:00.000Z",
        ends_at: "2026-10-10T01:00:00.000Z",
      }),
      shift({
        id: "early",
        title: "Early Saturday",
        starts_at: "2026-10-10T14:00:00.000Z",
        ends_at: "2026-10-10T16:00:00.000Z",
      }),
    ];

    const groups = groupShiftsByHackLantaDay(shifts, "America/New_York");

    expect(groups.map((group) => group.label)).toEqual([
      "Friday, October 9",
      "Saturday, October 10",
      "Sunday, October 11",
    ]);
    expect(groups[0]?.shifts.map((row) => row.title)).toEqual(["Friday Check-in"]);
    expect(groups[1]?.shifts.map((row) => row.title)).toEqual([
      "Early Saturday",
      "Late Saturday",
    ]);
  });

  it("calculates staffing summary and excludes removed assignments from draft totals", () => {
    const shifts = [
      shift({
        id: "full",
        staffingStatus: "fully_staffed",
        requiredTotal: 2,
        assignments: [
          assignment({ id: "draft-1", shift_id: "full", status: "draft" }),
          assignment({ id: "published-1", shift_id: "full", status: "published" }),
          assignment({ id: "removed-1", shift_id: "full", status: "removed" }),
        ],
      }),
      shift({
        id: "partial",
        staffingStatus: "partially_staffed",
        requiredTotal: 3,
        assignments: [assignment({ id: "draft-2", shift_id: "partial", status: "draft" })],
      }),
      shift({
        id: "empty",
        staffingStatus: "unstaffed",
        requiredTotal: 1,
        assignments: [assignment({ id: "removed-2", shift_id: "empty", status: "removed" })],
      }),
    ];

    expect(getScheduleSummary(shifts)).toEqual({
      totalShifts: 3,
      fullyStaffed: 1,
      partiallyStaffed: 1,
      unstaffed: 1,
      totalRequiredAssignments: 6,
      totalAssignedAssignments: 3,
      totalDraftAssignments: 2,
      totalPublishedAssignments: 1,
      openPositions: 3,
    });
    expect(getOpenPositionCount(shifts[1] as AdminShift)).toBe(2);
  });

  it("summarizes active assignment workload by member and excludes removed assignments", () => {
    const shifts = [
      shift({
        id: "first",
        starts_at: "2026-10-10T14:00:00.000Z",
        ends_at: "2026-10-10T18:00:00.000Z",
        assignments: [
          assignment({
            id: "draft-1",
            shift_id: "first",
            profile_id: "profile-1",
            status: "draft",
          }),
        ],
      }),
      shift({
        id: "second",
        starts_at: "2026-10-10T20:00:00.000Z",
        ends_at: "2026-10-10T22:30:00.000Z",
        assignments: [
          assignment({
            id: "draft-2",
            shift_id: "second",
            profile_id: "profile-1",
            status: "draft",
          }),
          assignment({
            id: "published",
            shift_id: "second",
            profile_id: "profile-1",
            status: "published",
          }),
          assignment({
            id: "removed",
            shift_id: "second",
            profile_id: "profile-2",
            status: "removed",
          }),
        ],
      }),
    ];

    expect(
      getMemberWorkloads(shifts, [
        {
          id: "settings-1",
          event_id: "event-1",
          profile_id: "profile-1",
          max_hours: 12,
          minimum_break_minutes: 30,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ]),
    ).toEqual([
      {
        profileId: "profile-1",
        fullName: "Test Dummy",
        email: "dummy@example.com",
        coverageRoles: ["Operations"],
        assignedHours: 9,
        maxHours: 12,
        minimumBreakMinutes: 30,
        remainingHours: 3,
        shiftCount: 3,
        workloadStatus: "healthy",
      },
    ]);
  });

  it("flags approaching and exceeded workload limits", () => {
    const shifts = [
      shift({
        id: "first",
        starts_at: "2026-10-10T14:00:00.000Z",
        ends_at: "2026-10-10T18:00:00.000Z",
        assignments: [assignment({ shift_id: "first", profile_id: "profile-1" })],
      }),
      shift({
        id: "second",
        starts_at: "2026-10-10T20:00:00.000Z",
        ends_at: "2026-10-10T23:00:00.000Z",
        assignments: [assignment({ shift_id: "second", profile_id: "profile-2" })],
      }),
    ];
    const workloads = getMemberWorkloads(shifts, [
      {
        id: "settings-1",
        event_id: "event-1",
        profile_id: "profile-1",
        max_hours: 5,
        minimum_break_minutes: 30,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "settings-2",
        event_id: "event-1",
        profile_id: "profile-2",
        max_hours: 2,
        minimum_break_minutes: 30,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ]);

    expect(workloads.find((workload) => workload.profileId === "profile-1")?.workloadStatus).toBe(
      "approaching",
    );
    expect(workloads.find((workload) => workload.profileId === "profile-2")?.workloadStatus).toBe(
      "exceeds",
    );
  });

  it("builds needs-attention items for general and role-specific staffing gaps", () => {
    const items = getNeedsAttentionItems([
      shift({
        id: "check-in",
        title: "Check-in",
        required_people: 2,
        requiredTotal: 3,
        assignments: [assignment({ shift_id: "check-in" })],
        requirements: [
          {
            id: "requirement-1",
            shift_id: "check-in",
            coverage_role_id: "role-1",
            required_people: 2,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
            coverageRole: { id: "role-1", event_id: "event-1", name: "Operations", description: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" },
          },
        ],
      }),
    ]);

    expect(items).toEqual([
      expect.objectContaining({
        coverageRoleName: null,
        currentStaffing: 1,
        openPositions: 1,
        requiredStaffing: 2,
        type: "general_gap",
      }),
      expect.objectContaining({
        coverageRoleName: "Operations",
        currentStaffing: 0,
        openPositions: 2,
        requiredStaffing: 2,
        type: "role_gap",
      }),
    ]);
  });

  it("classifies schedule health by blockers and staffing gaps", () => {
    expect(getHealthStatus({ blockerCount: 1, openPositions: 0, partiallyStaffed: 0, unstaffed: 0 })).toBe("blocking");
    expect(getHealthStatus({ blockerCount: 0, openPositions: 1, partiallyStaffed: 0, unstaffed: 0 })).toBe("warning");
    expect(getHealthStatus({ blockerCount: 0, openPositions: 0, partiallyStaffed: 0, unstaffed: 0 })).toBe("healthy");
  });
});
