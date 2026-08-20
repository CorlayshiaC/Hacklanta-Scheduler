const protectedRoutePrefixes = [
  "/admin",
  "/my-schedule",
  "/availability",
  "/schedule",
  "/working-now",
  // Requested in docs/contracts/requests.md: Agent 1 (/swaps), Agent 5 (/settings), Agent 3
  // (/events, /coverage, /calendar), Agent 4 (/shifts), Agent 3 (/approval), Agent 6 (/my-events).
  "/swaps",
  "/settings",
  "/events",
  "/coverage",
  "/calendar",
  "/shifts",
  "/approval",
  "/my-events",
];

// Director or admin, per middleware.ts's admin-route gate. Covers both the legacy /admin/* surfaces
// and their in-progress /events + /coverage + /calendar replacements (Agent 3's heads-up in
// requests.md: both exist side by side during the migration). V2: "director" replaces "organizer";
// this is a route-level gate only, actual director write access is scoped per-event by RLS
// (app_private.is_director_of_event), not by this prefix list.
// /approval is the V2 approval queue, which admins and directors browse (Agent 3's request in
// requests.md). /my-events is deliberately NOT here: it is the member-facing read-only event list,
// so it needs sign-in but not the director tier.
const directorRoutePrefixes = ["/admin", "/events", "/coverage", "/calendar", "/approval"];

// Admin only, no director, per Agent 5's request in requests.md: role management and org settings are
// the admin tier specifically in the shared-context role split, not director.
const adminOnlyRoutePrefixes = ["/settings/roles", "/settings/organization"];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isAdminRoute(pathname: string): boolean {
  return matchesPrefix(pathname, directorRoutePrefixes);
}

export function isAdminOnlyRoute(pathname: string): boolean {
  return matchesPrefix(pathname, adminOnlyRoutePrefixes);
}

export function isProtectedRoute(pathname: string): boolean {
  return matchesPrefix(pathname, protectedRoutePrefixes);
}

export function getSignInRedirectUrl(pathname: string, origin = "http://localhost:3000"): URL {
  const url = new URL("/sign-in", origin);

  if (pathname !== "/sign-in") {
    url.searchParams.set("next", pathname);
  }

  return url;
}

/**
 * Where signing in drops you.
 *
 * Admin/director used to land on /admin, the V1 command centre: still on the retired AppShell, still
 * branded "HackLanta Scheduler", still hardcoded to "HackLanta II · October 9-11, 2026". That made
 * a dead page the first thing an admin saw after signing in to production. /coverage is the V2/V4
 * replacement for the same job (staffing across events) and is already gated to admin+director by
 * directorRoutePrefixes above. The /admin tree is still routable, just no longer the front door.
 */
export function getPostAuthPath(role: "admin" | "director" | "member"): "/coverage" | "/my-schedule" {
  return role === "admin" || role === "director" ? "/coverage" : "/my-schedule";
}
