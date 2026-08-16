do $$
declare
  hacklanta_event_id uuid;
begin
  select id
  into hacklanta_event_id
  from public.events
  where name = 'HackLanta II'
  order by created_at
  limit 1;

  if hacklanta_event_id is null then
    insert into public.events (name, starts_at, ends_at, timezone, status)
    values (
      'HackLanta II',
      '2026-10-09 07:00:00 America/New_York'::timestamptz,
      '2026-10-11 15:00:00 America/New_York'::timestamptz,
      'America/New_York',
      'draft'
    )
    returning id into hacklanta_event_id;
  end if;

  insert into public.coverage_roles (event_id, name)
  values
    (hacklanta_event_id, 'Operations'),
    (hacklanta_event_id, 'Finance'),
    (hacklanta_event_id, 'Tech & Development'),
    (hacklanta_event_id, 'Growth'),
    (hacklanta_event_id, 'Outreach')
  on conflict (event_id, name) do nothing;
end;
$$;
