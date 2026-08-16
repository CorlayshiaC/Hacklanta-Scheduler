const callbackRedirectOrigin = "https://hacklanta-scheduler.local";

export function getSafeCallbackRedirectPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }

  try {
    const parsed = new URL(next, callbackRedirectOrigin);
    return parsed.origin === callbackRedirectOrigin
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : "/";
  } catch {
    return "/";
  }
}
