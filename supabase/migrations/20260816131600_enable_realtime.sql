-- subscribeToShiftAssignments()/subscribeToSwapRequests() (src/lib/db/realtime.ts) use Supabase
-- Realtime's postgres_changes, which only fires for tables added to the supabase_realtime publication.
-- A fresh project's publication starts empty; confirmed empty on this local instance before this
-- migration, via `select * from pg_publication_tables where pubname = 'supabase_realtime'`. RLS still
-- applies to what a subscribed client actually receives, this only turns on change broadcasting.
alter publication supabase_realtime add table public.shift_assignments;
alter publication supabase_realtime add table public.swap_requests;
