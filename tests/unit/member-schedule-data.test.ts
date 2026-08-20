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

const testEvent = {
  id: eventId,
  name: "HackLanta II",
  starts_at: "2026-10-09T11:00:00.000Z",
  ends_at: "2026-10-11T19:00:00.000Z",
  timezone: "America/New_York",
  status: "published" as const,
  location: "Student Center",
};

const mocks = vi.hoisted(() => {
  const requireAuthenticatedUser = vi.fn();
  const assignmentIn2 = vi.fn();
  const assignmentIn1 = vi.fn(() => ({ in: assignmentIn2 }));
  const assignmentEq = vi.fn(() => ({ in: assignmentIn1 }));
  const serverRpc = vi.fn((fn: string) => {
    if (fn === "hours_per_event") return Promise.resolve({ data: 4, error: null });
    if (fn === "hours_semester") return Promise.resolve({ data: 12, error: null });
    return Promise.resolve({ data: null, error: null });
  });
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

  const publishedEventsLimit = vi.fn();
  const adminShiftEq = vi.fn();
  const adminRoleIn = vi.fn();
  const adminFrom = vi.fn((table: string) => {
    if (table === "events") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ order: vi.fn(() => ({ limit: publishedEventsLimit })) })),
        })),
      };
    }

    if (table === "shifts") {
      return {
        select: vi.fn(() => ({
          eq: adminShiftEq,
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
    adminFrom,
    adminRoleIn,
    adminShiftEq,
    assignmentEq,
    assignmentIn1,
    assignmentIn2,
    publishedEventsLimit,
    requireAuthenticatedUser,
    serverFrom,
    serverRpc,
  };
});

vi.mock("@/lib/auth/authorization", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: mocks.serverFrom,
    rpc: mocks.serverRpc,
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
    state: overrides.state ?? "in_approval",
    origin: overrides.origin ?? "assigned",
    approved_at: overrides.approved_at ?? null,
    approved_by: overrides.approved_by ?? null,
    proposed_by_ai: overrides.proposed_by_ai ?? false,
    warnings: overrides.warnings ?? null,
    published_at: overrides.published_at ?? null,
    created_at: overrides.created_at ?? "2026-01-01T00:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-01-01T00:00:00.000Z",
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
  };
}

describe("member schedule data", () => {
  beforeEach(() => {
    mocks.adminFrom.mockClear();
    mocks.adminRoleIn.mockReset();
    mocks.adminShiftEq.mockReset();
    mocks.assignmentEq.mockClear();
    mocks.assignmentIn1.mockClear();
    mocks.assignmentIn2.mockReset();
    mocks.publishedEventsLimit.mockReset();
    mocks.requireAuthenticatedUser.mockReset();
    mocks.serverFrom.mockClear();
    mocks.serverRpc.mockClear();

    mocks.requireAuthenticatedUser.mockResolvedValue({
      user: { id: profileId },
      profile: { id: profileId, role: "member", is_active: true },
    });
    mocks.publishedEventsLimit.mockResolvedValue({ data: [testEvent], error: null });
    mocks.adminShiftEq.mockResolvedValue({
      data: [
        {
          id: shiftId,
          event_id: eventId,
          title: "Check-in",
          starts_at: "2026-10-09T19:00:00.000Z",
          ends_at: "2026-10-09T21:00:00.000Z",
          location: "Main Entrance",
          notes: "Assist with attendee check-in.",
        },
        {
          id: secondShiftId,
          event_id: eventId,
          title: "Sunday Wrap",
          starts_at: "2026-10-11T16:00:00.000Z",
          ends_at: "2026-10-11T19:00:00.000Z",
          location: null,
          notes: null,
        },
      ],
      error: null,
    });
    mocks.assignmentIn2.mockResolvedValue({
      data: [
        {
          id: "pending-assignment",
          shift_id: shiftId,
          profile_id: profileId,
          coverage_role_id: coverageRoleId,
          assigned_by: "admin-1",
          state: "in_approval",
          published_at: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "approved-assignment",
          shift_id: secondShiftId,
          profile_id: profileId,
          coverage_role_id: null,
          assigned_by: "admin-1",
          state: "approved",
          published_at: "2026-02-01T00:00:00.000Z",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      error: null,
    });
    mocks.adminRoleIn.mockResolvedValue({
      data: [{ id: coverageRoleId, name: "Operations" }],
      error: null,
    });
  });

  it("loads only the authenticated member's in-approval and approved assignments, scoped to the event's own shifts", async () => {
    const data = await getMemberSchedulePageData();

    expect(data.assignments.map((row) => row.id)).toEqual(["pending-assignment", "approved-assignment"]);
    expect(data.assignments[0]?.shift.title).toBe("Check-in");
    expect(data.assignments[0]?.coverageRole?.name).toBe("Operations");
    expect(data.assignments[1]?.state).toBe("approved");
    expect(data.hours).toEqual({ event: 4, semester: 12 });
    expect(mocks.serverFrom).toHaveBeenCalledWith("shift_assignments");
    expect(mocks.assignmentEq).toHaveBeenCalledWith("profile_id", profileId);
    expect(mocks.assignmentIn1).toHaveBeenCalledWith("shift_id", [shiftId, secondShiftId]);
    expect(mocks.assignmentIn2).toHaveBeenCalledWith("state", ["in_approval", "approved"]);
  });

  it("does not request or return another member's assignments", async () => {
    await getMemberSchedulePageData();

    expect(mocks.assignmentEq).not.toHaveBeenCalledWith("profile_id", otherProfileId);
  });

  it("returns no assignments when the event has no shifts yet, without querying shift_assignments", async () => {
    mocks.adminShiftEq.mockResolvedValue({ data: [], error: null });

    const data = await getMemberSchedulePageData();

    expect(data.assignments).toEqual([]);
    expect(mocks.serverFrom).not.toHaveBeenCalledWith("shift_assignments");
  });

  it("counts every assignment (in-approval and approved alike) toward workload", () => {
    const summary = getMemberScheduleSummary([
      assignment(),
      assignment({
        id: "approved",
        state: "approved",
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

  it("groups assignments by the event's own days, derived from its start/end, and sorts them chronologically", () => {
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

    const groups = groupMemberAssignmentsByDay([saturdayLate, assignment(), saturdayEarly], testEvent);

    expect(groups[0]?.assignments.map((row) => row.shift.title)).toEqual(["Check-in"]);
    expect(groups[1]?.assignments.map((row) => row.shift.title)).toEqual(["Early Saturday", "Late Saturday"]);
  });
});
