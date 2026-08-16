import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getActiveUserAuthorization,
  getAdminAuthorization,
  requireAdmin,
  requireBoardMember,
} from "@/lib/auth/authorization";

const mockGetUser = vi.fn();
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockRedirect = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
);

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}));

describe("admin authorization helpers", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockFrom.mockClear();
    mockSelect.mockClear();
    mockEq.mockClear();
    mockMaybeSingle.mockReset();
    mockRedirect.mockClear();
  });

  it("does not authorize anonymous users", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(getAdminAuthorization()).resolves.toEqual({
      isAdmin: false,
      userId: null,
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("authorizes users when their server-read profile is active admin", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: { role: "admin", is_active: true },
      error: null,
    });

    await expect(getAdminAuthorization()).resolves.toEqual({
      isAdmin: true,
      userId: "user-1",
    });
    expect(mockFrom).toHaveBeenCalledWith("profiles");
    expect(mockSelect).toHaveBeenCalledWith("id,role,is_active");
    expect(mockEq).toHaveBeenCalledWith("id", "user-1");
  });

  it("redirects board members away when admin access is required", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: { role: "board_member", is_active: true },
      error: null,
    });

    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT:/my-schedule");
    expect(mockRedirect).toHaveBeenCalledWith("/my-schedule");
  });

  it("rejects inactive users for active-user authorization", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-2" } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: { id: "user-2", role: "board_member", is_active: false },
      error: null,
    });

    await expect(getActiveUserAuthorization()).resolves.toEqual({
      authorized: false,
      reason: "inactive",
      userId: "user-2",
    });
  });

  it("allows active board members through the board-member helper", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-3" } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: { id: "user-3", role: "board_member", is_active: true },
      error: null,
    });

    await expect(requireBoardMember()).resolves.toEqual({
      user: { id: "user-3" },
      profile: { id: "user-3", role: "board_member", is_active: true },
    });
  });

  it("redirects admins away from board-member-only helper", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-4" } },
      error: null,
    });
    mockMaybeSingle.mockResolvedValue({
      data: { id: "user-4", role: "admin", is_active: true },
      error: null,
    });

    await expect(requireBoardMember()).rejects.toThrow("NEXT_REDIRECT:/admin");
  });
});
