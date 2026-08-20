-- Agent 5 request #1 (docs/contracts/schema-requests.md): backs public schedule pages (/s/[token]) and
-- OG images (/api/og/[token]). No direct anon select on share_tokens, shifts, shift_assignments, or
-- profiles for the public flow: everything goes through get_public_schedule() below, which is
-- pre-shaped to the public contract in docs/contracts/public.md section 2 (no email, no profile id, no
-- role, assignee names already reduced per org_settings.public_name_display, only published assignments).

create table public.share_tokens (
  id uuid primary key default extensions.uuid_generate_v4(),
  event_id uuid not null references public.events (id) on delete cascade,
  token text not null unique,
  label text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index share_tokens_event_idx on public.share_tokens (event_id);
create unique index share_tokens_token_idx on public.share_tokens (token) where revoked_at is null;

alter table public.share_tokens enable row level security;

-- Organizers/admins manage tokens; no anon/member access, the public flow uses get_public_schedule().
create policy "share_tokens_organizer_select"
on public.share_tokens for select
to authenticated
using ((select app_private.is_organizer_or_admin()));

create policy "share_tokens_organizer_insert"
on public.share_tokens for insert
to authenticated
with check ((select app_private.is_organizer_or_admin()));

create policy "share_tokens_organizer_update"
on public.share_tokens for update
to authenticated
using ((select app_private.is_organizer_or_admin()))
with check ((select app_private.is_organizer_or_admin()));

create or replace function app_private.first_name(p_full_name text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select nullif(split_part(trim(p_full_name), ' ', 1), '');
$$;

create or replace function app_private.name_initials(p_full_name text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select nullif(string_agg(upper(left(part, 1)), ''), '')
  from unnest(regexp_split_to_array(trim(p_full_name), '\s+')) as part
  where part <> '';
$$;

-- Returns null for a missing or revoked token; callers 404 on null. Never returns email, profile id,
-- role, or availability data. Only status = 'published' assignments are counted or listed, matching
-- docs/contracts/public.md section 2 exactly.
create or replace function public.get_public_schedule(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.events;
  v_display text;
  v_result jsonb;
begin
  select events.* into v_event
  from public.share_tokens
  join public.events on events.id = share_tokens.event_id
  where share_tokens.token = p_token
    and share_tokens.revoked_at is null;

  if v_event is null then
    return null;
  end if;

  select public_name_display into v_display from public.org_settings where id = true;
  v_display := coalesce(v_display, 'first_name');

  select jsonb_build_object(
    'event', jsonb_build_object(
      'name', v_event.name,
      'description', v_event.description,
      'location', v_event.location,
      'startsAt', v_event.starts_at,
      'endsAt', v_event.ends_at,
      'timezone', v_event.timezone
    ),
    'shifts', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', shift_data.id,
        'title', shift_data.title,
        'station', shift_data.shift_role_name,
        'startsAt', shift_data.starts_at,
        'endsAt', shift_data.ends_at,
        'location', shift_data.location,
        'headcountRequired', shift_data.required_people,
        'headcountFilled', shift_data.filled_count,
        'assignees', shift_data.assignees
      ) order by shift_data.starts_at
    ) filter (where shift_data.id is not null), '[]'::jsonb)
  )
  into v_result
  from (
    select
      s.id,
      s.title,
      sr.name as shift_role_name,
      s.starts_at,
      s.ends_at,
      s.location,
      s.required_people,
      count(sa.id) filter (where sa.status = 'published') as filled_count,
      coalesce(
        jsonb_agg(
          case
            when v_display = 'full_name' then p.full_name
            when v_display = 'initials' then app_private.name_initials(p.full_name)
            else app_private.first_name(p.full_name)
          end
        ) filter (where sa.status = 'published'),
        '[]'::jsonb
      ) as assignees
    from public.shifts s
    left join public.shift_roles sr on sr.id = s.shift_role_id
    left join public.shift_assignments sa on sa.shift_id = s.id and sa.status = 'published'
    left join public.profiles p on p.id = sa.profile_id
    where s.event_id = v_event.id
    group by s.id, sr.name
  ) as shift_data;

  return v_result;
end;
$$;

revoke all on function public.get_public_schedule(text) from public;
grant execute on function public.get_public_schedule(text) to anon, authenticated;
