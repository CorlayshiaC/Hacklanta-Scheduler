-- Two things landing together because the second needs the first:
--
-- 1. Every existing write policy for the operational tables (events, coverage_roles,
--    member_coverage_roles, member_settings, shift_roles, shifts, shift_role_requirements,
--    shift_assignments, audit_log) is currently gated on is_admin() only. The shared-context vocabulary
--    says organizers "write events, shifts, assignments, swap approvals" -- today that role literally
--    cannot, regardless of the enum value existing. This was not filed as an explicit schema request by
--    name, but it blocks the "organizer" value from doing anything, so it is bundled here rather than
--    left as a silent gap. schedule_publications stays admin-only: publishing the schedule of record is
--    treated as an org-authority action, matching the original AGENTS.md admin capability list.
--
-- 2. Agent 3 request #4: swap and drop requests for shift assignments. Adopts Agent 3's proposed shape
--    (docs/contracts/schema-requests.md), adding "kind" (swap vs. drop) and "note", which the shared
--    vocabulary in docs/contracts/schema.md calls for and Agent 3's draft omitted.

create or replace function app_private.is_organizer_or_admin(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = user_id
      and role in ('organizer', 'admin')
      and is_active = true
  );
$$;

revoke all on function app_private.is_organizer_or_admin(uuid) from public;
grant execute on function app_private.is_organizer_or_admin(uuid) to authenticated;
grant execute on function app_private.is_organizer_or_admin(uuid) to service_role;

-- events
drop policy if exists "events_admin_insert" on public.events;
drop policy if exists "events_admin_update" on public.events;
drop policy if exists "events_admin_delete" on public.events;

create policy "events_organizer_insert"
on public.events for insert
to authenticated
with check ((select app_private.is_organizer_or_admin()));

create policy "events_organizer_update"
on public.events for update
to authenticated
using ((select app_private.is_organizer_or_admin()))
with check ((select app_private.is_organizer_or_admin()));

create policy "events_organizer_delete"
on public.events for delete
to authenticated
using ((select app_private.is_organizer_or_admin()));

-- coverage_roles
drop policy if exists "coverage_roles_admin_insert" on public.coverage_roles;
drop policy if exists "coverage_roles_admin_update" on public.coverage_roles;
drop policy if exists "coverage_roles_admin_delete" on public.coverage_roles;

create policy "coverage_roles_organizer_insert"
on public.coverage_roles for insert
to authenticated
with check ((select app_private.is_organizer_or_admin()));

create policy "coverage_roles_organizer_update"
on public.coverage_roles for update
to authenticated
using ((select app_private.is_organizer_or_admin()))
with check ((select app_private.is_organizer_or_admin()));

create policy "coverage_roles_organizer_delete"
on public.coverage_roles for delete
to authenticated
using ((select app_private.is_organizer_or_admin()));

-- member_coverage_roles
drop policy if exists "member_coverage_roles_admin_insert" on public.member_coverage_roles;
drop policy if exists "member_coverage_roles_admin_update" on public.member_coverage_roles;
drop policy if exists "member_coverage_roles_admin_delete" on public.member_coverage_roles;

create policy "member_coverage_roles_organizer_insert"
on public.member_coverage_roles for insert
to authenticated
with check ((select app_private.is_organizer_or_admin()));

create policy "member_coverage_roles_organizer_update"
on public.member_coverage_roles for update
to authenticated
using ((select app_private.is_organizer_or_admin()))
with check ((select app_private.is_organizer_or_admin()));

create policy "member_coverage_roles_organizer_delete"
on public.member_coverage_roles for delete
to authenticated
using ((select app_private.is_organizer_or_admin()));

-- member_settings
drop policy if exists "member_settings_admin_insert" on public.member_settings;
drop policy if exists "member_settings_admin_update" on public.member_settings;
drop policy if exists "member_settings_admin_delete" on public.member_settings;

create policy "member_settings_organizer_insert"
on public.member_settings for insert
to authenticated
with check ((select app_private.is_organizer_or_admin()));

create policy "member_settings_organizer_update"
on public.member_settings for update
to authenticated
using ((select app_private.is_organizer_or_admin()))
with check ((select app_private.is_organizer_or_admin()));

create policy "member_settings_organizer_delete"
on public.member_settings for delete
to authenticated
using ((select app_private.is_organizer_or_admin()));

-- shift_roles
drop policy if exists "shift_roles_admin_insert" on public.shift_roles;
drop policy if exists "shift_roles_admin_update" on public.shift_roles;
drop policy if exists "shift_roles_admin_delete" on public.shift_roles;

create policy "shift_roles_organizer_insert"
on public.shift_roles for insert
to authenticated
with check ((select app_private.is_organizer_or_admin()));

create policy "shift_roles_organizer_update"
on public.shift_roles for update
to authenticated
using ((select app_private.is_organizer_or_admin()))
with check ((select app_private.is_organizer_or_admin()));

create policy "shift_roles_organizer_delete"
on public.shift_roles for delete
to authenticated
using ((select app_private.is_organizer_or_admin()));

-- shifts
drop policy if exists "shifts_admin_insert" on public.shifts;
drop policy if exists "shifts_admin_update" on public.shifts;
drop policy if exists "shifts_admin_delete" on public.shifts;

create policy "shifts_organizer_insert"
on public.shifts for insert
to authenticated
with check ((select app_private.is_organizer_or_admin()));

