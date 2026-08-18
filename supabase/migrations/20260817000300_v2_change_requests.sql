-- V2 change requests, replacing swap_requests outright (not additive -- confirmed the table's only
-- consumers are src/lib/swaps/*, src/lib/db/swaps.ts, src/lib/db/realtime.ts, all Agent 2/4
-- territory, no cross-agent breakage from a clean replacement, unlike shift_assignments.status).
--
-- Behavior change from swap_requests worth flagging loudly: a peer claiming a swap_any/swap_with
-- request was previously a terminal, instant success (claim_swap transferred the assignment on the
-- spot). In V2 a claim is just a claim -- the actual transfer waits for
-- resolve_change_request(), matching the shared brief's "Director-of-event approval" for every kind,
-- not just organizer-initiated swaps.

drop function if exists public.claim_swap(uuid);
drop table if exists public.swap_requests;
drop type if exists public.swap_request_status;
drop type if exists public.swap_request_kind;

create type public.change_request_kind as enum ('swap_any', 'swap_with', 'drop', 'cant_make_time', 'more_hours');
create type public.change_request_state as enum ('open', 'claimed', 'approved', 'declined', 'cancelled');

create table public.change_requests (
  id uuid primary key default extensions.uuid_generate_v4(),
  -- Required for every kind: even a bare "more_hours" ask is scoped to one event (Agent 4's brief:
  -- "lives on the event page too"). Populated by the requester directly for more_hours; derived from
  -- the assignment's shift for every other kind (validated by the trigger below, not left to the client).
  event_id uuid not null references public.events (id) on delete cascade,
  -- Null only for kind = 'more_hours', which is not about one specific assignment.
  assignment_id uuid references public.shift_assignments (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  kind public.change_request_kind not null,
  -- Only meaningful for swap_with (a specific requested partner); null for every other kind.
  target_user_id uuid references public.profiles (id) on delete set null,
  claimed_by uuid references public.profiles (id) on delete set null,
  state public.change_request_state not null default 'open',
  note text,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint change_requests_note_length check (note is null or length(note) <= 500),
  constraint change_requests_more_hours_has_no_assignment check (
    (kind = 'more_hours' and assignment_id is null)
    or (kind <> 'more_hours' and assignment_id is not null)
  ),
  constraint change_requests_swap_with_has_target check (
    kind <> 'swap_with' or target_user_id is not null
  ),
  constraint change_requests_claimed_needs_claimant check (
    (state = 'claimed' and claimed_by is not null) or (state <> 'claimed')
  ),
  constraint change_requests_resolved_needs_resolver check (
    (state in ('approved', 'declined') and resolved_by is not null and resolved_at is not null)
    or (state not in ('approved', 'declined'))
  )
);

create index change_requests_event_idx on public.change_requests (event_id);
create index change_requests_assignment_idx on public.change_requests (assignment_id);
create index change_requests_state_idx on public.change_requests (state);
create index change_requests_requested_by_idx on public.change_requests (requested_by);
create index change_requests_claimed_by_idx on public.change_requests (claimed_by);

-- One open request per assignment at a time, same posture as swap_requests before it. Deliberately
-- not applied to more_hours (assignment_id null, a member may reasonably have multiple open
-- more_hours asks across different events at once).
create unique index change_requests_one_open_per_assignment
on public.change_requests (assignment_id)
where state = 'open' and assignment_id is not null;

create trigger set_change_requests_updated_at
before update on public.change_requests
for each row execute function public.set_updated_at();

-- Validates on insert: assignment (when present) belongs to the requester and is in a changeable
-- state, and fills event_id from the assignment's shift so the client never has to compute it
-- (for more_hours, the client-supplied event_id is trusted as-is, checked only for existence via the
-- FK). No assignment-state side effect on open, unlike the old swap_pending flip -- V2 keeps
-- "this shift has an open change request" a join, not a stored assignment state, since a request
-- being open doesn't itself mean the assignment is unsettled the way a v1 swap did.
create or replace function app_private.validate_and_link_change_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment public.shift_assignments;
  v_event_id uuid;
begin
  if new.kind = 'more_hours' then
    return new;
  end if;

  select * into v_assignment from public.shift_assignments where id = new.assignment_id for update;
  if v_assignment is null then
    raise exception 'assignment % does not exist', new.assignment_id;
  end if;

  if v_assignment.profile_id <> new.requested_by then
    raise exception 'you can only request a change for your own assignment';
  end if;

  if v_assignment.state not in ('in_approval', 'approved') then
    raise exception 'this assignment cannot be changed right now';
  end if;

  select event_id into v_event_id from public.shifts where id = v_assignment.shift_id;
  new.event_id := v_event_id;

  return new;
end;
$$;

create trigger validate_and_link_change_request
before insert on public.change_requests
for each row execute function app_private.validate_and_link_change_request();

alter table public.change_requests enable row level security;

-- Same "open marketplace" posture 20260816131800 gave swap_requests: any authenticated member can see
-- an open swap_any/swap_with request (so there's something to claim), plus their own rows in any
-- state, plus every row a director/admin has authority over.
create policy "change_requests_select_open_own_or_authority"
on public.change_requests for select
to authenticated
using (
  (state = 'open' and kind in ('swap_any', 'swap_with'))
  or requested_by = (select auth.uid())
  or claimed_by = (select auth.uid())
  or target_user_id = (select auth.uid())
  or (select app_private.is_admin())
  or app_private.is_director_of_event(event_id)
);

create policy "change_requests_insert_own"
on public.change_requests for insert
to authenticated
with check (requested_by = (select auth.uid()));

-- Claiming (state open -> claimed, claimed_by = self) is the one update a non-authority member may
-- make; everything else (approve/decline/cancel-on-someone-else's-behalf) is admin or the director of
-- that request's event. The requester may still cancel their own still-open request.
create policy "change_requests_update_authority_claim_or_own_cancel"
on public.change_requests for update
to authenticated
using (
  (select app_private.is_admin())
  or app_private.is_director_of_event(event_id)
  or (state = 'open' and kind in ('swap_any', 'swap_with'))
  or (requested_by = (select auth.uid()) and state = 'open')
)
with check (
  (select app_private.is_admin())
  or app_private.is_director_of_event(event_id)
  or (state = 'claimed' and claimed_by = (select auth.uid()))
  or (requested_by = (select auth.uid()) and state in ('open', 'cancelled'))
);

create policy "change_requests_delete_admin"
on public.change_requests for delete
to authenticated
using ((select app_private.is_admin()));

-- claim_change_request: self-service claim for swap_any/swap_with, race-safe (row-locked). Does NOT
-- transfer the assignment -- see the file header. resolve_change_request() below does that, only once
-- a director or admin approves.
create or replace function public.claim_change_request(p_id uuid)
returns public.change_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_row public.change_requests;
begin
  if v_caller is null then
    raise exception 'authentication required';
  end if;

  if not exists (select 1 from public.profiles where id = v_caller and is_active = true) then
    raise exception 'inactive or missing profile';
  end if;

  select * into v_row from public.change_requests where id = p_id for update;
  if v_row is null then
    raise exception 'change request % does not exist', p_id;
  end if;

  if v_row.kind not in ('swap_any', 'swap_with') then
    raise exception 'this request type cannot be claimed';
  end if;

  if v_row.state <> 'open' then
    raise exception 'this request is no longer open';
  end if;

  if v_row.requested_by = v_caller then
    raise exception 'you cannot claim your own request';
  end if;

  if v_row.kind = 'swap_with' and v_row.target_user_id <> v_caller then
    raise exception 'this swap was requested with a specific person';
  end if;

  update public.change_requests
  set state = 'claimed', claimed_by = v_caller, updated_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.claim_change_request(uuid) from public;
grant execute on function public.claim_change_request(uuid) to authenticated;

-- resolve_change_request: admin, or the director of the request's event. p_decision is 'approve' or
-- 'decline'. p_claimed_by lets an admin/director resolve a swap directly without a prior claim (the
-- old swap model's "organizer resolves it directly, no claimant yet" path) -- when omitted, the row's
-- already-claimed_by is used. Approving a swap transfers the assignment to the new profile and resets
-- it to 'in_approval' (a swapped-in person re-enters the queue, same as any other proposal). Approving
-- a drop sets the assignment to 'not_assigned'. cant_make_time/more_hours have no assignment mutation
-- to make, resolving them is purely informational for the director/admin to act on manually.
create or replace function public.resolve_change_request(p_id uuid, p_decision text, p_claimed_by uuid default null)
returns public.change_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.change_requests;
  v_claimed_by uuid;
begin
  if p_decision not in ('approve', 'decline') then
    raise exception 'decision must be approve or decline';
  end if;

  select * into v_row from public.change_requests where id = p_id for update;
  if v_row is null then
    raise exception 'change request % does not exist', p_id;
  end if;

  if not (
    (select app_private.is_admin())
    or app_private.is_director_of_event(v_row.event_id)
  ) then
    raise exception 'admin or director of this event required';
  end if;

  if v_row.state not in ('open', 'claimed') then
    raise exception 'this request has already been resolved';
  end if;

  v_claimed_by := coalesce(p_claimed_by, v_row.claimed_by);

  if p_decision = 'approve' and v_row.kind in ('swap_any', 'swap_with') then
    if v_claimed_by is null then
      raise exception 'a claimed_by profile is required to approve a swap';
    end if;

    update public.shift_assignments
    set profile_id = v_claimed_by, state = 'in_approval', approved_by = null, approved_at = null,
        assigned_by = auth.uid(), proposed_by_ai = false, updated_at = now()
    where id = v_row.assignment_id;
  elsif p_decision = 'approve' and v_row.kind = 'drop' then
    update public.shift_assignments
    set state = 'not_assigned', approved_by = null, approved_at = null, updated_at = now()
    where id = v_row.assignment_id;
  end if;

  update public.change_requests
  set state = (case p_decision when 'approve' then 'approved' else 'declined' end)::public.change_request_state,
      claimed_by = coalesce(v_claimed_by, claimed_by),
      resolved_by = auth.uid(), resolved_at = now(), updated_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.resolve_change_request(uuid, text, uuid) from public;
grant execute on function public.resolve_change_request(uuid, text, uuid) to authenticated;
