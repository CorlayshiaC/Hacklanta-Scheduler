-- Production access gate.
--
-- Three separate problems, one migration because they are the same flow end to end (a stranger hits
-- the app -> what happens) and splitting them would leave the branch in a state where sign-up is
-- fixed but ungated, which is worse than either.
--
-- 1. SIGN-UP IS CURRENTLY BROKEN FOR EVERY NEW ACCOUNT.
--    app_private.handle_new_user() (20260815223043) still writes the literal 'board_member', a value
--    20260817000100 renamed out of public.app_role. A plpgsql body is text parsed at execution, so
--    unlike the profiles.role column default (stored as a parsed Const carrying the enum label's
--    OID, which survives a rename) the literal in this function does not survive it. Proven against
--    local Postgres before writing this migration:
--
--      insert into auth.users (...) values (...);
--      ERROR: invalid input value for enum app_role: "board_member"
--      CONTEXT: PL/pgSQL function app_private.handle_new_user() line 3
--
--    So on a fresh production database nobody can sign in at all: the very first Google sign-in
--    aborts inside the auth trigger. Existing rows are unaffected (they were written before the
--    rename, and the rename rewrote their stored values in place).
--
-- 2. NO ENTRY GATE.
--    Once (1) is fixed, the trigger admits literally any Google account on the internet as an active
--    member, with read access to every schedule, roster, name and email in the org. Invites elevate
--    a role but have never gated entry. New profiles now land is_active = false ("pending access"),
--    which the existing middleware + getAuthenticatedUserContext() already treat as no-access, and
--    which the sign-in page already has copy for ("Your account is inactive. Contact an admin.").
--    Two ways out of pending: redeem an invite link, or an admin flips the toggle in
--    /settings/roles. Existing profiles are deliberately NOT touched: everyone already in is in.
--
-- 3. INVITE REDEMPTION WAS NEVER REACHABLE.
--    public.redeem_invite() has existed since 20260817000500 and nothing has ever called it
--    (/join/[token] renders "Role assignment isn't wired up yet"), so making the gate depend on it
--    without finishing the flow would lock everyone out. The app side lands in the same commit; the
--    function itself needs the changes below to be usable as the gate's key.

