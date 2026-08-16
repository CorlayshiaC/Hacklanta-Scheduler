import { describe, expect, it } from "vitest";
import { buildScheduleReview } from "@/lib/admin/schedule/review";
import type { Database } from "@/types/database";

type Shift = Database["public"]["Tables"]["shifts"]["Row"];
type AvailabilityWindow = Database["public"]["Tables"]["availability_windows"]["Row"];
type Assignment = Database["public"]["Tables"]["shift_assignments"]["Row"] & {
  coverage_roles?: { id: string; name: string } | null;
  profiles?: { id: string; full_name: string; email: string; is_active: boolean } | null;
};

const event = {
  id: "event-1",
  name: "HackLanta II",
  starts_at: "2026-10-09T11:00:00.000Z",
  ends_at: "2026-10-11T19:00:00.000Z",
  timezone: "America/New_York",
  status: "draft",
  created_by: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
} as Database["public"]["Tables"]["events"]["Row"];

const profile = {
  id: "profile-1",
  full_name: "Test Dummy",
  email: "dummy@example.com",
  is_active: true,
};
const role = { id: "role-1", name: "Operations" };

function shift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: "shift-1",
    event_id: event.id,
    shift_role_id: null,
    title: "Check-in",
    starts_at: "2026-10-09T19:00:00.000Z",
    ends_at: "2026-10-09T21:00:00.000Z",
    required_people: 1,
    location: "Main Entrance",
    notes: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function assignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: "assignment-1",
    shift_id: "shift-1",
    profile_id: profile.id,
    coverage_role_id: role.id,
    assigned_by: "admin-1",
    origin: "assigned",
    status: "draft",
    published_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    coverage_roles: role,
    profiles: profile,
    ...overrides,
  };
}

function availabilityWindow(overrides: Partial<AvailabilityWindow> = {}): AvailabilityWindow {
  return {
    id: "availability-1",
    event_id: event.id,
    profile_id: profile.id,
    starts_at: "2026-10-09T18:00:00.000Z",
    ends_at: "2026-10-09T22:00:00.000Z",
    status: "available",
    note: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function reviewInput(overrides: Partial<Parameters<typeof buildScheduleReview>[0]> = {}) {
  return {
    assignments: [assignment()],
    availabilityWindows: [availabilityWindow()],
    event,
    memberCoverageRoles: [
      {
        id: "member-role-1",
        event_id: event.id,
        profile_id: profile.id,
        coverage_role_id: role.id,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    memberSettings: [
      {
        id: "settings-1",
        event_id: event.id,
        profile_id: profile.id,
        max_hours: 8,
        minimum_break_minutes: 30,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    publications: [],
    requirements: [
      {
        id: "requirement-1",
        shift_id: "shift-1",
        coverage_role_id: role.id,
        required_people: 1,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        coverage_roles: role,
      },
    ],
    shifts: [shift()],
    ...overrides,
  };
}

describe("schedule review readiness", () => {
  it("marks a valid fully staffed schedule as ready with no issues", () => {
    const review = buildScheduleReview(reviewInput());

    expect(review.summary).toMatchObject({
      draftAssignments: 1,
      fullyStaffedShifts: 1,
      openPositions: 0,
      totalAssignedPositions: 1,
      totalRequiredPositions: 1,
    });
    expect(review.issues).toEqual([]);
  });

  it("reports warnings for unstaffed and partially staffed schedules", () => {
    const review = buildScheduleReview(
      reviewInput({
        assignments: [],
        requirements: [
          {
            id: "requirement-1",
            shift_id: "shift-1",
            coverage_role_id: role.id,
            required_people: 2,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
            coverage_roles: role,
          },
        ],
        shifts: [shift({ required_people: 2 })],
      }),
    );

    expect(review.summary.unstaffedShifts).toBe(1);
    expect(review.summary.openPositions).toBe(2);
    expect(review.issues.every((issue) => issue.severity === "warning")).toBe(true);
    expect(review.issues.map((issue) => issue.type)).toContain("open_positions");
    expect(review.issues.map((issue) => issue.type)).toContain("partially_staffed");
  });

  it("excludes removed assignments from readiness counts and publication drafts", () => {
    const review = buildScheduleReview(
      reviewInput({
        assignments: [assignment({ status: "removed" })],
      }),
    );

    expect(review.summary.totalAssignedPositions).toBe(0);
    expect(review.summary.draftAssignments).toBe(0);
    expect(review.draftAssignments).toHaveLength(0);
  });

  it("detects hard blockers for inactive, unavailable, and role-ineligible assignments", () => {
    const review = buildScheduleReview(
      reviewInput({
        assignments: [
          assignment({
            profiles: { ...profile, is_active: false },
          }),
        ],
        availabilityWindows: [],
        memberCoverageRoles: [],
      }),
    );

    expect(review.issues.filter((issue) => issue.severity === "blocker").map((issue) => issue.type)).toEqual(
      expect.arrayContaining(["inactive_member", "availability_violation", "invalid_coverage_role"]),
    );
  });

  it("detects overlapping, maximum-hours, and minimum-break blockers", () => {
    const secondShift = shift({
      id: "shift-2",
      title: "Overlap Coverage",
      starts_at: "2026-10-09T20:00:00.000Z",
      ends_at: "2026-10-09T20:30:00.000Z",
    });
    const thirdShift = shift({
      id: "shift-3",
      title: "Office Hours",
      starts_at: "2026-10-09T21:15:00.000Z",
      ends_at: "2026-10-09T22:45:00.000Z",
    });
    const review = buildScheduleReview(
      reviewInput({
        assignments: [
          assignment(),
          assignment({
            id: "assignment-2",
            shift_id: "shift-2",
          }),
          assignment({
            id: "assignment-3",
            shift_id: "shift-3",
          }),
        ],
        availabilityWindows: [availabilityWindow({ ends_at: "2026-10-09T23:00:00.000Z" })],
        memberSettings: [
          {
            id: "settings-1",
            event_id: event.id,
            profile_id: profile.id,
            max_hours: 3,
            minimum_break_minutes: 60,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
        ],
        shifts: [shift(), secondShift, thirdShift],
      }),
    );

    expect(review.issues.filter((issue) => issue.severity === "blocker").map((issue) => issue.type)).toEqual(
      expect.arrayContaining(["max_hours", "minimum_break", "overlap"]),
    );
  });

  it("reports existing publications so republishing can be blocked", () => {
    const review = buildScheduleReview(
      reviewInput({
        publications: [
          {
            id: "publication-1",
            event_id: event.id,
            published_at: "2026-02-01T00:00:00.000Z",
            published_by: "admin-1",
            notes: null,
          },
        ],
      }),
    );

    expect(review.alreadyPublished).toBe(true);
    expect(review.latestPublication?.id).toBe("publication-1");
  });
});
