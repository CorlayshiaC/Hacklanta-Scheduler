-- Agent 3 request #2 (docs/contracts/schema-requests.md): the event detail slab needs description and
-- location fields. No RLS changes: existing event policies already gate by status/is_admin().
alter table public.events add column description text;
alter table public.events add column location text;
