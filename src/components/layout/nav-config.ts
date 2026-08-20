import type { NavIconKey } from "./nav-icons";

/**
 * "director" per the v2 shared decision's role rename (schema migration owned by Agent 2,
 * 20260817000100_v2_role_model_and_event_directors.sql). Was "organizer" pre-v2; switched now that
 * `app_role` no longer has an "organizer" value at all (confirmed by Agent 2 in
 * docs/contracts/requests.md), so the old name here was a live typecheck/runtime mismatch, not just
 * stale prose.
 */
export type ShellRole = "member" | "director" | "admin";

export type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: NavIconKey;
  /** Roles that see this item in the sidebar. */
  roles: ShellRole[];
  /** Also renders in the mobile bottom tab bar. Keep this to the small set of member surfaces. */
  mobileTab?: boolean;
};

const ALL_ROLES: ShellRole[] = ["member", "director", "admin"];

/**
 * Routes as confirmed by their owning agents in docs/contracts/requests.md: "Coverage" and
 * "Calendar" from Agent 3 (2026-08-16, overriding this file's original /admin/schedule and
 * /admin/event guesses), "Open Shifts" from Agent 4 (2026-08-16, same shape as the other three
 * member surfaces below). "Approval" added per Agent 3's 2026-08-19 request (the V2 approval
 * queue). "My Events" (member-facing /my-events, distinct from the director-only /events above
 * it) added per Agent 4's 2026-08-19 request: scoped to `member` only, not `ALL_ROLES` despite
 * being "a member surface" in the same shape as the others, specifically so a director/admin
 * never sees both an "Events" and a "My Events" entry in the same rail, per Agent 4's own
 * collision-avoidance reasoning. Reuses the "events" icon since the two routes never render
 * together for the same user.
 */
export const NAV_ITEMS: NavItem[] = [
  { key: "coverage", label: "Coverage", href: "/coverage", icon: "coverage", roles: ["director", "admin"] },
  { key: "my-schedule", label: "My Schedule", href: "/my-schedule", icon: "my-schedule", roles: ALL_ROLES, mobileTab: true },
  { key: "availability", label: "Availability", href: "/availability", icon: "availability", roles: ALL_ROLES, mobileTab: true },
  { key: "shifts", label: "Open Shifts", href: "/shifts", icon: "shifts", roles: ALL_ROLES, mobileTab: true },
  { key: "events", label: "Events", href: "/events", icon: "events", roles: ["director", "admin"] },
  { key: "my-events", label: "My Events", href: "/my-events", icon: "events", roles: ["member"] },
  { key: "calendar", label: "Calendar", href: "/calendar", icon: "calendar", roles: ["director", "admin"] },
  { key: "approval", label: "Approval", href: "/approval", icon: "approval", roles: ["director", "admin"] },
  { key: "swaps", label: "Swaps", href: "/swaps", icon: "swaps", roles: ALL_ROLES, mobileTab: true },
  { key: "settings", label: "Settings", href: "/settings", icon: "settings", roles: ALL_ROLES },
];

export function navItemsForRole(role: ShellRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function mobileTabItemsForRole(role: ShellRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.mobileTab && item.roles.includes(role));
}
