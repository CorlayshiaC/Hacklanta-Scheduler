-- Every RLS policy in this schema, pre-existing and new, depends on the calling role already having
-- the underlying table grant: a Postgres RLS policy restricts rows within what a GRANT already allows,
-- it never expands access beyond a missing grant. A hosted Supabase project provisions the standard
-- anon/authenticated/service_role grants automatically as part of platform provisioning, outside of any
-- migration file. A bare local CLI stack (supabase init + supabase start in a fresh directory that was
-- never linked to the hosted project) does not replicate that bootstrap.
--
-- Found this by testing claim_shift()/claim_swap() against a real local instance
-- (docs/contracts/schema.md's verification section): even a plain select on shift_assignments, a table
-- that predates this whole migration batch, returned "permission denied for table shift_assignments"
-- for the authenticated role, not an RLS-shaped rejection. RLS was never the problem; the grants
-- underneath it were never applied to this environment. Fixing here rather than in app code so every
-- environment (local dev, CI, a freshly linked project) behaves identically regardless of what the
-- platform does or doesn't bootstrap on its own. Matches standard Supabase project defaults exactly:
-- broad table/sequence DML granted to anon and authenticated, RLS remains the actual access boundary
-- (every existing policy in this schema already scopes itself "to authenticated" or checks
-- is_admin()/is_organizer_or_admin(); anon has no permissive policy on any table added by this batch,
-- so this grant alone does not expose anything new to anon).

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

-- So the next agent's migration doesn't have to remember to do this for a brand new table.
alter default privileges in schema public
grant select, insert, update, delete on tables to anon, authenticated, service_role;

alter default privileges in schema public
grant usage, select on sequences to anon, authenticated, service_role;
