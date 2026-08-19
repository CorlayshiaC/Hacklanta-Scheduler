import { describe, expect, it } from "vitest";
import { config } from "@/../middleware";

/**
 * The middleware matcher is a performance boundary with correctness consequences in both
 * directions, so it is pinned by test rather than left to review.
 *
 * Too broad and every public request pays a live GoTrue `GET /auth/v1/user` round trip it then
 * discards. Too narrow and a route that needs its auth cookie refreshed stops getting one, which
 * surfaces as users being randomly signed out: `auth.getUser()` is what rotates the token and
 * writes it back through the `setAll` callback, so any path that can carry a session must stay in.
 */
const matcher = new RegExp(`^${config.matcher[0]}$`);

const RUNS_MIDDLEWARE = [
  "/",
  "/sign-in",
  "/sign-up",
  "/join/some-token",
  "/my-schedule",
  "/availability",
  "/shifts",
  "/swaps",
  "/my-events",
  "/coverage",
  "/coverage/event-id",
  "/approval",
  "/events",
  "/calendar",
  "/settings",
  "/settings/roles",
  "/settings/organization",
  "/admin",
  // Authenticated API surfaces still resolve a session, so they stay behind the middleware.
  "/api/quickchat",
  "/api/export/shifts",
  "/api/ai/shift-generation",
];

const SKIPS_MIDDLEWARE = [
  // Public share page: reads through the get_public_schedule security-definer RPC, never a session.
  "/s/share-token",
  // Token-authenticated or anonymous public endpoints.
  "/api/feeds/mine/token",
  "/api/feeds/event/event-id",
  "/api/og/share-token",
  "/api/embed/widget.js",
  "/api/public/upcoming-shifts",
  // Generated assets and the service worker.
  "/sw.js",
  "/manifest.webmanifest",
  "/apple-icon",
  "/icon-192.png",
  "/icon-512.png",
  // Framework and image assets.
  "/_next/static/chunk.js",
  "/_next/image",
  "/favicon.ico",
  "/logo.svg",
  "/photo.png",
];

describe("middleware matcher", () => {
  it("runs on every route that can carry a session", () => {
    for (const pathname of RUNS_MIDDLEWARE) {
      expect(matcher.test(pathname), `${pathname} should run middleware`).toBe(true);
    }
  });

  it("skips definitively public routes that never read a session", () => {
    for (const pathname of SKIPS_MIDDLEWARE) {
      expect(matcher.test(pathname), `${pathname} should skip middleware`).toBe(false);
    }
  });

  it("does not let the /s/ exclusion swallow /settings, /shifts, /swaps or /sign-in", () => {
    // `s/` as a matcher alternative is one careless character away from excluding every route that
    // starts with an s, which would silently unprotect /settings.
    for (const pathname of ["/settings", "/settings/roles", "/shifts", "/swaps", "/sign-in", "/sign-up"]) {
      expect(matcher.test(pathname), `${pathname} must stay protected`).toBe(true);
    }
  });
});
