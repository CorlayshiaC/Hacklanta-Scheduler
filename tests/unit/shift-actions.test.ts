import { beforeEach, describe, expect, it, vi } from "vitest";
import { assignShiftCandidateAction } from "@/lib/admin/shifts/actions";

const eventId = "22222222-2222-4222-8222-222222222222";
const shiftId = "44444444-4444-4444-8444-444444444444";
const profileId = "11111111-1111-4111-8111-111111111111";
const coverageRoleId = "33333333-3333-4333-8333-333333333333";

const mocks = vi.hoisted(() => {
  const redirect = vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  });
  const revalidatePath = vi.fn();
  const requireAdmin = vi.fn(async () => ({ userId: "99999999-9999-4999-8999-999999999999" }));
  const sendScheduleNotification = vi.fn();
  const auditInsert = vi.fn();
  const assignmentInsert = vi.fn();

  return {
    assignmentInsert,
    auditInsert,
    redirect,
    revalidatePath,
    requireAdmin,
    sendScheduleNotification,
  };
});

const shiftRow = {
  id: shiftId,
  event_id: eventId,
  shift_role_id: null,
  title: "Registration desk",
  starts_at: "2026-10-10T14:00:00.000Z",
  ends_at: "2026-10-10T18:00:00.000Z",
  required_people: 1,
  location: null,
  notes: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function queryResult(data: unknown) {
  const query = {
    eq: vi.fn(() => query),
    in: vi.fn(() => ({ data, error: null })),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
  };

  return query;
}

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/admin/shifts/data", () => ({
  getHackLantaIIEventForAdmin: vi.fn(async () => ({
    id: eventId,
    name: "HackLanta II",
    starts_at: "2026-10-09T11:00:00.000Z",
    ends_at: "2026-10-11T19:00:00.000Z",
    timezone: "America/New_York",
    status: "draft",
    created_by: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  })),
}));

vi.mock("@/lib/notifications/service", () => ({
  sendScheduleNotification: mocks.sendScheduleNotification,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: (table: string) => {
      if (table === "audit_log") {
        return { insert: mocks.auditInsert };
      }

      if (table === "shift_assignments") {
        return {
          insert: mocks.assignmentInsert,
          select: () => ({
            in: () => ({
              data: [],
              error: null,
            }),
          }),
        };
      }

      if (table === "shifts") {
        const query = {
          data: [shiftRow],
          error: null,
          eq: vi.fn(() => query),
          maybeSingle: vi.fn(async () => ({ data: shiftRow, error: null })),
        };

        return {
          select: () => query,
        };
      }

      if (table === "coverage_roles") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: coverageRoleId, name: "Operations" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === "profiles") {
        return {
          select: () => ({
            data: [
              {
                id: profileId,
                full_name: "Eligible Member",
                email: "member@example.com",
                role: "board_member",
                is_active: true,
                created_at: "2026-01-01T00:00:00.000Z",
                updated_at: "2026-01-01T00:00:00.000Z",
              },
            ],
            error: null,
          }),
        };
      }

      if (table === "member_coverage_roles") {
        return {
          select: () => ({
            eq: () => ({
              data: [{ event_id: eventId, profile_id: profileId, coverage_role_id: coverageRoleId }],
              error: null,
            }),
          }),
        };
      }

      if (table === "member_settings") {
        return {
          select: () => ({
            eq: () => ({
              data: [
                {
                  event_id: eventId,
                  profile_id: profileId,
                  max_hours: 12,
                  minimum_break_minutes: 30,
                },
              ],
              error: null,
            }),
          }),
        };
      }

      if (table === "availability_windows") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                data: [
                  {
                    event_id: eventId,
                    profile_id: profileId,
                    starts_at: "2026-10-10T13:00:00.000Z",
                    ends_at: "2026-10-10T19:00:00.000Z",
                    status: "available",
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }

      return { select: () => queryResult([]) };
    },
  })),
}));

describe("shift admin actions", () => {
  beforeEach(() => {
    mocks.assignmentInsert.mockReset();
    mocks.auditInsert.mockReset();
    mocks.redirect.mockClear();
    mocks.revalidatePath.mockClear();
    mocks.requireAdmin.mockClear();
    mocks.sendScheduleNotification.mockReset();

    mocks.assignmentInsert.mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            shift_id: shiftId,
            profile_id: profileId,
            coverage_role_id: coverageRoleId,
            assigned_by: "99999999-9999-4999-8999-999999999999",
            status: "draft",
            published_at: null,
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
          error: null,
        }),
      }),
    });
    mocks.auditInsert.mockResolvedValue({ error: null });
    mocks.sendScheduleNotification.mockResolvedValue({
      ok: false,
      status: "unavailable",
      message: "Transactional email delivery is not configured.",
    });
  });

  it("requires admin authorization, creates a draft assignment, notifies the affected member, and writes audit metadata", async () => {
    const formData = new FormData();
    formData.set("shiftId", shiftId);
    formData.set("profileId", profileId);
    formData.set("coverageRoleId", coverageRoleId);
    formData.set("topRecommendedProfileId", profileId);

    await expect(assignShiftCandidateAction(formData)).rejects.toThrow("NEXT_REDIRECT:");

    expect(mocks.requireAdmin).toHaveBeenCalled();
    expect(mocks.assignmentInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        shift_id: shiftId,
        profile_id: profileId,
        coverage_role_id: coverageRoleId,
        assigned_by: "99999999-9999-4999-8999-999999999999",
        status: "draft",
        published_at: null,
      }),
    );
    expect(mocks.sendScheduleNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "HackLanta II",
        eventType: "ASSIGNMENT_ADDED",
        recipient: expect.objectContaining({
          email: "member@example.com",
          id: profileId,
        }),
        shift: expect.objectContaining({
          coverageRoleName: "Operations",
          status: "draft",
          title: "Registration desk",
        }),
        timezone: "America/New_York",
      }),
    );
    expect(mocks.auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: "99999999-9999-4999-8999-999999999999",
        event_id: eventId,
        action: "assignment.created",
        entity_type: "shift_assignment",
        entity_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/shifts");
  });

  it("can return assignment actions to the central schedule workspace", async () => {
    const formData = new FormData();
    formData.set("returnTo", "/admin/schedule");
    formData.set("shiftId", shiftId);
    formData.set("profileId", profileId);
    formData.set("coverageRoleId", coverageRoleId);
    formData.set("topRecommendedProfileId", profileId);

    await expect(assignShiftCandidateAction(formData)).rejects.toThrow("NEXT_REDIRECT:");

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/shifts");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/schedule");
    expect(mocks.redirect).toHaveBeenCalledWith(
      expect.stringContaining("/admin/schedule?result=success"),
    );
  });

  it("does not roll back assignment creation when notification delivery fails", async () => {
    mocks.sendScheduleNotification.mockResolvedValueOnce({
      ok: false,
      status: "failed",
      message: "Notification delivery failed.",
    });
    const formData = new FormData();
    formData.set("shiftId", shiftId);
    formData.set("profileId", profileId);
    formData.set("coverageRoleId", coverageRoleId);
    formData.set("topRecommendedProfileId", profileId);

    await expect(assignShiftCandidateAction(formData)).rejects.toThrow("NEXT_REDIRECT:");

    expect(mocks.assignmentInsert).toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith(expect.stringContaining("result=success"));
  });
});
