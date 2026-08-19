import { z } from "zod";

/**
 * The V3 dual-theme vocabulary, shared by Agent 1's toggle/hook, the server-side first-paint read
 * (theme.server.ts), and the write action (theme-actions.ts).
 *
 * Isomorphic on purpose: no "server-only" import and no Supabase import, so a client component
 * (the toggle) can import ProfileTheme and PROFILE_THEMES without pulling server code into the
 * browser bundle. The server pieces live in the two sibling files.
 *
 * These strings are the exact values profiles.theme stores; the column's check constraint
 * (20260819000100_v3_profiles_theme.sql) allows nothing else. If a third option is ever added
 * ('system' is the likely one), it changes here, in the constraint, and nowhere else.
 */
export const PROFILE_THEMES = ["light", "dark"] as const;

export type ProfileTheme = (typeof PROFILE_THEMES)[number];

/** Light is the product default, matching the V3 design system's default theme. */
export const DEFAULT_PROFILE_THEME: ProfileTheme = "light";

/** Validation boundary for the write action; also usable by any caller parsing a stored value. */
export const profileThemeSchema = z.enum(PROFILE_THEMES);

/**
 * Never throws. Anything unrecognized (a null column on a row written before this migration, a
 * hand-edited value, a stale client) resolves to the default rather than failing a page render:
 * a theme is a presentation preference, and no surface should 500 because it could not be read.
 */
export function parseProfileTheme(value: unknown): ProfileTheme {
  const parsed = profileThemeSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_PROFILE_THEME;
}
