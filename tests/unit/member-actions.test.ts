import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateMemberSettingsAction } from "@/lib/admin/member-actions";

const mocks = vi.hoisted(() => {
  const redirect = vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  });
  const revalidatePath = vi.fn();
  const requireAdmin = vi.fn(async () => ({ userId: "99999999-9999-4999-8999-999999999999" }));
  const memberSettingsMaybeSingle = vi.fn();
  const memberSettingsUpsert = vi.fn();
  const auditInsert = vi.fn();
  const from = vi.fn((table: string) => {
    if (table === "member_settings") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: memberSettingsMaybeSingle,
            })),
          })),
        })),
        upsert: memberSettingsUpsert,
      };
    }

    if (table === "audit_log") {
      return {
        insert: auditInsert,
      };
    }

    return {};
  });

  return {
    auditInsert,
    from,
    memberSettingsMaybeSingle,
    memberSettingsUpsert,
    redirect,
    revalidatePath,
    requireAdmin,
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

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: mocks.from,
  })),
}));

describe("member admin actions", () => {
  beforeEach(() => {
    mocks.auditInsert.mockReset();
    mocks.from.mockClear();
    mocks.memberSettingsMaybeSingle.mockReset();
    mocks.memberSettingsUpsert.mockReset();
    mocks.redirect.mockClear();
    mocks.revalidatePath.mockClear();
    mocks.requireAdmin.mockClear();

    mocks.memberSettingsMaybeSingle.mockResolvedValue({
      data: { max_hours: 10, minimum_break_minutes: 15 },
      error: null,
    });
    mocks.memberSettingsUpsert.mockResolvedValue({ error: null });
    mocks.auditInsert.mockResolvedValue({ error: null });
  });

  it("updates member settings through an admin-only action and writes an audit entry", async () => {
    const formData = new FormData();
    formData.set("profileId", "11111111-1111-4111-8111-111111111111");
    formData.set("eventId", "22222222-2222-4222-8222-222222222222");
    formData.set("maxHours", "12");
    formData.set("minimumBreakMinutes", "30");

    await expect(updateMemberSettingsAction(formData)).rejects.toThrow("NEXT_REDIRECT:");

    expect(mocks.requireAdmin).toHaveBeenCalled();
    expect(mocks.memberSettingsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: "22222222-2222-4222-8222-222222222222",
        profile_id: "11111111-1111-4111-8111-111111111111",
        max_hours: 12,
        minimum_break_minutes: 30,
      }),
      { onConflict: "event_id,profile_id" },
    );
    expect(mocks.auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: "99999999-9999-4999-8999-999999999999",
        event_id: "22222222-2222-4222-8222-222222222222",
        action: "member.settings_updated",
        entity_type: "member_settings",
        entity_id: "11111111-1111-4111-8111-111111111111",
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/members");
  });
});
