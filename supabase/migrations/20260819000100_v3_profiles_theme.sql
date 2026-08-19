-- V3 redesign: the app becomes dual-theme (light default "aurora glass", dark "midnight glass").
-- Agent 1's theme toggle needs a per-account store so the choice follows a member between devices,
-- and so the server can stamp data-theme during the first render instead of painting the wrong
-- theme and correcting it after hydration.
--
-- Deliberately per-account rather than the sidebar-collapsed cookie precedent
-- (docs/contracts/design.md "collapsible icon rail"): that one is explicitly per-device UI state,
-- while a theme choice is the kind of preference a member expects to find already applied when they
-- open the app on their phone.
--
-- text + check constraint rather than a Postgres enum: a third value later ('system', following the
-- OS setting, the obvious next request) is a one-line constraint swap inside an ordinary
-- transactional migration, whereas `alter type ... add value` cannot run inside a transaction block,
-- which is how these migrations are applied. The set is small, closed, and read by exactly one
-- feature, so an enum buys nothing here.
--
-- No RLS changes needed: 20260816130200_profiles_timezone_and_avatar.sql already opened own-row
-- updates (profiles_update_own_or_admin), and the prevent_self_role_escalation trigger keeps role
-- and is_active admin-only, so a member writing their own theme is covered by the existing policy
-- and cannot ride along with a privilege change.

alter table public.profiles
  add column theme text not null default 'light';

alter table public.profiles
  add constraint profiles_theme_valid check (theme in ('light', 'dark'));

comment on column public.profiles.theme is
  'Per-account UI theme for the V3 dual-theme design system. light (default) or dark. Written by src/lib/settings/theme-actions.ts, read server-side by src/lib/settings/theme.server.ts.';
