-- V4: dark becomes the product default, light becomes opt-in. Agent 1 flipped the client side
-- (tokens.css's :root is now the dark palette, light is [data-theme="light"]; readStoredTheme and
-- THEME_INIT_SCRIPT both default to dark) and flagged this column as the remaining V3 leftover in
-- src/lib/theme/use-theme.ts. Until this lands, every signed-in member renders light server-side
-- because getProfileTheme() reads a stored 'light' and the root layout stamps it on <html>.
--
-- Two separate changes, both needed:
--
-- 1. The column default, which only affects profiles created from here on.
--
-- 2. A backfill of existing rows, which is the part that actually changes what current members see.
--    profiles.theme is `not null`, so when 20260819000100_v3_profiles_theme.sql added it every
--    existing row was written a literal 'light'. There is no "unset" state to distinguish "chose
--    light" from "was given the old default", so this cannot be surgical.
--
--    Overwriting a stored preference is normally the wrong move. It is the right one here: that
--    column was added earlier the same day, the toggle that writes it only became functional in the
--    same session, and this branch has never been released. Every 'light' row in this database is a
--    mechanical default, not a choice. A member who did pick light gets it back with one click, and
--    their next toggle writes a value this migration will never touch again.
--
--    Side effect worth knowing: this bumps updated_at on every profile row via the existing
--    set_profiles_updated_at trigger. Nothing reads profiles.updated_at for behavior, it is
--    bookkeeping only.

alter table public.profiles alter column theme set default 'dark';

update public.profiles set theme = 'dark' where theme = 'light';

comment on column public.profiles.theme is
  'Per-account UI theme for the V4 dual-theme design system. dark (default) or light. Written by src/lib/settings/theme-actions.ts, read server-side by src/lib/settings/theme.server.ts, which is what stamps data-theme on <html> in the root layout.';
