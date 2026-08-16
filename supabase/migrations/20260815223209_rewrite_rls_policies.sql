drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_admin_update" on public.profiles;
drop policy if exists "events_select_published_or_admin" on public.events;
drop policy if exists "events_admin_insert" on public.events;
drop policy if exists "events_admin_update" on public.events;
drop policy if exists "events_admin_delete" on public.events;
drop policy if exists "coverage_roles_select_published_event_own_or_admin" on public.coverage_roles;
drop policy if exists "coverage_roles_admin_all" on public.coverage_roles;
drop policy if exists "member_coverage_roles_select_own_or_admin" on public.member_coverage_roles;
drop policy if exists "member_coverage_roles_admin_all" on public.member_coverage_roles;
drop policy if exists "member_settings_select_own_or_admin" on public.member_settings;
drop policy if exists "member_settings_admin_all" on public.member_settings;
drop policy if exists "availability_windows_select_own_or_admin" on public.availability_windows;
drop policy if exists "availability_windows_member_insert_own" on public.availability_windows;
drop policy if exists "availability_windows_member_update_own" on public.availability_windows;
drop policy if exists "availability_windows_member_delete_own" on public.availability_windows;
drop policy if exists "availability_windows_admin_all" on public.availability_windows;
drop policy if exists "shift_roles_select_published_event_or_admin" on public.shift_roles;
drop policy if exists "shift_roles_admin_all" on public.shift_roles;
drop policy if exists "shifts_select_published_event_or_admin" on public.shifts;
drop policy if exists "shifts_admin_all" on public.shifts;
drop policy if exists "shift_role_requirements_select_published_shift_or_admin"
  on public.shift_role_requirements;
drop policy if exists "shift_role_requirements_admin_all" on public.shift_role_requirements;
drop policy if exists "shift_assignments_select_own_published_or_admin" on public.shift_assignments;
drop policy if exists "shift_assignments_admin_all" on public.shift_assignments;
drop policy if exists "schedule_publications_select_published_event_or_admin"
  on public.schedule_publications;
drop policy if exists "schedule_publications_admin_insert" on public.schedule_publications;
drop policy if exists "audit_log_admin_select" on public.audit_log;
drop policy if exists "audit_log_admin_insert" on public.audit_log;

drop function if exists public.is_admin(uuid);

create policy "profiles_select_own_or_admin"
on public.profiles for select
to authenticated
using (id = (select auth.uid()) or (select app_private.is_admin()));

create policy "profiles_admin_update"
on public.profiles for update
to authenticated
using ((select app_private.is_admin()))
with check ((select app_private.is_admin()));

create policy "events_select_published_or_admin"
on public.events for select
to authenticated
using (status = 'published' or (select app_private.is_admin()));

create policy "events_admin_insert"
on public.events for insert
to authenticated
with check ((select app_private.is_admin()));

create policy "events_admin_update"
on public.events for update
to authenticated
using ((select app_private.is_admin()))
with check ((select app_private.is_admin()));

create policy "events_admin_delete"
on public.events for delete
to authenticated
using ((select app_private.is_admin()));

create policy "coverage_roles_select_published_event_own_or_admin"
on public.coverage_roles for select
to authenticated
using (
  (select app_private.is_admin())
  or exists (
    select 1 from public.events
    where events.id = coverage_roles.event_id
      and events.status = 'published'
  )
  or exists (
    select 1 from public.member_coverage_roles
    where member_coverage_roles.coverage_role_id = coverage_roles.id
      and member_coverage_roles.profile_id = (select auth.uid())
  )
);

create policy "coverage_roles_admin_insert"
on public.coverage_roles for insert
to authenticated
with check ((select app_private.is_admin()));

create policy "coverage_roles_admin_update"
on public.coverage_roles for update
to authenticated
using ((select app_private.is_admin()))
with check ((select app_private.is_admin()));

create policy "coverage_roles_admin_delete"
on public.coverage_roles for delete
to authenticated
using ((select app_private.is_admin()));

create policy "member_coverage_roles_select_own_or_admin"
on public.member_coverage_roles for select
to authenticated
using (profile_id = (select auth.uid()) or (select app_private.is_admin()));

create policy "member_coverage_roles_admin_insert"
on public.member_coverage_roles for insert
to authenticated
with check ((select app_private.is_admin()));

create policy "member_coverage_roles_admin_update"
on public.member_coverage_roles for update
to authenticated
using ((select app_private.is_admin()))
with check ((select app_private.is_admin()));

create policy "member_coverage_roles_admin_delete"
on public.member_coverage_roles for delete
to authenticated
using ((select app_private.is_admin()));

create policy "member_settings_select_own_or_admin"
on public.member_settings for select
to authenticated
using (profile_id = (select auth.uid()) or (select app_private.is_admin()));

