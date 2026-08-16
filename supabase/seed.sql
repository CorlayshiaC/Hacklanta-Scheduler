insert into public.events (id, name, starts_at, ends_at, timezone, status)
values (
  '00000000-0000-4000-8000-000000000001',
  'HackLanta 2026',
  '2026-10-16 09:00:00-04',
  '2026-10-17 21:00:00-04',
  'America/New_York',
  'draft'
)
on conflict (id) do nothing;

insert into public.coverage_roles (id, event_id, name, description)
values
  (
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000001',
    'Operations',
    'General event operations coverage.'
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000001',
    'Registration',
    'Check-in and registration desk coverage.'
  ),
  (
    '00000000-0000-4000-8000-000000000103',
    '00000000-0000-4000-8000-000000000001',
    'Logistics',
    'Venue, supplies, and food logistics coverage.'
  )
on conflict (event_id, name) do nothing;

insert into public.shift_roles (id, event_id, name, description)
values
  (
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000001',
    'Check-in',
    'Participant check-in and badge support.'
  ),
  (
    '00000000-0000-4000-8000-000000000202',
    '00000000-0000-4000-8000-000000000001',
    'General Coverage',
    'Flexible board coverage for event operations.'
  ),
  (
    '00000000-0000-4000-8000-000000000203',
    '00000000-0000-4000-8000-000000000001',
    'Meals',
    'Meal setup, line management, and cleanup.'
  )
on conflict (event_id, name) do nothing;
