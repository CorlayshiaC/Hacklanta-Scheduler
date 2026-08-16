const protectedRoutePrefixes = ["/admin", "/my-schedule", "/availability", "/schedule", "/working-now"];

export function isAdminRoute(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function isProtectedRoute(pathname: string): boolean {
  return protectedRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function getSignInRedirectUrl(pathname: string, origin = "http://localhost:3000"): URL {
  const url = new URL("/sign-in", origin);

  if (pathname !== "/sign-in") {
    url.searchParams.set("next", pathname);
  }

  return url;
}

export function getPostAuthPath(role: "admin" | "board_member"): "/admin" | "/my-schedule" {
  return role === "admin" ? "/admin" : "/my-schedule";
}