create policy "member_settings_admin_insert"
on public.member_settings for insert
to authenticated
with check ((select app_private.is_admin()));

create policy "member_settings_admin_update"
on public.member_settings for update
to authenticated
using ((select app_private.is_admin()))
with check ((select app_private.is_admin()));

create policy "member_settings_admin_delete"
on public.member_settings for delete
to authenticated
using ((select app_private.is_admin()));

create policy "availability_windows_select_own_or_admin"
on public.availability_windows for select
to authenticated
using (profile_id = (select auth.uid()) or (select app_private.is_admin()));

create policy "availability_windows_insert_own_or_admin"
on public.availability_windows for insert
to authenticated
with check (profile_id = (select auth.uid()) or (select app_private.is_admin()));

create policy "availability_windows_update_own_or_admin"
on public.availability_windows for update
to authenticated
using (profile_id = (select auth.uid()) or (select app_private.is_admin()))
with check (profile_id = (select auth.uid()) or (select app_private.is_admin()));

create policy "availability_windows_delete_own_or_admin"
on public.availability_windows for delete
to authenticated
using (profile_id = (select auth.uid()) or (select app_private.is_admin()));

create policy "shift_roles_select_published_event_or_admin"
on public.shift_roles for select
to authenticated
using (
  (select app_private.is_admin())
  or exists (
    select 1 from public.events
    where events.id = shift_roles.event_id
      and events.status = 'published'
  )
);

create policy "shift_roles_admin_insert"
on public.shift_roles for insert
to authenticated
with check ((select app_private.is_admin()));

create policy "shift_roles_admin_update"
on public.shift_roles for update
to authenticated
using ((select app_private.is_admin()))
with check ((select app_private.is_admin()));

create policy "shift_roles_admin_delete"
on public.shift_roles for delete
to authenticated
using ((select app_private.is_admin()));

create policy "shifts_select_published_event_or_admin"
on public.shifts for select
to authenticated
using (
  (select app_private.is_admin())
  or exists (
    select 1 from public.events
    where events.id = shifts.event_id
      and events.status = 'published'
  )
);

create policy "shifts_admin_insert"
on public.shifts for insert
to authenticated
with check ((select app_private.is_admin()));

create policy "shifts_admin_update"
on public.shifts for update
to authenticated
using ((select app_private.is_admin()))
with check ((select app_private.is_admin()));

create policy "shifts_admin_delete"
on public.shifts for delete
to authenticated
using ((select app_private.is_admin()));

create policy "shift_role_requirements_select_published_shift_or_admin"
on public.shift_role_requirements for select
to authenticated
using (
  (select app_private.is_admin())
  or exists (
    select 1
    from public.shifts
    join public.events on events.id = shifts.event_id
    where shifts.id = shift_role_requirements.shift_id
      and events.status = 'published'
  )
);

create policy "shift_role_requirements_admin_insert"
on public.shift_role_requirements for insert
to authenticated
with check ((select app_private.is_admin()));

create policy "shift_role_requirements_admin_update"
on public.shift_role_requirements for update
to authenticated
using ((select app_private.is_admin()))
with check ((select app_private.is_admin()));

create policy "shift_role_requirements_admin_delete"
on public.shift_role_requirements for delete
to authenticated
using ((select app_private.is_admin()));

create policy "shift_assignments_select_own_published_or_admin"
on public.shift_assignments for select
to authenticated
using (
  (select app_private.is_admin())
  or profile_id = (select auth.uid())
  or (
    status = 'published'
    and exists (
      select 1
      from public.shifts
      join public.events on events.id = shifts.event_id
      where shifts.id = shift_assignments.shift_id
        and events.status = 'published'
    )
  )
);

create policy "shift_assignments_admin_insert"
on public.shift_assignments for insert
to authenticated
with check ((select app_private.is_admin()));

create policy "shift_assignments_admin_update"
on public.shift_assignments for update
to authenticated
using ((select app_private.is_admin()))
with check ((select app_private.is_admin()));

create policy "shift_assignments_admin_delete"
on public.shift_assignments for delete
to authenticated
using ((select app_private.is_admin()));

create policy "schedule_publications_select_published_event_or_admin"
on public.schedule_publications for select
to authenticated
using (
  (select app_private.is_admin())
  or exists (
    select 1 from public.events
    where events.id = schedule_publications.event_id
      and events.status = 'published'
  )
);

create policy "schedule_publications_admin_insert"
on public.schedule_publications for insert
to authenticated
with check ((select app_private.is_admin()));

create policy "audit_log_admin_select"
on public.audit_log for select
to authenticated
using ((select app_private.is_admin()));

create policy "audit_log_admin_insert"
on public.audit_log for insert
to authenticated
with check ((select app_private.is_admin()));
