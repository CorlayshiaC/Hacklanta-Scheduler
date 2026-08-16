import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMemberSchedulePageData,
  getMemberScheduleSummary,
  groupMemberAssignmentsByDay,
  type MemberScheduleAssignment,
} from "@/lib/member/schedule";

const eventId = "22222222-2222-4222-8222-222222222222";
const profileId = "11111111-1111-4111-8111-111111111111";
const otherProfileId = "99999999-9999-4999-8999-999999999999";
const shiftId = "44444444-4444-4444-8444-444444444444";
const secondShiftId = "55555555-5555-4555-8555-555555555555";
const coverageRoleId = "33333333-3333-4333-8333-333333333333";

const mocks = vi.hoisted(() => {
  const requireAuthenticatedUser = vi.fn();
  const assignmentIn = vi.fn();
  const assignmentEq = vi.fn(() => ({ in: assignmentIn }));
  const serverFrom = vi.fn((table: string) => {
    if (table === "shift_assignments") {
      return {
        select: vi.fn(() => ({
          eq: assignmentEq,
        })),
      };
    }

    return {};
  });
  const adminEventMaybeSingle = vi.fn();
  const adminPublicationLimit = vi.fn();
  const adminShiftIn = vi.fn();
  const adminRoleIn = vi.fn();
  const adminFrom = vi.fn((table: string) => {
    if (table === "events") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: adminEventMaybeSingle,
          })),
        })),
      };
    }

    if (table === "schedule_publications") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: adminPublicationLimit,
            })),
          })),
        })),
      };
    }

    if (table === "shifts") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: adminShiftIn,
          })),
        })),
      };
    }

    if (table === "coverage_roles") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: adminRoleIn,
          })),
        })),
      };
    }

    return {};
  });

  return {
    adminEventMaybeSingle,
    adminFrom,
    adminPublicationLimit,
    adminRoleIn,
    adminShiftIn,
    assignmentEq,
    assignmentIn,
    requireAuthenticatedUser,
    serverFrom,
  };
});

vi.mock("@/lib/auth/authorization", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: mocks.serverFrom,
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: mocks.adminFrom,
  })),
}));

function assignment(overrides: Partial<MemberScheduleAssignment> = {}): MemberScheduleAssignment {
  return {
    id: overrides.id ?? "assignment-1",
    shift_id: overrides.shift_id ?? shiftId,
    profile_id: overrides.profile_id ?? profileId,
    coverage_role_id: overrides.coverage_role_id ?? coverageRoleId,
    assigned_by: overrides.assigned_by ?? "admin-1",
    status: overrides.status ?? "draft",
    published_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    coverageRole: overrides.coverageRole ?? { id: coverageRoleId, name: "Operations" },
    shift: overrides.shift ?? {
      id: overrides.shift_id ?? shiftId,
      event_id: eventId,
      title: "Check-in",
      starts_at: "2026-10-09T19:00:00.000Z",
      ends_at: "2026-10-09T21:00:00.000Z",
      location: "Main Entrance",
      notes: "Assist with attendee check-in.",
    },
    ...overrides,
  };
}

