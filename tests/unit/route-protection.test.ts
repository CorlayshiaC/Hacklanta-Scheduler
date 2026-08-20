import { describe, expect, it } from "vitest";
import {
  getPostAuthPath,
  getSignInRedirectUrl,
  isAdminOnlyRoute,
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

  it("gates the V2 routes at the tier each one actually needs", () => {
    // /approval is the admin and director approval queue: signed in AND director tier.
    expect(isProtectedRoute("/approval")).toBe(true);
    expect(isAdminRoute("/approval")).toBe(true);

    // /my-events is the member-facing read-only list: signed in, but not director-gated. Getting
    // this backwards would lock every member out of their own events page.
    expect(isProtectedRoute("/my-events")).toBe(true);
    expect(isAdminRoute("/my-events")).toBe(false);
  });

  it("builds a sign-in redirect with the original protected path", () => {
    const url = getSignInRedirectUrl("/admin", "https://scheduler.example");

    expect(url.pathname).toBe("/sign-in");
    expect(url.searchParams.get("next")).toBe("/admin");
  });

  it("routes users by database role after authentication", () => {
    expect(getPostAuthPath("admin")).toBe("/coverage");
    expect(getPostAuthPath("director")).toBe("/coverage");
    expect(getPostAuthPath("member")).toBe("/my-schedule");
  });

  // Guards the reason for the change above: /admin is the retired V1 command centre (dead design
  // system, hardcoded to a 2026 HackLanta event) and must not be anyone's landing page again.
  it("never lands anyone on the retired /admin tree", () => {
    for (const role of ["admin", "director", "member"] as const) {
      expect(getPostAuthPath(role)).not.toBe("/admin");
    }
  });

  // Whatever the landing path is, the middleware has to actually let that role reach it, otherwise
  // signing in is a redirect loop.
  it("lands every role somewhere their own role can reach", () => {
    expect(isProtectedRoute(getPostAuthPath("admin"))).toBe(true);
    expect(isAdminOnlyRoute(getPostAuthPath("director"))).toBe(false);
    expect(isAdminRoute(getPostAuthPath("member"))).toBe(false);
  });
});
