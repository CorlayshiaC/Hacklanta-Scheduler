-- V2 events content (announcements) and hours (scheduled hours only, approved assignments only, per
-- the shared brief). Also org_settings additions for the Discord webhook.

create table public.announcements (
  id uuid primary key default extensions.uuid_generate_v4(),
  event_id uuid not null references public.events (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  discord_posted_at timestamptz,
  constraint announcements_body_not_blank check (length(trim(body)) > 0)
);

create index announcements_event_idx on public.announcements (event_id, created_at desc);

alter table public.announcements enable row level security;

-- Readable by anyone authenticated: member event pages show the announcements feed for any event they
-- can already see (no separate "published" gate here -- an announcement posted to a draft event is an
-- edge case the UI layer, not RLS, should prevent by not exposing the composer before publish).
create policy "announcements_select_authenticated"
on public.announcements for select
to authenticated
using (true);

create policy "announcements_admin_or_director_insert"
on public.announcements for insert
to authenticated
with check (
  (select app_private.is_admin()) or app_private.is_director_of_event(event_id)
);

-- Update is for stamping discord_posted_at after the webhook fires (see notify()'s Discord channel);
-- body itself is not editable once posted (post a new announcement instead), enforced by the trigger
-- below, not by narrowing this policy, since the same authority should be able to do both.
create policy "announcements_admin_or_director_update"
on public.announcements for update
to authenticated
using ((select app_private.is_admin()) or app_private.is_director_of_event(event_id))
with check ((select app_private.is_admin()) or app_private.is_director_of_event(event_id));

create policy "announcements_admin_delete"
on public.announcements for delete
to authenticated
using ((select app_private.is_admin()));

create or replace function app_private.prevent_announcement_body_edit()
returns trigger
language plpgsql
as $$
begin
  if new.body <> old.body or new.event_id <> old.event_id or new.author_id is distinct from old.author_id then
    raise exception 'announcements are immutable once posted, except discord_posted_at';
  end if;
  return new;
end;
$$;

create trigger prevent_announcement_body_edit
before update on public.announcements
for each row execute function app_private.prevent_announcement_body_edit();

-- Hours: scheduled hours only, approved assignments only (state = 'approved'), computed from
-- shifts.starts_at/ends_at. security definer with an explicit authorization check (rather than
-- security invoker relying on shift_assignments' own RLS) so an admin/director can compute someone
-- else's hours too -- the approval queue's "heavy hours" warning needs exactly that, and re-deriving
-- the same admin-or-director-of-event check inline keeps this self-contained.

create or replace function public.hours_per_event(p_profile_id uuid, p_event_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_total numeric;
begin
  if not (
    p_profile_id = auth.uid()
    or (select app_private.is_admin())
    or app_private.is_director_of_event(p_event_id)
  ) then
    raise exception 'not authorized to read this profile''s hours';
  end if;

  select coalesce(sum(extract(epoch from (s.ends_at - s.starts_at)) / 3600), 0)
  into v_total
  from public.shift_assignments sa
  join public.shifts s on s.id = sa.shift_id
  where sa.profile_id = p_profile_id
    and sa.state = 'approved'
    and s.event_id = p_event_id;

  return v_total;
end;
$$;

revoke all on function public.hours_per_event(uuid, uuid) from public;
grant execute on function public.hours_per_event(uuid, uuid) to authenticated;

-- Semester total: every approved assignment whose shift falls within org_settings' semester window
-- (or all of them, if the org hasn't set semester dates yet). Standalone shifts (event_id null) count
-- too -- weekly office hours are scheduled hours same as anything else.
create or replace function public.hours_semester(p_profile_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_total numeric;
  v_starts date;
  v_ends date;
begin
  if not (p_profile_id = auth.uid() or (select app_private.is_admin())) then
    raise exception 'not authorized to read this profile''s hours';
  end if;

  select semester_starts_on, semester_ends_on into v_starts, v_ends from public.org_settings where id = true;

  select coalesce(sum(extract(epoch from (s.ends_at - s.starts_at)) / 3600), 0)
  into v_total
  from public.shift_assignments sa
  join public.shifts s on s.id = sa.shift_id
  where sa.profile_id = p_profile_id
    and sa.state = 'approved'
    and (v_starts is null or s.starts_at >= v_starts)
    and (v_ends is null or s.starts_at <= v_ends);

  return v_total;
end;
$$;

revoke all on function public.hours_semester(uuid) from public;
grant execute on function public.hours_semester(uuid) to authenticated;

-- Discord webhook config, admin-set. discord_notify_kinds is a plain jsonb array of
-- scheduleNotificationEvents string values (src/lib/notifications/types.ts), same "no enum/FK, matches
-- the TS source of truth" posture notification_preferences.kind already uses -- an empty array means
-- Discord posting is off for every kind even if webhook_url is set, matching "respect a per-kind org
-- toggle" from the shared brief.
alter table public.org_settings
  add column webhook_url text,
  add column discord_notify_kinds jsonb not null default '[]'::jsonb;
