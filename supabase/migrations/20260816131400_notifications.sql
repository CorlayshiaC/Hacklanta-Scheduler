-- In-app notification rows, paired with the notify() dispatch function in src/lib/notifications/
-- (writes here + attempts email via the existing deliverEmailNotification seam). "kind" matches
-- src/lib/notifications/types.ts's scheduleNotificationEvents values exactly, same convention as
-- notification_preferences.kind, and is deliberately plain text for the same reason: new kinds
-- shouldn't need a migration.

create table public.notifications (
  id uuid primary key default extensions.uuid_generate_v4(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_profile_unread_idx
on public.notifications (profile_id, created_at desc)
where read_at is null;

create index notifications_profile_created_idx on public.notifications (profile_id, created_at desc);

alter table public.notifications enable row level security;

-- A member reads and marks read only their own notifications. Nobody gets insert/delete through RLS:
-- rows are written exclusively by notify() (src/lib/notifications/), which runs server-side using the
-- service role client (createSupabaseAdminClient), bypassing RLS by design, the same pattern
-- src/lib/member/schedule.ts already uses for cross-user reads.
create policy "notifications_select_own"
on public.notifications for select
to authenticated
using (profile_id = (select auth.uid()));

create policy "notifications_update_own_read_state"
on public.notifications for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

-- Only read_at is meant to change client-side (mark as read / unread); RLS is row-level, so the column
-- restriction (a member can't rewrite their own kind/payload after the fact) is enforced here, same
-- pattern as prevent_self_role_escalation on profiles.
create or replace function app_private.prevent_notification_content_edit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.profile_id is distinct from old.profile_id
    or new.kind is distinct from old.kind
    or new.payload is distinct from old.payload
    or new.created_at is distinct from old.created_at then
    raise exception 'only read_at can be changed on an existing notification';
  end if;

  return new;
end;
$$;

revoke all on function app_private.prevent_notification_content_edit() from public;
revoke all on function app_private.prevent_notification_content_edit() from anon;
revoke all on function app_private.prevent_notification_content_edit() from authenticated;

create trigger prevent_notification_content_edit
before update on public.notifications
for each row execute function app_private.prevent_notification_content_edit();
