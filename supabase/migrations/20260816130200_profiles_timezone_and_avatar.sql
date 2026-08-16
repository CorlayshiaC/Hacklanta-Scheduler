-- Agent 5 request #4 (docs/contracts/schema-requests.md): profile settings screen needs timezone and
-- avatar. This also exposes the first real gap in profile RLS: until now nothing let a member update
-- their own profile row at all (only "profiles_admin_update" existed). Adding self-service columns without
-- a self-service update policy would leave Agent 5's settings screen unable to save, so this migration
-- also opens self-update and layers a trigger to keep role/is_active admin-only (RLS is row-level, not
-- column-level, so the privilege boundary has to be enforced here).

alter table public.profiles add column timezone text not null default 'America/New_York';
alter table public.profiles add column avatar_url text;

create or replace function app_private.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (new.role is distinct from old.role or new.is_active is distinct from old.is_active)
    and not app_private.is_admin() then
    raise exception 'only an admin can change role or active status';
  end if;

  return new;
end;
$$;

revoke all on function app_private.prevent_self_role_escalation() from public;
revoke all on function app_private.prevent_self_role_escalation() from anon;
revoke all on function app_private.prevent_self_role_escalation() from authenticated;

create trigger prevent_self_role_escalation
before update on public.profiles
for each row execute function app_private.prevent_self_role_escalation();

drop policy if exists "profiles_admin_update" on public.profiles;

create policy "profiles_update_own_or_admin"
on public.profiles for update
to authenticated
using (id = (select auth.uid()) or (select app_private.is_admin()))
with check (id = (select auth.uid()) or (select app_private.is_admin()));
