-- V2 role model: admin | director | member. Two in-place enum renames (organizer -> director,
-- board_member -> member), both instant and safe (every existing row's stored value updates
-- automatically; Postgres has supported ALTER TYPE ... RENAME VALUE since PG10). The board_member
-- rename was deliberately deferred in 20260816130000 ("when you are ready... file a note") --
-- this V2 cutover, with every agent updating their own code in the same wave, is that moment.
--
-- Directors are no longer blanket-authorized across every event (app_private.is_organizer_or_admin
-- from 20260816130600 treated "organizer" as all-events). V2 scopes a director's write authority to
-- the events named in the new event_directors join table. is_organizer_or_admin() is dropped;
-- every policy that used it is rewritten below against the new per-event helpers.

alter type public.app_role rename value 'organizer' to 'director';
alter type public.app_role rename value 'board_member' to 'member';

-- event_directors: which directors are scoped to which events. Admin-managed only (directors do not
-- assign themselves or each other -- "admin ... assigns schedules" / admin picks directors on the
-- event settings panel per the shared V2 brief).
create table public.event_directors (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index event_directors_user_idx on public.event_directors (user_id);

alter table public.event_directors enable row level security;

create policy "event_directors_select_admin_or_self"
on public.event_directors for select
to authenticated
using (
  (select app_private.is_admin())
  or user_id = (select auth.uid())
);

create policy "event_directors_admin_write"
on public.event_directors for all
to authenticated
using ((select app_private.is_admin()))
with check ((select app_private.is_admin()));

-- Per-event authority helpers, replacing the blanket app_private.is_organizer_or_admin().
-- Deliberately NOT folding is_admin() into these: every call site below ORs the two explicitly, same
-- pattern the rest of this schema already uses (is_admin() alone gates admin-only writes elsewhere),
-- so a caller that only wants "director of this specific event, not admin" still has that available.

create or replace function app_private.is_director_of_event(p_event_id uuid, user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.event_directors ed
    join public.profiles p on p.id = ed.user_id
    where ed.event_id = p_event_id
      and ed.user_id = user_id
      and p.role = 'director'
      and p.is_active = true
  );
$$;

revoke all on function app_private.is_director_of_event(uuid, uuid) from public;
grant execute on function app_private.is_director_of_event(uuid, uuid) to authenticated;
grant execute on function app_private.is_director_of_event(uuid, uuid) to service_role;

-- A standalone shift (shifts.event_id is null) has no event to scope a director against, so this
-- returns false for one on purpose: standalone shifts are admin-only in V2, directors operate within
-- their assigned events only. Mirrors shift_role_requirements/shift_assignments via their shift_id.
create or replace function app_private.is_director_of_shift(p_shift_id uuid, user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.shifts s
    where s.id = p_shift_id
      and s.event_id is not null
      and app_private.is_director_of_event(s.event_id, user_id)
  );
$$;

revoke all on function app_private.is_director_of_shift(uuid, uuid) from public;
grant execute on function app_private.is_director_of_shift(uuid, uuid) to authenticated;
grant execute on function app_private.is_director_of_shift(uuid, uuid) to service_role;

-- Blanket (not event-scoped) "is this user a director at all" check, for the two tables below that
-- have no event_id to scope against (recurring_availability_windows is explicitly event-independent
-- per docs/contracts/schema.md; share_tokens/availability_windows do have event_id and use
-- is_director_of_event instead, kept separate rather than overloading this one).
create or replace function app_private.is_director(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = user_id and role = 'director' and is_active = true
  );
$$;

revoke all on function app_private.is_director(uuid) from public;
grant execute on function app_private.is_director(uuid) to authenticated;
grant execute on function app_private.is_director(uuid) to service_role;

-- events: creation stays admin-only in V2 ("admin ... creates events" per the shared brief, directors
-- do not). Update/delete admits a director of that specific event (e.g. editing description/location);
-- delete stays admin-only, deleting an event is not a director-level action.
drop policy if exists "events_organizer_insert" on public.events;
drop policy if exists "events_organizer_update" on public.events;
drop policy if exists "events_organizer_delete" on public.events;

create policy "events_admin_insert"
on public.events for insert
to authenticated
with check ((select app_private.is_admin()));

create policy "events_admin_or_director_update"
on public.events for update
to authenticated
using ((select app_private.is_admin()) or app_private.is_director_of_event(id))
with check ((select app_private.is_admin()) or app_private.is_director_of_event(id));

create policy "events_admin_delete"
on public.events for delete
to authenticated
using ((select app_private.is_admin()));

-- coverage_roles / shift_roles: event-scoped tables, straightforward event_id check.
drop policy if exists "coverage_roles_organizer_insert" on public.coverage_roles;
drop policy if exists "coverage_roles_organizer_update" on public.coverage_roles;
drop policy if exists "coverage_roles_organizer_delete" on public.coverage_roles;

create policy "coverage_roles_admin_or_director_insert"
on public.coverage_roles for insert
to authenticated
with check ((select app_private.is_admin()) or app_private.is_director_of_event(event_id));

create policy "coverage_roles_admin_or_director_update"
on public.coverage_roles for update
to authenticated
using ((select app_private.is_admin()) or app_private.is_director_of_event(event_id))
with check ((select app_private.is_admin()) or app_private.is_director_of_event(event_id));

create policy "coverage_roles_admin_or_director_delete"
on public.coverage_roles for delete
to authenticated
using ((select app_private.is_admin()) or app_private.is_director_of_event(event_id));

drop policy if exists "shift_roles_organizer_insert" on public.shift_roles;
drop policy if exists "shift_roles_organizer_update" on public.shift_roles;
drop policy if exists "shift_roles_organizer_delete" on public.shift_roles;

create policy "shift_roles_admin_or_director_insert"
on public.shift_roles for insert
to authenticated
with check ((select app_private.is_admin()) or app_private.is_director_of_event(event_id));

create policy "shift_roles_admin_or_director_update"
on public.shift_roles for update
to authenticated
using ((select app_private.is_admin()) or app_private.is_director_of_event(event_id))
with check ((select app_private.is_admin()) or app_private.is_director_of_event(event_id));

create policy "shift_roles_admin_or_director_delete"
on public.shift_roles for delete
to authenticated
using ((select app_private.is_admin()) or app_private.is_director_of_event(event_id));

-- member_coverage_roles / member_settings: per-member-per-event, same event_id check.
drop policy if exists "member_coverage_roles_organizer_insert" on public.member_coverage_roles;
drop policy if exists "member_coverage_roles_organizer_update" on public.member_coverage_roles;
drop policy if exists "member_coverage_roles_organizer_delete" on public.member_coverage_roles;

create policy "member_coverage_roles_admin_or_director_insert"
on public.member_coverage_roles for insert
to authenticated
with check ((select app_private.is_admin()) or app_private.is_director_of_event(event_id));

create policy "member_coverage_roles_admin_or_director_update"
on public.member_coverage_roles for update
to authenticated
using ((select app_private.is_admin()) or app_private.is_director_of_event(event_id))
with check ((select app_private.is_admin()) or app_private.is_director_of_event(event_id));

create policy "member_coverage_roles_admin_or_director_delete"
on public.member_coverage_roles for delete
to authenticated
using ((select app_private.is_admin()) or app_private.is_director_of_event(event_id));

drop policy if exists "member_settings_organizer_insert" on public.member_settings;
drop policy if exists "member_settings_organizer_update" on public.member_settings;
drop policy if exists "member_settings_organizer_delete" on public.member_settings;

create policy "member_settings_admin_or_director_insert"
on public.member_settings for insert
to authenticated
with check ((select app_private.is_admin()) or app_private.is_director_of_event(event_id));

create policy "member_settings_admin_or_director_update"
on public.member_settings for update
to authenticated
using ((select app_private.is_admin()) or app_private.is_director_of_event(event_id))
with check ((select app_private.is_admin()) or app_private.is_director_of_event(event_id));

create policy "member_settings_admin_or_director_delete"
on public.member_settings for delete
to authenticated
using ((select app_private.is_admin()) or app_private.is_director_of_event(event_id));

-- shifts: event-scoped via event_id directly, but event_id is nullable (standalone shifts). A
-- standalone shift has no director; is_director_of_event(null) reads as false via the join (no row
-- can match a null event_id), so this correctly falls through to admin-only for standalone shifts
-- without a separate branch.
drop policy if exists "shifts_organizer_insert" on public.shifts;
drop policy if exists "shifts_organizer_update" on public.shifts;
drop policy if exists "shifts_organizer_delete" on public.shifts;

create policy "shifts_admin_or_director_insert"
on public.shifts for insert
to authenticated
with check (
  (select app_private.is_admin())
  or (event_id is not null and app_private.is_director_of_event(event_id))
);

create policy "shifts_admin_or_director_update"
on public.shifts for update
to authenticated
using (
  (select app_private.is_admin())
  or (event_id is not null and app_private.is_director_of_event(event_id))
)
with check (
  (select app_private.is_admin())
  or (event_id is not null and app_private.is_director_of_event(event_id))
);

create policy "shifts_admin_or_director_delete"
on public.shifts for delete
to authenticated
using (
  (select app_private.is_admin())
  or (event_id is not null and app_private.is_director_of_event(event_id))
);

-- shift_role_requirements / shift_assignments: no event_id column, scoped via shift_id ->
-- is_director_of_shift (which itself falls through to false for a standalone shift).
drop policy if exists "shift_role_requirements_organizer_insert" on public.shift_role_requirements;
drop policy if exists "shift_role_requirements_organizer_update" on public.shift_role_requirements;
drop policy if exists "shift_role_requirements_organizer_delete" on public.shift_role_requirements;

create policy "shift_role_requirements_admin_or_director_insert"
on public.shift_role_requirements for insert
to authenticated
with check ((select app_private.is_admin()) or app_private.is_director_of_shift(shift_id));

create policy "shift_role_requirements_admin_or_director_update"
on public.shift_role_requirements for update
to authenticated
using ((select app_private.is_admin()) or app_private.is_director_of_shift(shift_id))
with check ((select app_private.is_admin()) or app_private.is_director_of_shift(shift_id));

create policy "shift_role_requirements_admin_or_director_delete"
on public.shift_role_requirements for delete
to authenticated
using ((select app_private.is_admin()) or app_private.is_director_of_shift(shift_id));

drop policy if exists "shift_assignments_organizer_insert" on public.shift_assignments;
drop policy if exists "shift_assignments_organizer_update" on public.shift_assignments;
drop policy if exists "shift_assignments_organizer_delete" on public.shift_assignments;

create policy "shift_assignments_admin_or_director_insert"
on public.shift_assignments for insert
to authenticated
with check ((select app_private.is_admin()) or app_private.is_director_of_shift(shift_id));

create policy "shift_assignments_admin_or_director_update"
on public.shift_assignments for update
to authenticated
using ((select app_private.is_admin()) or app_private.is_director_of_shift(shift_id))
with check ((select app_private.is_admin()) or app_private.is_director_of_shift(shift_id));

create policy "shift_assignments_admin_or_director_delete"
on public.shift_assignments for delete
to authenticated
using ((select app_private.is_admin()) or app_private.is_director_of_shift(shift_id));

-- audit_log: insert stays open to any director (logging their own actions, low sensitivity, matches
-- the pre-V2 organizer-insert posture); read stays admin-only, unchanged.
drop policy if exists "audit_log_organizer_insert" on public.audit_log;

create policy "audit_log_admin_or_director_insert"
on public.audit_log for insert
to authenticated
with check (
  (select app_private.is_admin())
  or (select app_private.is_director())
);

-- Remaining tables that referenced the now-blanket is_organizer_or_admin(), caught by actually running
-- this migration against local Postgres (it refuses to drop a function still depended on by other
-- policies): share_tokens (has event_id, scope properly), availability_windows (has event_id, scope
-- properly), recurring_availability_windows (no event_id, event-independent by design -- blanket
-- is_director() same as before, not a per-event narrowing).
drop policy if exists "share_tokens_organizer_select" on public.share_tokens;
drop policy if exists "share_tokens_organizer_insert" on public.share_tokens;
drop policy if exists "share_tokens_organizer_update" on public.share_tokens;

create policy "share_tokens_admin_or_director_select"
on public.share_tokens for select
to authenticated
using ((select app_private.is_admin()) or app_private.is_director_of_event(event_id));

create policy "share_tokens_admin_or_director_insert"
on public.share_tokens for insert
to authenticated
with check ((select app_private.is_admin()) or app_private.is_director_of_event(event_id));

create policy "share_tokens_admin_or_director_update"
on public.share_tokens for update
to authenticated
using ((select app_private.is_admin()) or app_private.is_director_of_event(event_id))
with check ((select app_private.is_admin()) or app_private.is_director_of_event(event_id));

drop policy if exists "availability_windows_select_own_or_organizer" on public.availability_windows;

create policy "availability_windows_select_own_or_director"
on public.availability_windows for select
to authenticated
using (
  profile_id = (select auth.uid())
  or (select app_private.is_admin())
  or app_private.is_director_of_event(event_id)
);

drop policy if exists "recurring_availability_select_own_or_organizer" on public.recurring_availability_windows;

create policy "recurring_availability_select_own_or_director"
on public.recurring_availability_windows for select
to authenticated
using (
  profile_id = (select auth.uid())
  or (select app_private.is_admin())
  or (select app_private.is_director())
);

-- swap_requests' two remaining organizer policies are moot: 20260817000300 drops that table outright
-- in this same migration batch, so they're dropped here only to clear the dependency, not recreated.
drop policy if exists "swap_requests_update_organizer_or_own_cancel" on public.swap_requests;
drop policy if exists "swap_requests_delete_organizer" on public.swap_requests;
drop policy if exists "swap_requests_select_open_own_or_organizer" on public.swap_requests;

drop function if exists app_private.is_organizer_or_admin(uuid);
