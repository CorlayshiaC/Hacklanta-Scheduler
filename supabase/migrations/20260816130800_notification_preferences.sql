-- Agent 5 request #3 (docs/contracts/schema-requests.md): per-kind, per-channel notification opt-out.
-- "kind" is intentionally plain text, not an enum or FK: it should track the kind constants exported
-- from src/lib/notifications/types.ts (Agent 2 owned) without needing a migration every time a kind is
-- added there.

create table public.notification_preferences (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  channel text not null check (channel in ('email', 'in_app')),
  enabled boolean not null default true,
  primary key (profile_id, kind, channel)
);

alter table public.notification_preferences enable row level security;

create policy "notification_preferences_own_select"
on public.notification_preferences for select
to authenticated
using (profile_id = (select auth.uid()));

create policy "notification_preferences_own_insert"
on public.notification_preferences for insert
to authenticated
with check (profile_id = (select auth.uid()));

create policy "notification_preferences_own_update"
on public.notification_preferences for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "notification_preferences_own_delete"
on public.notification_preferences for delete
to authenticated
using (profile_id = (select auth.uid()));
