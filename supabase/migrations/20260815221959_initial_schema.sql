create extension if not exists "uuid-ossp" with schema extensions;

create type public.app_role as enum ('admin', 'board_member');
create type public.event_status as enum ('draft', 'published', 'archived');
create type public.availability_status as enum ('available', 'unavailable');
create type public.assignment_status as enum ('draft', 'published', 'removed');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null,
  role public.app_role not null default 'board_member',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_not_blank check (length(trim(email)) > 0)
);

create table public.events (
  id uuid primary key default extensions.uuid_generate_v4(),
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null,
  status public.event_status not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_name_not_blank check (length(trim(name)) > 0),
  constraint events_timezone_not_blank check (length(trim(timezone)) > 0),
  constraint events_valid_range check (starts_at < ends_at),
  constraint events_36_hour_duration check (ends_at = starts_at + interval '36 hours')
);

create table public.coverage_roles (
  id uuid primary key default extensions.uuid_generate_v4(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coverage_roles_name_not_blank check (length(trim(name)) > 0),
  constraint coverage_roles_unique_event_name unique (event_id, name)
);

create table public.member_coverage_roles (
  id uuid primary key default extensions.uuid_generate_v4(),
  event_id uuid not null references public.events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  coverage_role_id uuid not null references public.coverage_roles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint member_coverage_roles_unique unique (event_id, profile_id, coverage_role_id)
);

create table public.member_settings (
  id uuid primary key default extensions.uuid_generate_v4(),
  event_id uuid not null references public.events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  max_hours numeric(5, 2) not null,
  minimum_break_minutes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_settings_unique_event_profile unique (event_id, profile_id),
  constraint member_settings_max_hours_positive check (max_hours > 0),
  constraint member_settings_minimum_break_nonnegative check (minimum_break_minutes >= 0)
);

create table public.availability_windows (
  id uuid primary key default extensions.uuid_generate_v4(),
  event_id uuid not null references public.events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.availability_status not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_windows_valid_range check (starts_at < ends_at)
);

create table public.shift_roles (
  id uuid primary key default extensions.uuid_generate_v4(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shift_roles_name_not_blank check (length(trim(name)) > 0),
  constraint shift_roles_unique_event_name unique (event_id, name)
);

create table public.shifts (
  id uuid primary key default extensions.uuid_generate_v4(),
  event_id uuid not null references public.events (id) on delete cascade,
  shift_role_id uuid references public.shift_roles (id) on delete set null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  required_people integer not null default 0,
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shifts_title_not_blank check (length(trim(title)) > 0),
  constraint shifts_valid_range check (starts_at < ends_at),
  constraint shifts_required_people_nonnegative check (required_people >= 0)
);

create table public.shift_role_requirements (
  id uuid primary key default extensions.uuid_generate_v4(),
  shift_id uuid not null references public.shifts (id) on delete cascade,
  coverage_role_id uuid not null references public.coverage_roles (id) on delete restrict,
  required_people integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shift_role_requirements_unique unique (shift_id, coverage_role_id),
  constraint shift_role_requirements_required_people_positive check (required_people > 0)
);

create table public.shift_assignments (
  id uuid primary key default extensions.uuid_generate_v4(),
  shift_id uuid not null references public.shifts (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  coverage_role_id uuid references public.coverage_roles (id) on delete set null,
  assigned_by uuid references public.profiles (id) on delete set null,
  status public.assignment_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shift_assignments_published_timestamp check (
    (status = 'published' and published_at is not null)
    or (status <> 'published')
  )
);

create table public.schedule_publications (
  id uuid primary key default extensions.uuid_generate_v4(),
  event_id uuid not null references public.events (id) on delete cascade,
  published_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz not null default now(),
  notes text
);

create table public.audit_log (
  id uuid primary key default extensions.uuid_generate_v4(),
  actor_id uuid references public.profiles (id) on delete set null,
  event_id uuid references public.events (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_log_action_not_blank check (length(trim(action)) > 0),
  constraint audit_log_entity_type_not_blank check (length(trim(entity_type)) > 0)
);

create unique index unique_active_shift_assignment
  on public.shift_assignments (shift_id, profile_id)
  where status in ('draft', 'published');

create index events_status_idx on public.events (status);
create index coverage_roles_event_id_idx on public.coverage_roles (event_id);
create index member_coverage_roles_profile_id_idx on public.member_coverage_roles (profile_id);
create index member_settings_profile_id_idx on public.member_settings (profile_id);
create index availability_windows_event_profile_time_idx
  on public.availability_windows (event_id, profile_id, starts_at, ends_at);
create index availability_windows_time_idx on public.availability_windows (starts_at, ends_at);
create index shift_roles_event_id_idx on public.shift_roles (event_id);
create index shifts_event_time_idx on public.shifts (event_id, starts_at, ends_at);
create index shifts_time_idx on public.shifts (starts_at, ends_at);
create index shift_role_requirements_shift_id_idx on public.shift_role_requirements (shift_id);
create index shift_role_requirements_coverage_role_id_idx
  on public.shift_role_requirements (coverage_role_id);
create index shift_assignments_profile_status_idx
  on public.shift_assignments (profile_id, status);
create index shift_assignments_shift_status_idx on public.shift_assignments (shift_id, status);
create index shift_assignments_coverage_role_id_idx on public.shift_assignments (coverage_role_id);
create index shift_assignments_published_at_idx on public.shift_assignments (published_at);
create index schedule_publications_event_id_idx on public.schedule_publications (event_id);
create index audit_log_event_created_at_idx on public.audit_log (event_id, created_at);
create index audit_log_actor_created_at_idx on public.audit_log (actor_id, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_events_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create trigger set_coverage_roles_updated_at
before update on public.coverage_roles
for each row execute function public.set_updated_at();

create trigger set_member_settings_updated_at
before update on public.member_settings
for each row execute function public.set_updated_at();

create trigger set_availability_windows_updated_at
before update on public.availability_windows
for each row execute function public.set_updated_at();

create trigger set_shift_roles_updated_at
before update on public.shift_roles
for each row execute function public.set_updated_at();

create trigger set_shifts_updated_at
before update on public.shifts
for each row execute function public.set_updated_at();

create trigger set_shift_role_requirements_updated_at
before update on public.shift_role_requirements
for each row execute function public.set_updated_at();

create trigger set_shift_assignments_updated_at
before update on public.shift_assignments
for each row execute function public.set_updated_at();

create or replace function public.validate_availability_window_within_event()
returns trigger
language plpgsql
as $$
declare
  event_starts_at timestamptz;
  event_ends_at timestamptz;
begin
  select starts_at, ends_at
  into event_starts_at, event_ends_at
  from public.events
  where id = new.event_id;

  if event_starts_at is null then
    raise exception 'event % does not exist', new.event_id;
  end if;

  if new.starts_at < event_starts_at or new.ends_at > event_ends_at then
    raise exception 'availability window must fall within event window';
  end if;

  return new;
end;
$$;

create trigger validate_availability_window_within_event
before insert or update on public.availability_windows
for each row execute function public.validate_availability_window_within_event();

create or replace function public.validate_shift_within_event()
returns trigger
language plpgsql
as $$
declare
  event_starts_at timestamptz;
  event_ends_at timestamptz;
  role_event_id uuid;
begin
  select starts_at, ends_at
  into event_starts_at, event_ends_at
  from public.events
  where id = new.event_id;

  if event_starts_at is null then
    raise exception 'event % does not exist', new.event_id;
  end if;

  if new.starts_at < event_starts_at or new.ends_at > event_ends_at then
    raise exception 'shift must fall within event window';
  end if;

  if new.shift_role_id is not null then
    select event_id into role_event_id
    from public.shift_roles
    where id = new.shift_role_id;

    if role_event_id is distinct from new.event_id then
      raise exception 'shift role must belong to the same event as the shift';
    end if;
  end if;

  return new;
end;
$$;

create trigger validate_shift_within_event
before insert or update on public.shifts
for each row execute function public.validate_shift_within_event();

create or replace function public.validate_member_coverage_role_event()
returns trigger
language plpgsql
as $$
declare
  role_event_id uuid;
begin
  select event_id into role_event_id
  from public.coverage_roles
  where id = new.coverage_role_id;

  if role_event_id is distinct from new.event_id then
    raise exception 'member coverage role must belong to the same event';
  end if;

  return new;
end;
$$;

create trigger validate_member_coverage_role_event
before insert or update on public.member_coverage_roles
for each row execute function public.validate_member_coverage_role_event();

create or replace function public.validate_shift_role_requirement_event()
returns trigger
language plpgsql
as $$
declare
  shift_event_id uuid;
  role_event_id uuid;
begin
  select event_id into shift_event_id from public.shifts where id = new.shift_id;
  select event_id into role_event_id from public.coverage_roles where id = new.coverage_role_id;

  if shift_event_id is distinct from role_event_id then
    raise exception 'shift role requirement must use a coverage role from the same event';
  end if;

  return new;
end;
$$;

create trigger validate_shift_role_requirement_event
before insert or update on public.shift_role_requirements
for each row execute function public.validate_shift_role_requirement_event();

create or replace function public.validate_shift_assignment_event_and_role()
returns trigger
language plpgsql
as $$
declare
  shift_event_id uuid;
  role_event_id uuid;
  member_is_eligible boolean;
begin
  select event_id into shift_event_id from public.shifts where id = new.shift_id;

  if new.coverage_role_id is not null then
    select event_id into role_event_id from public.coverage_roles where id = new.coverage_role_id;

    if role_event_id is distinct from shift_event_id then
      raise exception 'assignment coverage role must belong to the same event as the shift';
    end if;

    select exists (
      select 1
      from public.member_coverage_roles
      where event_id = shift_event_id
        and profile_id = new.profile_id
        and coverage_role_id = new.coverage_role_id
    )
    into member_is_eligible;

    if not member_is_eligible then
      raise exception 'member is not eligible for assignment coverage role';
    end if;
  end if;

  return new;
end;
$$;

create trigger validate_shift_assignment_event_and_role
before insert or update on public.shift_assignments
for each row execute function public.validate_shift_assignment_event_and_role();

create or replace function public.is_admin(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = user_id
      and role = 'admin'
      and is_active = true
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_admin(uuid) to service_role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    'board_member'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.coverage_roles enable row level security;
alter table public.member_coverage_roles enable row level security;
alter table public.member_settings enable row level security;
alter table public.availability_windows enable row level security;
alter table public.shift_roles enable row level security;
alter table public.shifts enable row level security;
alter table public.shift_role_requirements enable row level security;
alter table public.shift_assignments enable row level security;
alter table public.schedule_publications enable row level security;
alter table public.audit_log enable row level security;

create policy "profiles_select_own_or_admin"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

create policy "profiles_admin_update"
on public.profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "events_select_published_or_admin"
on public.events for select
to authenticated
using (status = 'published' or public.is_admin());

create policy "events_admin_insert"
on public.events for insert
to authenticated
with check (public.is_admin());

create policy "events_admin_update"
on public.events for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "events_admin_delete"
on public.events for delete
to authenticated
using (public.is_admin());

create policy "coverage_roles_select_published_event_own_or_admin"
on public.coverage_roles for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.events
    where events.id = coverage_roles.event_id
      and events.status = 'published'
  )
  or exists (
    select 1 from public.member_coverage_roles
    where member_coverage_roles.coverage_role_id = coverage_roles.id
      and member_coverage_roles.profile_id = auth.uid()
  )
);

create policy "coverage_roles_admin_all"
on public.coverage_roles for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "member_coverage_roles_select_own_or_admin"
on public.member_coverage_roles for select
to authenticated
using (profile_id = auth.uid() or public.is_admin());

create policy "member_coverage_roles_admin_all"
on public.member_coverage_roles for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "member_settings_select_own_or_admin"
on public.member_settings for select
to authenticated
using (profile_id = auth.uid() or public.is_admin());

create policy "member_settings_admin_all"
on public.member_settings for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "availability_windows_select_own_or_admin"
on public.availability_windows for select
to authenticated
using (profile_id = auth.uid() or public.is_admin());

create policy "availability_windows_member_insert_own"
on public.availability_windows for insert
to authenticated
with check (profile_id = auth.uid());

create policy "availability_windows_member_update_own"
on public.availability_windows for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy "availability_windows_member_delete_own"
on public.availability_windows for delete
to authenticated
using (profile_id = auth.uid());

create policy "availability_windows_admin_all"
on public.availability_windows for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "shift_roles_select_published_event_or_admin"
on public.shift_roles for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.events
    where events.id = shift_roles.event_id
      and events.status = 'published'
  )
);

create policy "shift_roles_admin_all"
on public.shift_roles for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "shifts_select_published_event_or_admin"
on public.shifts for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.events
    where events.id = shifts.event_id
      and events.status = 'published'
  )
);

