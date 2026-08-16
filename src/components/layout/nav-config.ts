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
 * "Coverage" and "Events" point at existing /admin/schedule and the reserved /admin/event route
 * (see src/app/admin/event/.gitkeep) rather than new top-level paths, matching Agent 3's likely
 * generalization of the existing admin schedule workspace. "Availability" and "Swaps" are reserved
 * prefixes with no page yet (Agent 4). Confirm or override in docs/contracts/requests.md if Agent
 * 3/4 land on different routes.
 */
export const NAV_ITEMS: NavItem[] = [
  { key: "coverage", label: "Coverage", href: "/admin/schedule", roles: ["organizer", "admin"] },
  { key: "my-schedule", label: "My Schedule", href: "/my-schedule", roles: ALL_ROLES, mobileTab: true },
  { key: "availability", label: "Availability", href: "/availability", roles: ALL_ROLES, mobileTab: true },
  { key: "events", label: "Events", href: "/admin/event", roles: ["organizer", "admin"] },
  { key: "swaps", label: "Swaps", href: "/swaps", roles: ALL_ROLES, mobileTab: true },
  { key: "settings", label: "Settings", href: "/settings", roles: ALL_ROLES },
];

export function navItemsForRole(role: ShellRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function mobileTabItemsForRole(role: ShellRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.mobileTab && item.roles.includes(role));
}
