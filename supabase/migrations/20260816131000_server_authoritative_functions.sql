-- Server-authoritative functions (Agent 2's "Definition of done" list):
--
-- - claim_shift(): capacity-checked self-signup, rejects overlap with the caller's own active
--   assignments. Mirrors the two "blocked" cases in src/lib/scheduling/conflict-engine.ts exactly
--   (capacity, overlap). That module's other checks (availability, max hours, break) are warnings, not
--   blocks, in the client engine, and are intentionally not re-enforced here as hard rejections.
-- - claim_swap(): first eligible claimer wins, moves the assignment atomically.
-- - Two triggers keep swap_requests and shift_assignments in sync so client code only ever writes to
--   swap_requests (insert to open a request, update to cancel/approve/decline), never touching
--   shift_assignments directly during the swap lifecycle. Both the self-service claim_swap() path and
--   the organizer-mediated UPDATE ... SET status = 'approved' path end up calling the same transfer
--   logic, so there is exactly one place that moves an assignment between people.
--
-- Known accepted limitation: claim_shift() locks the target shift row, so capacity checks are race-safe
-- per shift. It does not lock the caller's profile, so if the same caller races two concurrent
-- claim_shift() calls against two different, mutually overlapping shifts, both could succeed. This is a
-- narrow, self-inflicted edge case; a full fix would need to serialize per-caller too, which is not
-- worth the extra locking for v1.

create or replace function app_private.execute_swap_transfer(
  p_assignment_id uuid,
  p_new_profile_id uuid,
  p_new_origin text
)
returns public.shift_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment public.shift_assignments;
  v_shift public.shifts;
  v_overlap_count integer;
begin
  select * into v_assignment from public.shift_assignments where id = p_assignment_id for update;
  if v_assignment is null then
    raise exception 'assignment % does not exist', p_assignment_id;
  end if;

  select * into v_shift from public.shifts where id = v_assignment.shift_id;

  select count(*) into v_overlap_count
  from public.shift_assignments sa
  join public.shifts s on s.id = sa.shift_id
  where sa.profile_id = p_new_profile_id
    and sa.id <> v_assignment.id
    and sa.status in ('draft', 'published', 'swap_pending')
    and s.starts_at < v_shift.ends_at
    and s.ends_at > v_shift.starts_at;

  if v_overlap_count > 0 then
    raise exception 'claimant already has an overlapping shift';
  end if;

  update public.shift_assignments
  set profile_id = p_new_profile_id,
      status = 'published',
      published_at = coalesce(published_at, now()),
      origin = p_new_origin,
      assigned_by = case when p_new_origin = 'assigned' then auth.uid() else null end,
      updated_at = now()
  where id = p_assignment_id
  returning * into v_assignment;

  return v_assignment;
end;
$$;

revoke all on function app_private.execute_swap_transfer(uuid, uuid, text) from public;
revoke all on function app_private.execute_swap_transfer(uuid, uuid, text) from anon;
revoke all on function app_private.execute_swap_transfer(uuid, uuid, text) from authenticated;

-- Self-service shift signup. Any active member can claim an open shift (event published, or standalone
-- with no event) as long as it has room and does not overlap one of their own active assignments.
create or replace function public.claim_shift(p_shift_id uuid)
returns public.shift_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_shift public.shifts;
  v_active_count integer;
  v_overlap_count integer;
  v_result public.shift_assignments;
begin
  if v_caller is null then
    raise exception 'authentication required';
  end if;

  if not exists (select 1 from public.profiles where id = v_caller and is_active = true) then
    raise exception 'inactive or missing profile';
  end if;

  select * into v_shift from public.shifts where id = p_shift_id for update;
  if v_shift is null then
    raise exception 'shift % does not exist', p_shift_id;
  end if;

  if v_shift.event_id is not null and not exists (
    select 1 from public.events where id = v_shift.event_id and status = 'published'
  ) then
    raise exception 'shift is not open for signup';
  end if;

  -- Checked before capacity so a caller re-claiming a shift they are already active on gets an
  -- accurate message even when the shift is also at capacity (which it always is, from their own seat).
  if exists (
    select 1 from public.shift_assignments
    where shift_id = p_shift_id and profile_id = v_caller
      and status in ('draft', 'published', 'swap_pending')
  ) then
    raise exception 'you are already assigned to this shift';
  end if;

  select count(*) into v_active_count
  from public.shift_assignments
  where shift_id = p_shift_id
    and status in ('draft', 'published', 'swap_pending');

  if v_active_count >= v_shift.required_people then
    raise exception 'shift is fully staffed';
  end if;

  select count(*) into v_overlap_count
  from public.shift_assignments sa
  join public.shifts s on s.id = sa.shift_id
  where sa.profile_id = v_caller
    and sa.status in ('draft', 'published', 'swap_pending')
    and s.id <> p_shift_id
    and s.starts_at < v_shift.ends_at
    and s.ends_at > v_shift.starts_at;

  if v_overlap_count > 0 then
    raise exception 'you already have an overlapping shift';
  end if;

  -- A 'removed' row does not match unique_active_shift_assignment's partial predicate, so it cannot
  -- be the arbiter for an ON CONFLICT below; a plain insert would create a second row for the same
  -- (shift_id, profile_id) instead of reviving it. Check for one explicitly and revive it in place.
  select * into v_result
  from public.shift_assignments
  where shift_id = p_shift_id and profile_id = v_caller and status = 'removed'
  for update;

  if v_result is not null then
    update public.shift_assignments
    set status = 'published',
        published_at = coalesce(published_at, now()),
        origin = 'signup',
        assigned_by = null,
        updated_at = now()
    where id = v_result.id
    returning * into v_result;

    return v_result;
  end if;

  insert into public.shift_assignments (shift_id, profile_id, status, origin, assigned_by, published_at)
  values (p_shift_id, v_caller, 'published', 'signup', null, now())
  on conflict (shift_id, profile_id) where status in ('draft', 'published', 'swap_pending')
  do nothing
  returning * into v_result;

  if v_result is null then
    raise exception 'you are already assigned to this shift';
  end if;

  return v_result;
end;
$$;

revoke all on function public.claim_shift(uuid) from public;
grant execute on function public.claim_shift(uuid) to authenticated;

-- First eligible claimer wins. Transfers the assignment atomically; the swap request lands in
-- 'claimed', the terminal success state for a peer-claimed swap. Organizer-mediated resolution
-- ('approved', set via a normal UPDATE) is handled by sync_assignment_on_swap_resolution below, which
-- calls the same app_private.execute_swap_transfer() helper.
create or replace function public.claim_swap(p_swap_id uuid)
returns public.swap_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_swap public.swap_requests;
begin
  if v_caller is null then
    raise exception 'authentication required';
  end if;

  if not exists (select 1 from public.profiles where id = v_caller and is_active = true) then
    raise exception 'inactive or missing profile';
  end if;

  select * into v_swap from public.swap_requests where id = p_swap_id for update;
  if v_swap is null then
    raise exception 'swap request % does not exist', p_swap_id;
  end if;

  if v_swap.status <> 'open' then
    raise exception 'swap request is no longer open';
  end if;

  if v_swap.requested_by = v_caller then
    raise exception 'you cannot claim your own swap request';
  end if;

  perform app_private.execute_swap_transfer(
    v_swap.shift_assignment_id,
    v_caller,
    case when v_swap.kind = 'drop' then 'signup' else 'assigned' end
  );

  update public.swap_requests
  set status = 'claimed',
      claimed_by = v_caller,
      updated_at = now()
  where id = p_swap_id
  returning * into v_swap;

  return v_swap;
end;
$$;

revoke all on function public.claim_swap(uuid) from public;
grant execute on function public.claim_swap(uuid) to authenticated;

-- Validates a new swap request against its assignment and flips the assignment to swap_pending
-- atomically, so a member only ever has to insert into swap_requests to start the flow.
create or replace function app_private.validate_and_link_swap_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment public.shift_assignments;
begin
  select * into v_assignment
  from public.shift_assignments
  where id = new.shift_assignment_id
  for update;

  if v_assignment is null then
    raise exception 'assignment % does not exist', new.shift_assignment_id;
  end if;

  if v_assignment.profile_id <> new.requested_by then
    raise exception 'you can only request a swap for your own assignment';
  end if;

  if v_assignment.status not in ('draft', 'published') then
    raise exception 'this assignment cannot be swapped right now';
  end if;

  update public.shift_assignments
  set status = 'swap_pending', updated_at = now()
  where id = new.shift_assignment_id;

  return new;
end;
$$;

revoke all on function app_private.validate_and_link_swap_request() from public;
revoke all on function app_private.validate_and_link_swap_request() from anon;
revoke all on function app_private.validate_and_link_swap_request() from authenticated;

create trigger validate_and_link_swap_request
before insert on public.swap_requests
for each row execute function app_private.validate_and_link_swap_request();

-- Organizer-mediated path: a plain UPDATE to swap_requests (declined/cancelled reverts the assignment to
-- published; approved executes the transfer to whoever the organizer set as claimed_by).
create or replace function app_private.sync_assignment_on_swap_resolution()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if new.status in ('declined', 'cancelled') then
    update public.shift_assignments
    set status = 'published',
        published_at = coalesce(published_at, now()),
        updated_at = now()
    where id = new.shift_assignment_id
      and status = 'swap_pending';
  elsif new.status = 'approved' then
    if new.claimed_by is null then
      raise exception 'an approved swap request must have a claimant';
    end if;

    perform app_private.execute_swap_transfer(
      new.shift_assignment_id,
      new.claimed_by,
      case when new.kind = 'drop' then 'signup' else 'assigned' end
    );
  end if;

  return new;
end;
$$;

revoke all on function app_private.sync_assignment_on_swap_resolution() from public;
revoke all on function app_private.sync_assignment_on_swap_resolution() from anon;
revoke all on function app_private.sync_assignment_on_swap_resolution() from authenticated;

create trigger sync_assignment_on_swap_resolution
after update on public.swap_requests
for each row execute function app_private.sync_assignment_on_swap_resolution();