create policy "shifts_organizer_update"
on public.shifts for update
to authenticated
using ((select app_private.is_organizer_or_admin()))
with check ((select app_private.is_organizer_or_admin()));

create policy "shifts_organizer_delete"
on public.shifts for delete
to authenticated
using ((select app_private.is_organizer_or_admin()));

-- shift_role_requirements
drop policy if exists "shift_role_requirements_admin_insert" on public.shift_role_requirements;
drop policy if exists "shift_role_requirements_admin_update" on public.shift_role_requirements;
drop policy if exists "shift_role_requirements_admin_delete" on public.shift_role_requirements;

create policy "shift_role_requirements_organizer_insert"
on public.shift_role_requirements for insert
to authenticated
with check ((select app_private.is_organizer_or_admin()));

create policy "shift_role_requirements_organizer_update"
on public.shift_role_requirements for update
to authenticated
using ((select app_private.is_organizer_or_admin()))
with check ((select app_private.is_organizer_or_admin()));

create policy "shift_role_requirements_organizer_delete"
on public.shift_role_requirements for delete
to authenticated
using ((select app_private.is_organizer_or_admin()));

-- shift_assignments
drop policy if exists "shift_assignments_admin_insert" on public.shift_assignments;
drop policy if exists "shift_assignments_admin_update" on public.shift_assignments;
drop policy if exists "shift_assignments_admin_delete" on public.shift_assignments;

create policy "shift_assignments_organizer_insert"
on public.shift_assignments for insert
to authenticated
with check ((select app_private.is_organizer_or_admin()));

create policy "shift_assignments_organizer_update"
on public.shift_assignments for update
to authenticated
using ((select app_private.is_organizer_or_admin()))
with check ((select app_private.is_organizer_or_admin()));

create policy "shift_assignments_organizer_delete"
on public.shift_assignments for delete
to authenticated
using ((select app_private.is_organizer_or_admin()));

-- audit_log: broaden insert only (organizers writing legitimate audit entries for their own actions);
-- reading the full trail stays admin-only.
drop policy if exists "audit_log_admin_insert" on public.audit_log;

create policy "audit_log_organizer_insert"
on public.audit_log for insert
to authenticated
with check ((select app_private.is_organizer_or_admin()));

-- swap_requests

create type public.swap_request_kind as enum ('swap', 'drop');
create type public.swap_request_status as enum ('open', 'claimed', 'approved', 'declined', 'cancelled');

create table public.swap_requests (
  id uuid primary key default extensions.uuid_generate_v4(),
  shift_assignment_id uuid not null references public.shift_assignments (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  kind public.swap_request_kind not null,
  claimed_by uuid references public.profiles (id) on delete set null,
  status public.swap_request_status not null default 'open',
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint swap_requests_note_length check (note is null or length(note) <= 500),
  constraint swap_requests_claimed_needs_claimant check (
    (status in ('claimed', 'approved') and claimed_by is not null)
    or (status not in ('claimed', 'approved'))
  ),
  constraint swap_requests_decided_needs_decider check (
    (status in ('approved', 'declined') and decided_by is not null and decided_at is not null)
    or (status not in ('approved', 'declined'))
  )
);

create index swap_requests_assignment_idx on public.swap_requests (shift_assignment_id);
create index swap_requests_status_idx on public.swap_requests (status);
create index swap_requests_requested_by_idx on public.swap_requests (requested_by);
create index swap_requests_claimed_by_idx on public.swap_requests (claimed_by);

-- One open swap/drop request per assignment at a time.
create unique index swap_requests_one_open_per_assignment
on public.swap_requests (shift_assignment_id)
where status = 'open';

create trigger set_swap_requests_updated_at
before update on public.swap_requests
for each row execute function public.set_updated_at();

-- swap_pending now blocks re-signup the same way draft/published do: an assignment mid-swap still
-- occupies the shift. Safe to reference here: the enum value committed in a prior migration.
drop index if exists public.unique_active_shift_assignment;
create unique index unique_active_shift_assignment
on public.shift_assignments (shift_id, profile_id)
where status in ('draft', 'published', 'swap_pending');

alter table public.swap_requests enable row level security;

create policy "swap_requests_select_own_or_organizer"
on public.swap_requests for select
to authenticated
using (
  requested_by = (select auth.uid())
  or claimed_by = (select auth.uid())
  or (select app_private.is_organizer_or_admin())
);

-- Members open a swap/drop request only for their own assignment. The
-- validate_and_link_swap_request trigger (20260816131000_server_authoritative_functions.sql) enforces
-- that the assignment actually belongs to the requester and is currently active, and flips it to
-- swap_pending atomically.
create policy "swap_requests_insert_own"
on public.swap_requests for insert
to authenticated
with check (requested_by = (select auth.uid()));

-- Organizers/admins can update any row (approve, decline, reassign); the original requester can cancel
-- their own still-open request. Setting status to 'approved' or 'declined' must include decided_by and
-- decided_at, enforced by swap_requests_decided_needs_decider above.
create policy "swap_requests_update_organizer_or_own_cancel"
on public.swap_requests for update
to authenticated
using (
  (select app_private.is_organizer_or_admin())
  or (requested_by = (select auth.uid()) and status = 'open')
)
with check (
  (select app_private.is_organizer_or_admin())
  or (requested_by = (select auth.uid()) and status in ('open', 'cancelled'))
);

create policy "swap_requests_delete_organizer"
on public.swap_requests for delete
to authenticated
using ((select app_private.is_organizer_or_admin()));
