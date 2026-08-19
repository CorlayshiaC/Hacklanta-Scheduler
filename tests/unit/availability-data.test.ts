import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMemberAvailabilityPageData } from "@/lib/availability/data";

const eventId = "22222222-2222-4222-8222-222222222222";
const profileId = "11111111-1111-4111-8111-111111111111";

function draftEvent() {
  return {
    id: eventId,
    name: "HackLanta II",
    starts_at: "2026-10-09T11:00:00.000Z",
    ends_at: "2026-10-11T19:00:00.000Z",
    timezone: "America/New_York",
    status: "draft",
  };
}

const mocks = vi.hoisted(() => {
  const requireAuthenticatedUser = vi.fn(async () => ({
    user: { id: profileId },
    profile: { id: profileId, role: "member", is_active: true },
  }));
  const eventByIdMaybeSingle = vi.fn();
  const publishedEventsLimit = vi.fn();
  const anyEventsLimit = vi.fn();
  const availabilityOrder = vi.fn();
  const availabilityEq = vi.fn(() => ({ eq: availabilityEq, order: availabilityOrder }));
  const serverFrom = vi.fn((table: string) => {
    if (table === "availability_windows") {
      return {
        select: vi.fn(() => ({
          eq: availabilityEq,
        })),
      };
    }

    return {};
  });
  const adminFrom = vi.fn((table: string) => {
    if (table === "events") {
      return {
        select: vi.fn(() => {
          const eqOrOrder = {
            eq: vi.fn((column: string) => {
              if (column === "id") {
                return { maybeSingle: eventByIdMaybeSingle };
              }

              return {
                order: vi.fn(() => ({
                  limit: publishedEventsLimit,
                })),
              };
            }),
            order: vi.fn(() => ({
              limit: anyEventsLimit,
            })),
          };
          return eqOrOrder;
        }),
      };
    }

    return {};
  });

  return {
    adminFrom,
    anyEventsLimit,
    availabilityEq,
    availabilityOrder,
    eventByIdMaybeSingle,
    publishedEventsLimit,
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

describe("availability data", () => {
  beforeEach(() => {
    mocks.adminFrom.mockClear();
    mocks.anyEventsLimit.mockReset();
    mocks.availabilityEq.mockClear();
    mocks.availabilityOrder.mockReset();
    mocks.eventByIdMaybeSingle.mockReset();
    mocks.publishedEventsLimit.mockReset();
    mocks.requireAuthenticatedUser.mockReset();
    mocks.serverFrom.mockClear();

    mocks.eventByIdMaybeSingle.mockResolvedValue({ data: draftEvent(), error: null });
    mocks.publishedEventsLimit.mockResolvedValue({ data: [draftEvent()], error: null });
    mocks.anyEventsLimit.mockResolvedValue({ data: [draftEvent()], error: null });
    mocks.availabilityOrder.mockResolvedValue({
      data: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          event_id: eventId,
          profile_id: profileId,
          starts_at: "2026-10-10T14:00:00.000Z",
          ends_at: "2026-10-10T22:00:00.000Z",
          status: "available",
          note: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      error: null,
    });
    mocks.requireAuthenticatedUser.mockResolvedValue({
      user: { id: profileId },
      profile: { id: profileId, role: "member", is_active: true },
    });
  });

  it("resolves an event by id when one is given", async () => {
    const data = await getMemberAvailabilityPageData(eventId);

    expect(data.event.id).toBe(eventId);
    expect(mocks.eventByIdMaybeSingle).toHaveBeenCalled();
  });

  it("falls back to the most recent published event when no eventId is given", async () => {
    const data = await getMemberAvailabilityPageData();

    expect(data.event.id).toBe(eventId);
    expect(mocks.publishedEventsLimit).toHaveBeenCalled();
  });

  it("loads a draft-event availability page for an active board member", async () => {
    const data = await getMemberAvailabilityPageData(eventId);

    expect(data.event.status).toBe("draft");
    expect(data.profile.id).toBe(profileId);
    expect(data.windows).toHaveLength(1);
  });

  it("keeps availability reads scoped to the authenticated member profile", async () => {
    await getMemberAvailabilityPageData(eventId);

    expect(mocks.serverFrom).toHaveBeenCalledWith("availability_windows");
    expect(mocks.availabilityEq).toHaveBeenCalledWith("event_id", eventId);
    expect(mocks.availabilityEq).toHaveBeenCalledWith("profile_id", profileId);
    expect(mocks.availabilityEq).toHaveBeenCalledWith("status", "available");
  });

  it("blocks inactive users before event lookup or availability reads", async () => {
    mocks.requireAuthenticatedUser.mockRejectedValue(new Error("NEXT_REDIRECT:/sign-in"));

    await expect(getMemberAvailabilityPageData(eventId)).rejects.toThrow("NEXT_REDIRECT:/sign-in");

    expect(mocks.adminFrom).not.toHaveBeenCalled();
    expect(mocks.serverFrom).not.toHaveBeenCalled();
  });
});
