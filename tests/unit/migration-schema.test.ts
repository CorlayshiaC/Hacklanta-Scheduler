import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = [
  "20260815221959_initial_schema.sql",
  "20260815223043_harden_functions_and_indexes.sql",
  "20260815223209_rewrite_rls_policies.sql",
  "20260815232353_drop_events_36_hour_duration.sql",
  "20260815232830_create_hacklanta_ii_event_and_roles.sql",
  "20260816013000_make_availability_event_validation_security_definer.sql",
  "20260816023600_revoke_availability_validator_execute.sql",
]
  .map((fileName) => readFileSync(join(process.cwd(), "supabase/migrations", fileName), "utf8"))
  .join("\n");

describe("initial Supabase migration", () => {
  it.each([
    "profiles",
    "events",
    "coverage_roles",
    "member_coverage_roles",
    "member_settings",
    "availability_windows",
    "shift_roles",
    "shifts",
    "shift_role_requirements",
    "shift_assignments",
    "schedule_publications",
    "audit_log",
  ])("creates and enables RLS for %s", (tableName) => {
    expect(migrationSql).toContain(`create table public.${tableName}`);
    expect(migrationSql).toContain(`alter table public.${tableName} enable row level security`);
  });

  it("contains the core scheduling constraints", () => {
    expect(migrationSql).toContain("unique_active_shift_assignment");
    expect(migrationSql).toContain("validate_shift_within_event");
    expect(migrationSql).toContain("validate_availability_window_within_event");
    expect(migrationSql).toContain("required_people > 0");
  });

  it("keeps event ranges valid without hardcoding a 36-hour event duration", () => {
    expect(migrationSql).toContain("constraint events_valid_range check (starts_at < ends_at)");
    expect(migrationSql).toContain("drop constraint if exists events_36_hour_duration");
  });

  it("creates the HackLanta II draft event and exact coverage roles idempotently", () => {
    expect(migrationSql).toContain("'HackLanta II'");
    expect(migrationSql).toContain("'2026-10-09 07:00:00 America/New_York'::timestamptz");
    expect(migrationSql).toContain("'2026-10-11 15:00:00 America/New_York'::timestamptz");
    expect(migrationSql).toContain("'America/New_York'");
    expect(migrationSql).toContain("'draft'");
    expect(migrationSql).toContain("on conflict (event_id, name) do nothing");

    for (const roleName of [
      "Operations",
      "Finance",
      "Tech & Development",
      "Growth",
      "Outreach",
    ]) {
      expect(migrationSql).toContain(`'${roleName}'`);
    }
  });

  it("keeps admin authorization helpers outside the exposed public schema", () => {
    expect(migrationSql).toContain("create schema if not exists app_private");
    expect(migrationSql).toContain("create or replace function app_private.is_admin");
    expect(migrationSql).toContain("drop function if exists public.is_admin");
  });

  it("bootstraps new auth users as board members with the submitted full name", () => {
    expect(migrationSql).toContain("create or replace function app_private.handle_new_user()");
    expect(migrationSql).toContain("new.raw_user_meta_data ->> 'full_name'");
    expect(migrationSql).toContain("coalesce(new.email, '')");
    expect(migrationSql).toContain("'board_member'");
    expect(migrationSql).toContain("for each row execute function app_private.handle_new_user()");
  });

  it("lets the availability boundary trigger validate draft events without exposing event rows", () => {
    expect(migrationSql).toContain(
      "create or replace function public.validate_availability_window_within_event()",
    );
    expect(migrationSql).toContain("security definer");
    expect(migrationSql).toContain("set search_path = public, pg_temp");
    expect(migrationSql).toContain("from public.events");
    expect(migrationSql).toContain("raise exception 'availability window must fall within event window'");
  });

  it("revokes direct browser-role execution of the security-definer availability validator", () => {
    expect(migrationSql).toContain(
      "revoke execute on function public.validate_availability_window_within_event() from public",
    );
    expect(migrationSql).toContain(
      "revoke execute on function public.validate_availability_window_within_event() from anon",
    );
    expect(migrationSql).toContain(
      "revoke execute on function public.validate_availability_window_within_event() from authenticated",
    );
  });

  it("keeps member assignment reads scoped while assignment mutations stay admin-only", () => {
    expect(migrationSql).toContain('create policy "shift_assignments_select_own_published_or_admin"');
    expect(migrationSql).toContain("or profile_id = (select auth.uid())");
    expect(migrationSql).toContain('create policy "shift_assignments_admin_insert"');
    expect(migrationSql).toContain('create policy "shift_assignments_admin_update"');
    expect(migrationSql).toContain('create policy "shift_assignments_admin_delete"');
    expect(migrationSql).toContain("on public.shift_assignments for insert");
    expect(migrationSql).toContain("on public.shift_assignments for update");
    expect(migrationSql).toContain("on public.shift_assignments for delete");
    expect(migrationSql).toContain("with check ((select app_private.is_admin()))");
  });
});
