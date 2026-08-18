export type ShellRole = "member" | "organizer" | "admin";

export type NavItem = {
  key: string;
  label: string;
  href: string;
  /** Roles that see this item in the sidebar. */
  roles: ShellRole[];
  /** Also renders in the mobile bottom tab bar. Keep this to the small set of member surfaces. */
  mobileTab?: boolean;
};

const ALL_ROLES: ShellRole[] = ["member", "organizer", "admin"];

/**
 * Routes as confirmed by their owning agents in docs/contracts/requests.md: "Coverage" and
 * "Calendar" from Agent 3 (2026-08-16, overriding this file's original /admin/schedule and
 * /admin/event guesses), "Open Shifts" from Agent 4 (2026-08-16, same shape as the other three
 * member surfaces below).
 */
export const NAV_ITEMS: NavItem[] = [
  { key: "coverage", label: "Coverage", href: "/coverage", roles: ["organizer", "admin"] },
  { key: "my-schedule", label: "My Schedule", href: "/my-schedule", roles: ALL_ROLES, mobileTab: true },
  { key: "availability", label: "Availability", href: "/availability", roles: ALL_ROLES, mobileTab: true },
  { key: "shifts", label: "Open Shifts", href: "/shifts", roles: ALL_ROLES, mobileTab: true },
  { key: "events", label: "Events", href: "/events", roles: ["organizer", "admin"] },
  { key: "calendar", label: "Calendar", href: "/calendar", roles: ["organizer", "admin"] },
  { key: "swaps", label: "Swaps", href: "/swaps", roles: ALL_ROLES, mobileTab: true },
  { key: "settings", label: "Settings", href: "/settings", roles: ALL_ROLES },
];

export function navItemsForRole(role: ShellRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function mobileTabItemsForRole(role: ShellRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.mobileTab && item.roles.includes(role));
}
