const protectedRoutePrefixes = [
  "/admin",
  "/my-schedule",
  "/availability",
  "/schedule",
  "/working-now",
  // Requested in docs/contracts/requests.md: Agent 1 (/swaps), Agent 5 (/settings), Agent 3
  // (/events, /coverage, /calendar), Agent 4 (/shifts).
  "/swaps",
  "/settings",
  "/events",
  "/coverage",
  "/calendar",
  "/shifts",
];

// Director or admin, per middleware.ts's admin-route gate. Covers both the legacy /admin/* surfaces
// and their in-progress /events + /coverage + /calendar replacements (Agent 3's heads-up in
// requests.md: both exist side by side during the migration). V2: "director" replaces "organizer";
// this is a route-level gate only, actual director write access is scoped per-event by RLS
// (app_private.is_director_of_event), not by this prefix list.
const directorRoutePrefixes = ["/admin", "/events", "/coverage", "/calendar"];

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

export function getPostAuthPath(role: "admin" | "director" | "member"): "/admin" | "/my-schedule" {
  return role === "admin" || role === "director" ? "/admin" : "/my-schedule";
}