describe("member schedule data", () => {
  beforeEach(() => {
    mocks.adminEventMaybeSingle.mockReset();
    mocks.adminFrom.mockClear();
    mocks.adminPublicationLimit.mockReset();
    mocks.adminRoleIn.mockReset();
    mocks.adminShiftIn.mockReset();
    mocks.assignmentEq.mockClear();
    mocks.assignmentIn.mockReset();
    mocks.requireAuthenticatedUser.mockReset();
    mocks.serverFrom.mockClear();

    mocks.requireAuthenticatedUser.mockResolvedValue({
      user: { id: profileId },
      profile: { id: profileId, role: "board_member", is_active: true },
    });
    mocks.adminEventMaybeSingle.mockResolvedValue({
      data: {
        id: eventId,
        name: "HackLanta II",
        starts_at: "2026-10-09T11:00:00.000Z",
        ends_at: "2026-10-11T19:00:00.000Z",
        timezone: "America/New_York",
        status: "draft",
      },
      error: null,
    });
    mocks.adminPublicationLimit.mockResolvedValue({
      data: [],
      error: null,
    });
    mocks.assignmentIn.mockResolvedValue({
      data: [
        {
          id: "draft-assignment",
          shift_id: shiftId,
          profile_id: profileId,
          coverage_role_id: coverageRoleId,
          assigned_by: "admin-1",
          status: "draft",
          published_at: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "published-assignment",
          shift_id: secondShiftId,
          profile_id: profileId,
          coverage_role_id: null,
          assigned_by: "admin-1",
          status: "published",
          published_at: "2026-02-01T00:00:00.000Z",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "removed-assignment",
          shift_id: "removed-shift",
          profile_id: profileId,
          coverage_role_id: null,
          assigned_by: "admin-1",
          status: "removed",
          published_at: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      error: null,
    });
    mocks.adminShiftIn.mockResolvedValue({
      data: [
        {
          id: secondShiftId,
          event_id: eventId,
          title: "Sunday Wrap",
          starts_at: "2026-10-11T16:00:00.000Z",
          ends_at: "2026-10-11T19:00:00.000Z",
          location: null,
          notes: null,
        },
        {
          id: shiftId,
          event_id: eventId,
          title: "Check-in",
          starts_at: "2026-10-09T19:00:00.000Z",
          ends_at: "2026-10-09T21:00:00.000Z",
          location: "Main Entrance",
          notes: "Assist with attendee check-in.",
        },
      ],
      error: null,
    });
    mocks.adminRoleIn.mockResolvedValue({
      data: [{ id: coverageRoleId, name: "Operations" }],
      error: null,
    });
  });

  it("loads only the authenticated member's active draft and published assignments", async () => {
    const data = await getMemberSchedulePageData();

    expect(data.assignments.map((row) => row.id)).toEqual([
      "draft-assignment",
      "published-assignment",
    ]);
    expect(data.assignments[0]?.shift.title).toBe("Check-in");
    expect(data.assignments[0]?.coverageRole?.name).toBe("Operations");
    expect(data.assignments[1]?.status).toBe("published");
    expect(data.publication).toBeNull();
    expect(mocks.serverFrom).toHaveBeenCalledWith("shift_assignments");
    expect(mocks.assignmentEq).toHaveBeenCalledWith("profile_id", profileId);
    expect(mocks.assignmentIn).toHaveBeenCalledWith("status", ["draft", "published"]);
  });

  it("does not request or return another member's assignments", async () => {
    await getMemberSchedulePageData();

    expect(mocks.assignmentEq).not.toHaveBeenCalledWith("profile_id", otherProfileId);
  });

  it("returns publication state when the schedule has been published", async () => {
    mocks.adminPublicationLimit.mockResolvedValueOnce({
      data: [{ id: "publication-1", published_at: "2026-02-01T00:00:00.000Z" }],
      error: null,
    });

    const data = await getMemberSchedulePageData();

    expect(data.publication).toEqual({
      id: "publication-1",
      published_at: "2026-02-01T00:00:00.000Z",
    });
  });

  it("excludes removed assignments before calculating workload", () => {
    const summary = getMemberScheduleSummary([
      assignment(),
      assignment({
        id: "published",
        status: "published",
        shift_id: secondShiftId,
        shift: {
          id: secondShiftId,
          event_id: eventId,
          title: "Sunday Wrap",
          starts_at: "2026-10-11T16:00:00.000Z",
          ends_at: "2026-10-11T19:30:00.000Z",
          location: null,
          notes: null,
        },
      }),
    ]);

    expect(summary.assignedShiftCount).toBe(2);
    expect(summary.assignedHours).toBe(5.5);
  });

  it("returns an empty summary when no assignments exist", () => {
    expect(getMemberScheduleSummary([])).toEqual({
      assignedShiftCount: 0,
      assignedHours: 0,
      nextAssignment: null,
    });
  });

  it("groups assignments by HackLanta event day and sorts them chronologically", () => {
    const saturdayLate = assignment({
      id: "late",
      shift: {
        id: "late-shift",
        event_id: eventId,
        title: "Late Saturday",
        starts_at: "2026-10-10T23:00:00.000Z",
        ends_at: "2026-10-11T01:00:00.000Z",
        location: null,
        notes: null,
      },
    });
    const saturdayEarly = assignment({
      id: "early",
      shift: {
        id: "early-shift",
        event_id: eventId,
        title: "Early Saturday",
        starts_at: "2026-10-10T14:00:00.000Z",
        ends_at: "2026-10-10T16:00:00.000Z",
        location: null,
        notes: null,
      },
    });

    const groups = groupMemberAssignmentsByDay(
      [saturdayLate, assignment(), saturdayEarly],
      "America/New_York",
    );

    expect(groups[0]?.assignments.map((row) => row.shift.title)).toEqual(["Check-in"]);
    expect(groups[1]?.assignments.map((row) => row.shift.title)).toEqual([
      "Early Saturday",
      "Late Saturday",
    ]);
  });
});
