create schema if not exists app_private;

revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;
grant usage on schema app_private to service_role;

alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.validate_availability_window_within_event() set search_path = public, pg_temp;
alter function public.validate_shift_within_event() set search_path = public, pg_temp;
alter function public.validate_member_coverage_role_event() set search_path = public, pg_temp;
alter function public.validate_shift_role_requirement_event() set search_path = public, pg_temp;
alter function public.validate_shift_assignment_event_and_role() set search_path = public, pg_temp;

create or replace function app_private.is_admin(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = user_id
      and role = 'admin'
      and is_active = true
  );
$$;

revoke all on function app_private.is_admin(uuid) from public;
grant execute on function app_private.is_admin(uuid) to authenticated;
grant execute on function app_private.is_admin(uuid) to service_role;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
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

revoke all on function app_private.handle_new_user() from public;
revoke all on function app_private.handle_new_user() from anon;
revoke all on function app_private.handle_new_user() from authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function app_private.handle_new_user();

create index availability_windows_profile_id_idx on public.availability_windows (profile_id);
create index events_created_by_idx on public.events (created_by);
create index member_coverage_roles_coverage_role_id_idx
  on public.member_coverage_roles (coverage_role_id);
create index schedule_publications_published_by_idx on public.schedule_publications (published_by);
create index shift_assignments_assigned_by_idx on public.shift_assignments (assigned_by);
create index shifts_shift_role_id_idx on public.shifts (shift_role_id);