create policy "shifts_admin_all"
on public.shifts for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "shift_role_requirements_select_published_shift_or_admin"
on public.shift_role_requirements for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.shifts
    join public.events on events.id = shifts.event_id
    where shifts.id = shift_role_requirements.shift_id
      and events.status = 'published'
  )
);

create policy "shift_role_requirements_admin_all"
on public.shift_role_requirements for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "shift_assignments_select_own_published_or_admin"
on public.shift_assignments for select
to authenticated
using (
  public.is_admin()
  or profile_id = auth.uid()
  or (
    status = 'published'
    and exists (
      select 1
      from public.shifts
      join public.events on events.id = shifts.event_id
      where shifts.id = shift_assignments.shift_id
        and events.status = 'published'
    )
  )
);

create policy "shift_assignments_admin_all"
on public.shift_assignments for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "schedule_publications_select_published_event_or_admin"
on public.schedule_publications for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.events
    where events.id = schedule_publications.event_id
      and events.status = 'published'
  )
);

create policy "schedule_publications_admin_insert"
on public.schedule_publications for insert
to authenticated
with check (public.is_admin());

create policy "audit_log_admin_select"
on public.audit_log for select
to authenticated
using (public.is_admin());

create policy "audit_log_admin_insert"
on public.audit_log for insert
to authenticated
with check (public.is_admin());
