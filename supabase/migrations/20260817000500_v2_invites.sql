-- V2 invite links. Redemption needs to set a brand-new user's role (and, for a director invite,
-- create their event_directors row) from inside a function the new user themselves calls -- but
-- prevent_self_role_escalation (20260816130200) blocks exactly that: a non-admin changing their own
-- role, by design. redeem_invite() below sets a transaction-local flag the trigger explicitly checks,
-- the standard Postgres escape hatch for "this one security-definer path is allowed to do the thing
-- RLS/triggers otherwise block for everyone else." Scoped narrowly (role/is_active only, transaction-
-- local so it can never leak into an unrelated later statement on the same connection).

create or replace function app_private.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (new.role is distinct from old.role or new.is_active is distinct from old.is_active)
    and not app_private.is_admin()
    and coalesce(current_setting('app_private.system_write', true), '') <> 'on' then
    raise exception 'only an admin can change role or active status';
  end if;

  return new;
end;
$$;

create table public.invites (
  id uuid primary key default extensions.uuid_generate_v4(),
  -- Generated in TypeScript (crypto.randomBytes(24).toString("base64url")), same convention
  -- src/lib/export/share.ts already uses for share_tokens.token -- no DB-side default, pgcrypto isn't
  -- an enabled extension here (only uuid-ossp is) and there's no reason to add it for this alone.
  token text not null unique,
  role public.app_role not null,
  -- Director scoping: which event this invite grants director authority over. Null for admin/member
  -- invites (member is the default anyway -- an invite mainly exists to grant admin or a specific
  -- director scope; a plain "join as member" link can also use role = 'member', event_id null).
  event_id uuid references public.events (id) on delete cascade,
  expires_at timestamptz not null,
  max_uses integer not null default 1,
  used_count integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint invites_max_uses_positive check (max_uses > 0),
  constraint invites_used_count_nonnegative check (used_count >= 0),
  constraint invites_director_needs_event check (role <> 'director' or event_id is not null)
);

create index invites_token_idx on public.invites (token);

alter table public.invites enable row level security;

-- No select-by-anon policy: the redemption page looks up a token through redeem_invite() (security
-- definer, below), never a direct table read, so an unauthenticated visitor never sees invite
-- metadata (role, remaining uses) for a token that isn't theirs. Admin can list/manage; authenticated
-- non-admin cannot read this table directly at all, matching share_tokens' posture.
create policy "invites_admin_select"
on public.invites for select
to authenticated
using ((select app_private.is_admin()));

create policy "invites_admin_insert"
on public.invites for insert
to authenticated
with check ((select app_private.is_admin()));

-- No update/delete policy: revoke by setting expires_at to the past via the same admin_insert-gated
-- surface reusing this select+application-level path, or just let it expire; matches share_tokens'
-- "no delete policy on purpose" reasoning (keeps an audit trail of what existed) closely enough that a
-- separate revoked_at column wasn't worth adding for a token whose only real state is expires_at/
-- used_count anyway.
create policy "invites_admin_update"
on public.invites for update
to authenticated
using ((select app_private.is_admin()))
with check ((select app_private.is_admin()));

-- redeem_invite: called by the newly-signed-in user themselves (any authenticated caller, not
-- admin-gated -- that's the whole point of an invite link). Validates the token, assigns the role
-- (and event_directors row for a director invite), increments used_count. Returns the granted role so
-- the join flow can route appropriately.
create or replace function public.redeem_invite(p_token text)
returns public.app_role
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_invite public.invites;
begin
  if v_caller is null then
    raise exception 'authentication required';
  end if;

  select * into v_invite from public.invites where token = p_token for update;
  if v_invite is null then
    raise exception 'invite link not found';
  end if;

  if v_invite.expires_at <= now() then
    raise exception 'invite link has expired';
  end if;

  if v_invite.used_count >= v_invite.max_uses then
    raise exception 'invite link has already been used';
  end if;

  perform set_config('app_private.system_write', 'on', true);

  update public.profiles
  set role = v_invite.role, updated_at = now()
  where id = v_caller;

  if v_invite.role = 'director' then
    insert into public.event_directors (event_id, user_id, assigned_by)
    values (v_invite.event_id, v_caller, v_invite.created_by)
    on conflict (event_id, user_id) do nothing;
  end if;

  update public.invites set used_count = used_count + 1 where id = v_invite.id;

  insert into public.audit_log (actor_id, event_id, action, entity_type, entity_id, metadata)
  values (v_caller, v_invite.event_id, 'invite_redeemed', 'invite', v_invite.id,
    jsonb_build_object('role', v_invite.role));

  return v_invite.role;
end;
$$;

revoke all on function public.redeem_invite(text) from public;
grant execute on function public.redeem_invite(text) to authenticated;
