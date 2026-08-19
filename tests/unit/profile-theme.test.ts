import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE_THEME,
  PROFILE_THEMES,
  parseProfileTheme,
  profileThemeSchema,
} from "@/lib/settings/theme";

const migrationSql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260819000100_v3_profiles_theme.sql"),
  "utf8",
);

const defaultDarkSql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260819010000_v4_profiles_theme_default_dark.sql"),
  "utf8",
);

describe("profile theme", () => {
  it("offers exactly the two themes, dark by default", () => {
    expect(PROFILE_THEMES).toEqual(["light", "dark"]);
    // V4: dark is the default. This is also what an anonymous visitor renders as, since the root
    // layout stamps data-theme from getProfileTheme(), which falls back to this constant.
    expect(DEFAULT_PROFILE_THEME).toBe("dark");
  });

  it("accepts stored values and rejects anything else at the write boundary", () => {
    expect(profileThemeSchema.safeParse("dark").success).toBe(true);
    expect(profileThemeSchema.safeParse("light").success).toBe(true);
    expect(profileThemeSchema.safeParse("system").success).toBe(false);
    expect(profileThemeSchema.safeParse("").success).toBe(false);
  });

  it("never throws when reading a stored value, falling back to the default", () => {
    expect(parseProfileTheme("light")).toBe("light");
    // A row written before the migration, a hand-edited value, or a stale client must not be able
    // to break a page render over a presentation preference.
    expect(parseProfileTheme(null)).toBe("dark");
    expect(parseProfileTheme(undefined)).toBe("dark");
    expect(parseProfileTheme("midnight")).toBe("dark");
    expect(parseProfileTheme(7)).toBe("dark");
  });

  it("flips the stored default to dark without widening write access", () => {
    expect(defaultDarkSql).toContain("alter column theme set default 'dark'");
    // The backfill is the part that changes what current members see: the column is `not null`, so
    // every existing row holds a literal 'light' written when the column was added.
    expect(defaultDarkSql).toContain("update public.profiles set theme = 'dark'");
    expect(defaultDarkSql).not.toContain("create policy");
    expect(defaultDarkSql).not.toContain("drop policy");
  });

  it("keeps light reachable, since it is opt-in and not removed", () => {
    expect(PROFILE_THEMES).toContain("light");
    expect(profileThemeSchema.safeParse("light").success).toBe(true);
    // The check constraint from the original migration still allows both values, so a member
    // opting into light writes successfully.
    expect(migrationSql).toContain("check (theme in ('light', 'dark'))");
  });

  it("matches the column the migration actually creates", () => {
    expect(migrationSql).toContain("add column theme text not null default 'light'");
    expect(migrationSql).toContain("check (theme in ('light', 'dark'))");
    // The self-update policy this column relies on came with the timezone migration; this one must
    // not quietly widen profile write access.
    expect(migrationSql).not.toContain("create policy");
    expect(migrationSql).not.toContain("drop policy");
  });
});
