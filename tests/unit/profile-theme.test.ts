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

describe("profile theme", () => {
  it("offers exactly the two V3 themes, light by default", () => {
    expect(PROFILE_THEMES).toEqual(["light", "dark"]);
    expect(DEFAULT_PROFILE_THEME).toBe("light");
  });

  it("accepts stored values and rejects anything else at the write boundary", () => {
    expect(profileThemeSchema.safeParse("dark").success).toBe(true);
    expect(profileThemeSchema.safeParse("light").success).toBe(true);
    expect(profileThemeSchema.safeParse("system").success).toBe(false);
    expect(profileThemeSchema.safeParse("").success).toBe(false);
  });

  it("never throws when reading a stored value, falling back to the default", () => {
    expect(parseProfileTheme("dark")).toBe("dark");
    // A row written before the migration, a hand-edited value, or a stale client must not be able
    // to break a page render over a presentation preference.
    expect(parseProfileTheme(null)).toBe("light");
    expect(parseProfileTheme(undefined)).toBe("light");
    expect(parseProfileTheme("midnight")).toBe("light");
    expect(parseProfileTheme(7)).toBe("light");
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
