create or replace function public.validate_availability_window_within_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  event_starts_at timestamptz;
  event_ends_at timestamptz;
begin
  select starts_at, ends_at
  into event_starts_at, event_ends_at
  from public.events
  where id = new.event_id;

  if event_starts_at is null then
    raise exception 'event % does not exist', new.event_id;
  end if;

  if new.starts_at < event_starts_at or new.ends_at > event_ends_at then
    raise exception 'availability window must fall within event window';
  end if;

  return new;
end;
$$;
