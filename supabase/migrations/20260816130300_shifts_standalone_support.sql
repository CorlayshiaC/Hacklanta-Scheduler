-- Agent 3 request #5 (docs/contracts/schema-requests.md), accepted now rather than deferred: it is a
-- small, additive change (nullable column, one trigger update, one policy update) that does not touch
-- anything Agent 3's in-flight code depends on, since every shift they create today still sets event_id.
--
-- Standalone shifts ("weekly office hours") have no event. A standalone shift cannot reference an
-- event-scoped shift_role (shift_roles always belongs to exactly one event); the
-- shifts_standalone_has_no_shift_role check constraint below rejects that combination on both insert
-- and update. The trigger simply skips its event-window checks entirely once event_id is null.

alter table public.shifts alter column event_id drop not null;

alter table public.shifts
add constraint shifts_standalone_has_no_shift_role
check (event_id is not null or shift_role_id is null);

create or replace function public.validate_shift_within_event()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  event_starts_at timestamptz;
  event_ends_at timestamptz;
  role_event_id uuid;
begin
  if new.event_id is null then
    return new;
  end if;

  select starts_at, ends_at
  into event_starts_at, event_ends_at
  from public.events
  where id = new.event_id;

  if event_starts_at is null then
    raise exception 'event % does not exist', new.event_id;
  end if;

  if new.starts_at < event_starts_at or new.ends_at > event_ends_at then
    raise exception 'shift must fall within event window';
  end if;

  if new.shift_role_id is not null then
    select event_id into role_event_id
    from public.shift_roles
    where id = new.shift_role_id;

    if role_event_id is distinct from new.event_id then
      raise exception 'shift role must belong to the same event as the shift';
    end if;
  end if;

  return new;
end;
$$;

drop policy if exists "shifts_select_published_event_or_admin" on public.shifts;

create policy "shifts_select_published_event_standalone_or_admin"
on public.shifts for select
to authenticated
using (
  (select app_private.is_admin())
  or shifts.event_id is null
  or exists (
    select 1 from public.events
    where events.id = shifts.event_id
      and events.status = 'published'
  )
);