-- ---------------------------------------------------------------------------------------------
-- 1 + 2: the new-user trigger
-- ---------------------------------------------------------------------------------------------

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- is_active = false is the gate. Written explicitly rather than by changing the column default,
  -- because the column default is also what every admin-created and seeded profile inherits, and
  -- "a brand-new stranger is pending" is a statement about this one code path, not about the table.
  insert into public.profiles (id, full_name, email, role, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    'member',
    false
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Bootstrap: the first admin
-- ---------------------------------------------------------------------------------------------
-- With the gate on, a fresh production database has no admin and no way to make one from inside the
-- app: everyone arrives pending, and only an admin can un-pend anyone. Something has to break that
-- circle from outside, once.
--
-- A plain `update public.profiles set role = 'admin' ...` from the Supabase SQL editor does NOT
-- work, which is the whole reason this function exists: prevent_self_role_escalation (rewritten in
-- 20260817000500) raises unless app_private.is_admin() passes or the transaction-local system_write
-- flag is set, and in the SQL editor auth.uid() is null so is_admin() is false. The operator would
-- get "only an admin can change role or active status" and have no obvious way forward. This sets
-- the same flag redeem_invite() uses, scoped to the transaction.
--
-- Not granted to `authenticated`. app_private's USAGE grant to authenticated only makes the schema
-- visible; without EXECUTE a signed-in user calling this gets permission denied. Reachable from the
-- SQL editor / a service_role connection only, i.e. by someone who already holds the keys to the
-- database and could edit the table directly anyway.

create or replace function app_private.bootstrap_admin(p_email text)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles;
begin
  perform set_config('app_private.system_write', 'on', true);

  update public.profiles
  set role = 'admin', is_active = true, updated_at = now()
  where lower(email) = lower(trim(p_email))
  returning * into v_profile;

  if v_profile.id is null then
    raise exception 'No profile with email %. Sign in with Google once first, then run this again.', p_email;
  end if;

  return v_profile;
end;
$$;

revoke all on function app_private.bootstrap_admin(text) from public;
grant execute on function app_private.bootstrap_admin(text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 3: invites, made usable
-- ---------------------------------------------------------------------------------------------
-- The admin UI (components/settings/invite-links-panel.tsx) has always offered "no expiry" (blank
-- days) and "Unlimited" uses, and the app-side type has always been `expiresAt: string | null` /
-- `maxUses: number | null`. The table was written not-null with max_uses default 1, so those two UI
-- affordances had nowhere to land. Widening the columns is the honest fix; the alternative (encode
-- "never" as a year-2999 timestamp and "unlimited" as a large sentinel) puts a lie in the data.

alter table public.invites alter column expires_at drop not null;
alter table public.invites alter column max_uses drop not null;

alter table public.invites drop constraint if exists invites_max_uses_positive;
alter table public.invites add constraint invites_max_uses_positive
  check (max_uses is null or max_uses > 0);

-- Revocation. 20260817000500 deliberately shipped no delete policy (keep the trail of what existed)
-- and suggested revoking by backdating expires_at, which no longer works now that expires_at can be
-- null: "revoked" and "never expires" would be the same column fighting over one value. An explicit
-- column also survives being read back by an admin wondering what happened to a link.
alter table public.invites add column if not exists revoked_at timestamptz;

-- Rank helper: used below so redemption can never DEMOTE someone. Without it, an admin who happens
-- to click a member invite link (forwarded in a group chat, say) silently loses their admin role.
create or replace function app_private.role_rank(p_role public.app_role)
returns integer
language sql
immutable
as $$
  select case p_role
    when 'member' then 0
    when 'director' then 1
    when 'admin' then 2
  end;
$$;

-- Unauthenticated invite preview. /join/[token] renders "You've been invited as a director" BEFORE
-- the visitor has signed in, so it needs to read the invite's role while still anonymous. The table
-- has no anon select policy on purpose (20260817000500: a stranger must not be able to enumerate
-- invite metadata), so this security-definer function is the narrow hole: it takes an exact token,
-- returns only role/event_id/validity, and never exposes created_by, used_count, or the row's id.
-- A wrong token is indistinguishable from an expired one from the outside.
create or replace function public.get_invite_preview(p_token text)
returns table (role public.app_role, event_id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select i.role, i.event_id
  from public.invites i
  where i.token = p_token
    and i.revoked_at is null
    and (i.expires_at is null or i.expires_at > now())
    and (i.max_uses is null or i.used_count < i.max_uses);
$$;

revoke all on function public.get_invite_preview(text) from public;
grant execute on function public.get_invite_preview(text) to anon;
grant execute on function public.get_invite_preview(text) to authenticated;

-- Redemption. Changes from 20260817000500's version:
--   - activates the caller (is_active = true), which is what makes this the key to the gate above;
--   - tolerates the now-nullable expires_at / max_uses, and honours revoked_at;
--   - never demotes (see role_rank), while still activating and still consuming a use;
--   - idempotent-ish for the same caller: re-clicking a link they already redeemed does not stack
--     used_count, so a member who bookmarks the join URL cannot burn a 5-use link on their own.
create or replace function public.redeem_invite(p_token text)
returns public.app_role
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_invite public.invites;
  v_current public.app_role;
  v_granted public.app_role;
  v_already boolean;
begin
  if v_caller is null then
    raise exception 'authentication required';
  end if;

  select * into v_invite from public.invites where token = p_token for update;
  if v_invite.id is null then
    raise exception 'invite link not found';
  end if;

  if v_invite.revoked_at is not null then
    raise exception 'invite link has been revoked';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at <= now() then
    raise exception 'invite link has expired';
  end if;

  select exists (
    select 1 from public.audit_log
    where actor_id = v_caller
      and action = 'invite_redeemed'
      and entity_id = v_invite.id
  ) into v_already;

  if not v_already and v_invite.max_uses is not null and v_invite.used_count >= v_invite.max_uses then
    raise exception 'invite link has already been used';
  end if;

  select role into v_current from public.profiles where id = v_caller;

  -- Highest of the two wins. An admin clicking a member link stays admin; a member clicking an
  -- admin link becomes admin.
  v_granted := case
    when app_private.role_rank(v_invite.role) > app_private.role_rank(v_current) then v_invite.role
    else v_current
  end;

  perform set_config('app_private.system_write', 'on', true);

  update public.profiles
  set role = v_granted, is_active = true, updated_at = now()
  where id = v_caller;

  if v_invite.role = 'director' then
    insert into public.event_directors (event_id, user_id, assigned_by)
    values (v_invite.event_id, v_caller, v_invite.created_by)
    on conflict (event_id, user_id) do nothing;
  end if;

  if not v_already then
    update public.invites set used_count = used_count + 1 where id = v_invite.id;

    insert into public.audit_log (actor_id, event_id, action, entity_type, entity_id, metadata)
    values (v_caller, v_invite.event_id, 'invite_redeemed', 'invite', v_invite.id,
      jsonb_build_object('invite_role', v_invite.role, 'granted_role', v_granted));
  end if;

  return v_granted;
end;
$$;

revoke all on function public.redeem_invite(text) from public;
grant execute on function public.redeem_invite(text) to authenticated;
