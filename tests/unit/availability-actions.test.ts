import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAvailabilityWindowAction,
  deleteAvailabilityWindowAction,
  updateAvailabilityWindowAction,
} from "@/lib/availability/actions";

const eventId = "22222222-2222-4222-8222-222222222222";
const profileId = "11111111-1111-4111-8111-111111111111";
const windowId = "33333333-3333-4333-8333-333333333333";

const mocks = vi.hoisted(() => {
  const redirect = vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  });
  const revalidatePath = vi.fn();
  const requireAuthenticatedUser = vi.fn(async () => ({
    user: { id: "user-1" },
    profile: { id: "11111111-1111-4111-8111-111111111111", role: "board_member", is_active: true },
  }));
  const adminEventMaybeSingle = vi.fn();
  const existingWindowsResult = vi.fn();
  const existingWindowMaybeSingle = vi.fn();
  const insert = vi.fn();
  const update = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
  const deleteQuery = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
  const from = vi.fn((table: string) => {
    if (table === "availability_windows") {
      return {
        select: vi.fn((columns: string) => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() =>
                columns === "id,starts_at,ends_at"
                  ? existingWindowsResult()
                  : { maybeSingle: existingWindowMaybeSingle },
              ),
            })),
          })),
        })),
        insert,
        update,
        delete: deleteQuery,
      };
    }

    return {};
  });
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

    return {};
  });

  return {
    adminEventMaybeSingle,
    adminFrom,
    deleteQuery,
    existingWindowMaybeSingle,
    existingWindowsResult,
    from,
    insert,
    redirect,
    requireAuthenticatedUser,
    revalidatePath,
    update,
  };
});

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: mocks.from,
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: mocks.adminFrom,
  })),
}));

function availabilityForm() {
  const formData = new FormData();
  formData.set("date", "2026-10-10");
  formData.set("startsAt", "10:00");
  formData.set("endsAt", "18:00");
  formData.set("note", "Available for late-night coverage.");
  return formData;
}

describe("availability actions", () => {
  beforeEach(() => {
    mocks.adminEventMaybeSingle.mockReset();
    mocks.adminFrom.mockClear();
    mocks.deleteQuery.mockClear();
    mocks.existingWindowMaybeSingle.mockReset();
    mocks.existingWindowsResult.mockReset();
    mocks.from.mockClear();
    mocks.insert.mockReset();
    mocks.redirect.mockClear();
    mocks.requireAuthenticatedUser.mockReset();
    mocks.revalidatePath.mockClear();
    mocks.update.mockClear();

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
    mocks.existingWindowsResult.mockResolvedValue({ data: [], error: null });
    mocks.existingWindowMaybeSingle.mockResolvedValue({ data: { id: windowId }, error: null });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.requireAuthenticatedUser.mockResolvedValue({
      user: { id: "user-1" },
      profile: { id: profileId, role: "board_member", is_active: true },
    });
  });

  it("creates valid availability for the authenticated user's profile", async () => {
    await expect(createAvailabilityWindowAction(availabilityForm())).rejects.toThrow("NEXT_REDIRECT:");

    expect(mocks.requireAuthenticatedUser).toHaveBeenCalled();
    expect(mocks.adminFrom).toHaveBeenCalledWith("events");
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: eventId,
        profile_id: profileId,
        starts_at: "2026-10-10T14:00:00.000Z",
        ends_at: "2026-10-10T22:00:00.000Z",
        status: "available",
      }),
    );
  });

  it("ignores client-submitted profile and event IDs when creating availability", async () => {
    const formData = availabilityForm();
    formData.set("profileId", "99999999-9999-4999-8999-999999999999");
    formData.set("eventId", "88888888-8888-4888-8888-888888888888");

    await expect(createAvailabilityWindowAction(formData)).rejects.toThrow("NEXT_REDIRECT:");

    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: eventId,
        profile_id: profileId,
      }),
    );
  });

  it("rejects overlapping availability before insert", async () => {
    mocks.existingWindowsResult.mockResolvedValue({
      data: [
        {
          id: windowId,
          starts_at: "2026-10-10T15:00:00.000Z",
          ends_at: "2026-10-10T16:00:00.000Z",
        },
      ],
      error: null,
    });

    await expect(createAvailabilityWindowAction(availabilityForm())).rejects.toThrow("NEXT_REDIRECT:");

    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith(
      expect.stringContaining("overlaps+this+time"),
    );
  });

  it("relies on authenticated user lookup so inactive-member rejection happens before writes", async () => {
    mocks.requireAuthenticatedUser.mockRejectedValue(new Error("NEXT_REDIRECT:/sign-in"));

    await expect(createAvailabilityWindowAction(availabilityForm())).rejects.toThrow(
      "NEXT_REDIRECT:/sign-in",
    );
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.adminFrom).not.toHaveBeenCalledWith("events");
  });

  it("updates only a window owned by the authenticated user", async () => {
    const formData = availabilityForm();
    formData.set("windowId", windowId);

    await expect(updateAvailabilityWindowAction(formData)).rejects.toThrow("NEXT_REDIRECT:");

    expect(mocks.from).toHaveBeenCalledWith("availability_windows");
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        starts_at: "2026-10-10T14:00:00.000Z",
        ends_at: "2026-10-10T22:00:00.000Z",
        status: "available",
      }),
    );
  });

  it("deletes only a window owned by the authenticated user", async () => {
    const formData = new FormData();
    formData.set("windowId", windowId);

    await expect(deleteAvailabilityWindowAction(formData)).rejects.toThrow("NEXT_REDIRECT:");

    expect(mocks.requireAuthenticatedUser).toHaveBeenCalled();
    expect(mocks.deleteQuery).toHaveBeenCalled();
  });
});
