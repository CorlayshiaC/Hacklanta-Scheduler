import { describe, expect, it } from "vitest";
import {
  getPostAuthPath,
  getSignInRedirectUrl,
  isAdminRoute,
  isProtectedRoute,
} from "@/lib/auth/route-protection";

describe("route protection helpers", () => {
  it("identifies protected application routes", () => {
    expect(isProtectedRoute("/admin")).toBe(true);
    expect(isProtectedRoute("/my-schedule")).toBe(true);
    expect(isProtectedRoute("/schedule")).toBe(true);
    expect(isProtectedRoute("/sign-in")).toBe(false);
  });

  it("identifies admin routes", () => {
    expect(isAdminRoute("/admin")).toBe(true);
    expect(isAdminRoute("/admin/members")).toBe(true);
    expect(isAdminRoute("/admin/schedule")).toBe(true);
    expect(isAdminRoute("/admin/schedule/review")).toBe(true);
    expect(isAdminRoute("/my-schedule")).toBe(false);
  });

  it("builds a sign-in redirect with the original protected path", () => {
    const url = getSignInRedirectUrl("/admin", "https://scheduler.example");

    expect(url.pathname).toBe("/sign-in");
    expect(url.searchParams.get("next")).toBe("/admin");
  });

  it("routes users by database role after authentication", () => {
    expect(getPostAuthPath("admin")).toBe("/admin");
    expect(getPostAuthPath("board_member")).toBe("/my-schedule");
  });
});
