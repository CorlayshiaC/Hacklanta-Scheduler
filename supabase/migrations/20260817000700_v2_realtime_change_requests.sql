-- swap_requests' publication entry went away with the table itself (20260817000300); add its
-- replacement so src/lib/db/realtime.ts's change_requests subscription actually fires.
alter publication supabase_realtime add table public.change_requests;
