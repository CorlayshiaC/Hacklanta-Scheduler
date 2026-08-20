-- Web Push subscriptions, for Agent 5's PWA. One row per browser/device subscription (a user can have
-- several -- phone, laptop, etc.), keyed by the endpoint itself since that's what's actually unique
-- per subscription, not per user.

create table public.push_subscriptions (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now(),
  constraint push_subscriptions_keys_shape check (
    keys ? 'p256dh' and keys ? 'auth'
  )
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Own-row only, both directions: a member subscribes/unsubscribes their own device; sendPush (Agent
-- 2's reminder-kind helper) reads across every user via the service-role client, same as notify()
-- does for notifications/profiles, bypassing RLS by design rather than needing a broader read policy
-- here.
create policy "push_subscriptions_own_row"
on public.push_subscriptions for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- audit_log already has exactly the shape the V2 brief asks for (actor_id, action, entity_type,
-- entity_id, metadata jsonb, created_at, plus event_id which the brief didn't ask for but is useful
-- and already there) -- see 20260815221959_initial_schema.sql. Nothing to add. The "entity"/"meta"
-- names in the shared brief are this table's entity_type/metadata under their original names, kept as
-- Agent 1's original migration named them rather than renaming a table three other migrations already
-- write into.
