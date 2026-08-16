import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishScheduleAction } from "@/lib/admin/schedule/actions";

const eventId = "22222222-2222-4222-8222-222222222222";
const adminId = "99999999-9999-4999-8999-999999999999";

const mocks = vi.hoisted(() => {
  const redirect = vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  });
  const revalidatePath = vi.fn();
  const requireAdmin = vi.fn(async () => ({ userId: adminId }));
  const getScheduleReviewData = vi.fn();
  const sendScheduleNotification = vi.fn();
  const auditInsert = vi.fn();
  const assignmentUpdate = vi.fn();
  const publicationInsert = vi.fn();

  return {
    assignmentUpdate,
    auditInsert,
    getScheduleReviewData,
    publicationInsert,
    redirect,
    requireAdmin,
    revalidatePath,
    sendScheduleNotification,
  };
});

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("@/lib/admin/schedule/review", () => ({
  getScheduleReviewData: mocks.getScheduleReviewData,
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
          update: mocks.assignmentUpdate,
        };
      }

      if (table === "schedule_publications") {
        return {
          insert: mocks.publicationInsert,
        };
      }

      return {};
    },
  })),
}));

function review(overrides: Record<string, unknown> = {}) {
  return {
    alreadyPublished: false,
    draftAssignments: [
      {
        id: "assignment-1",
        shift_id: "shift-1",
        profile_id: "profile-1",
        profiles: {
          id: "profile-1",
          full_name: "Jane Smith",
          email: "jane@example.com",
          is_active: true,
        },
      },
      {
        id: "assignment-2",
        shift_id: "shift-2",
        profile_id: "profile-1",
        profiles: {
          id: "profile-1",
          full_name: "Jane Smith",
          email: "jane@example.com",
          is_active: true,
        },
      },
    ],
    event: {
      id: eventId,
      name: "HackLanta II",
      timezone: "America/New_York",
    },
    issues: [],
    latestPublication: null,
    shifts: [{ id: "shift-1" }, { id: "shift-2" }],
    summary: {},
    ...overrides,
  };
}

function confirmedFormData() {
  const formData = new FormData();
  formData.set("publishConfirmation", "publish-hacklanta-ii");
  return formData;
}

describe("schedule publishing action", () => {
  beforeEach(() => {
    mocks.assignmentUpdate.mockReset();
    mocks.auditInsert.mockReset();
    mocks.getScheduleReviewData.mockReset();
    mocks.publicationInsert.mockReset();
    mocks.redirect.mockClear();
    mocks.requireAdmin.mockReset();
    mocks.revalidatePath.mockClear();
    mocks.sendScheduleNotification.mockReset();

    mocks.requireAdmin.mockResolvedValue({ userId: adminId });
    mocks.auditInsert.mockResolvedValue({ error: null });
    mocks.assignmentUpdate.mockReturnValue({
      in: vi.fn(async () => ({ error: null })),
    });
    mocks.publicationInsert.mockReturnValue({
      select: () => ({
        single: async () => ({
          data: { id: "publication-1" },
          error: null,
        }),
      }),
    });
    mocks.getScheduleReviewData.mockResolvedValue(review());
    mocks.sendScheduleNotification.mockResolvedValue({
      ok: false,
      status: "unavailable",
      message: "Transactional email delivery is not configured.",
    });
  });

  it("requires an active admin before publishing", async () => {
    mocks.requireAdmin.mockRejectedValueOnce(new Error("NEXT_REDIRECT:/my-schedule"));

    await expect(publishScheduleAction(confirmedFormData())).rejects.toThrow(
      "NEXT_REDIRECT:/my-schedule",
    );

    expect(mocks.getScheduleReviewData).not.toHaveBeenCalled();
    expect(mocks.assignmentUpdate).not.toHaveBeenCalled();
    expect(mocks.publicationInsert).not.toHaveBeenCalled();
  });

  it("requires explicit publish confirmation", async () => {
    await expect(publishScheduleAction(new FormData())).rejects.toThrow("NEXT_REDIRECT:");

    expect(mocks.getScheduleReviewData).not.toHaveBeenCalled();
    expect(mocks.assignmentUpdate).not.toHaveBeenCalled();
    expect(mocks.publicationInsert).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith(
      expect.stringContaining("Confirm%20publication%20before%20publishing."),
    );
  });

  it("audits the attempt and blocks publication when hard blockers exist", async () => {
    mocks.getScheduleReviewData.mockResolvedValueOnce(
      review({
        issues: [
          {
            id: "blocker-1",
            severity: "blocker",
            title: "Overlapping assignment",
            type: "overlap",
          },
        ],
      }),
    );

    await expect(publishScheduleAction(confirmedFormData())).rejects.toThrow("NEXT_REDIRECT:");

    expect(mocks.auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "schedule.publication_attempted",
        actor_id: adminId,
        event_id: eventId,
      }),
    );
    expect(mocks.assignmentUpdate).not.toHaveBeenCalled();
    expect(mocks.publicationInsert).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith(
      expect.stringContaining("Resolve%20hard%20blockers%20before%20publishing."),
    );
  });

  it("publishes draft assignments, records the publication, and audits success", async () => {
    await expect(publishScheduleAction(confirmedFormData())).rejects.toThrow("NEXT_REDIRECT:");

    expect(mocks.assignmentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "published",
        published_at: expect.any(String),
      }),
    );
    expect(mocks.publicationInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: eventId,
        published_by: adminId,
      }),
    );
    expect(mocks.sendScheduleNotification).toHaveBeenCalledTimes(1);
    expect(mocks.sendScheduleNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "HackLanta II",
        eventType: "SCHEDULE_PUBLISHED",
        recipient: expect.objectContaining({
          email: "jane@example.com",
          id: "profile-1",
        }),
        timezone: "America/New_York",
      }),
    );
    expect(mocks.auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "schedule.published",
        entity_id: "publication-1",
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/schedule");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/schedule/review");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/my-schedule");
    expect(mocks.redirect).toHaveBeenCalledWith(
      expect.stringContaining("/admin/schedule/review?result=success"),
    );
  });

  it("does not roll back publication when notification delivery fails", async () => {
    mocks.sendScheduleNotification.mockResolvedValueOnce({
      ok: false,
      status: "failed",
      message: "Notification delivery failed.",
    });

    await expect(publishScheduleAction(confirmedFormData())).rejects.toThrow("NEXT_REDIRECT:");

    expect(mocks.assignmentUpdate).toHaveBeenCalled();
    expect(mocks.publicationInsert).toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith(
      expect.stringContaining("/admin/schedule/review?result=success"),
    );
  });
});
