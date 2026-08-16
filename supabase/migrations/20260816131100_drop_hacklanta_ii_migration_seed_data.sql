-- Agent 1 request #5 (docs/contracts/schema-requests.md): 20260815232830_create_hacklanta_ii_event_
-- and_roles.sql baked one org's live event data into a versioned schema migration (an anti-pattern) and
-- disagreed with supabase/seed.sql, which separately seeded a different "HackLanta 2026" event with
-- different coverage roles. Migrations are append-only, so this removes what that migration inserted
-- rather than editing it. supabase/seed.sql (rewritten in this same batch, progsu-relevant fixtures) is
-- now the single seeding mechanism. Cascades through the 5 coverage_roles rows that migration created;
-- nothing else ever referenced this specific event.
delete from public.events where name = 'HackLanta II';
