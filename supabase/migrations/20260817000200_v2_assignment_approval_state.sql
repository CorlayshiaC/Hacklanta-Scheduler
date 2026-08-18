-- V2 approval flow. Additive, not a replacement: shift_assignments.status (assignment_status:
-- draft/published/removed/swap_pending) and the whole-schedule draft/publish review workflow it backs
-- (src/lib/admin/schedule/review.ts, Agent 3's territory) keep working exactly as before. The new
-- `state` column below is the V2 source of truth going forward; `status`/`origin` are deprecated, not
-- dropped, so this migration cannot strand Agent 3/4/5/6's in-flight code the way a same-commit column
-- removal would (same reasoning docs/contracts/schema.md already used for the board_member rename).
-- File a request when every consumer has migrated off status/origin and I'll drop them in their own
-- migration, same pattern.
--
-- Old-to-new mapping, applied to every existing row in this migration:
--   status = 'removed'                    -> state = 'not_assigned' (no longer an active assignment)
--   status in (draft, published, swap_pending) -> state = 'in_approval' (nothing is pre-approved under
--     the new model; the V2 cutover intentionally resets every existing assignment into the admin's
--     approval queue rather than guessing which old rows would count as already-vetted)
-- origin is untouched. shift_assignments.assigned_by (existing column, previously "which organizer
-- placed this member") is reused as the V2 "which admin/director proposed this" column rather than
-- adding a redundant one: its meaning was already exactly this, just under a role model where only
-- organizers/admins could write it. Null assigned_by continues to mean "no human proposer" (a member's
-- own self-signup, or, new in V2, an AI proposal -- disambiguated by the new proposed_by_ai flag).

create type public.assignment_state as enum ('not_assigned', 'in_approval', 'approved');

alter table public.shift_assignments
  add column state public.assignment_state not null default 'in_approval',
  add column approved_by uuid references public.profiles (id) on delete set null,
  add column approved_at timestamptz,
  add column proposed_by_ai boolean not null default false,
  add column warnings jsonb not null default '[]'::jsonb,
  add constraint shift_assignments_approved_timestamp check (
    (state = 'approved' and approved_by is not null and approved_at is not null)
    or (state <> 'approved')
  ),
  add constraint shift_assignments_not_both_proposers check (
    not (assigned_by is not null and proposed_by_ai)
  );

update public.shift_assignments
set state = case when status = 'removed' then 'not_assigned' else 'in_approval' end::public.assignment_state;

comment on column public.shift_assignments.state is
  'V2 approval state: not_assigned (soft-removed / no longer active), in_approval (proposed, awaiting '
  'admin sign-off), approved (admin confirmed, visible to the member as confirmed). Supersedes status, '
  'which is kept only for the pre-V2 whole-schedule draft/publish workflow.';
comment on column public.shift_assignments.assigned_by is
  'V2: reused as "which admin/director proposed this assignment" (null = self-signup or AI, see '
  'proposed_by_ai). Pre-V2 meaning ("which organizer placed this member") was already the same fact.';
comment on column public.shift_assignments.warnings is
  'Computed and stored at write time (overlap, heavy-hours, etc.), array of {kind, message}. V2 makes '
  'every hard limit a warning, never a block; this is what the approval queue renders without '
  'recomputing anything. Empty array, never null, when there is nothing to flag.';

create index shift_assignments_state_idx on public.shift_assignments (state);

-- approve_assignments: admin-only, batch. Notification dispatch (email/in-app/Discord) happens in the
-- calling TypeScript action after this returns, same division of labor as every other function in this
-- schema (Postgres functions here never call out to Resend/Discord directly).
create or replace function public.approve_assignments(p_ids uuid[])
returns setof public.shift_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not (select app_private.is_admin()) then
    raise exception 'admin role required';
  end if;

  return query
  update public.shift_assignments
  set state = 'approved', approved_by = auth.uid(), approved_at = now(), updated_at = now()
  where id = any (p_ids) and state = 'in_approval'
  returning *;
end;
$$;

revoke all on function public.approve_assignments(uuid[]) from public;
grant execute on function public.approve_assignments(uuid[]) to authenticated;

-- unassign_assignment: the other direction, admin or the director of the assignment's event. Also
-- plain SQL-writable via a normal update (RLS already allows it, see the director-scoped policies in
-- 20260817000100), this function exists only so "set state back to not_assigned" is one atomic call
-- with the same not-both-proposers/approved-timestamp bookkeeping instead of the caller having to
-- clear approved_by/approved_at by hand.
create or replace function public.unassign_assignment(p_id uuid)
returns public.shift_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.shift_assignments;
begin
  select * into v_row from public.shift_assignments where id = p_id for update;
  if v_row is null then
    raise exception 'assignment % does not exist', p_id;
  end if;

  if not (
    (select app_private.is_admin())
    or app_private.is_director_of_shift(v_row.shift_id)
  ) then
    raise exception 'admin or director of this shift''s event required';
  end if;

  update public.shift_assignments
  set state = 'not_assigned', approved_by = null, approved_at = null, updated_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.unassign_assignment(uuid) from public;
grant execute on function public.unassign_assignment(uuid) to authenticated;
