-- Backs the per-user ICS subscription feed (app/api/feeds/mine/[token]/route.ts): a calendar app polls
-- this URL directly with no cookies, so it needs its own opaque, revocable credential, the same shape
-- as Agent 5's share_tokens but keyed by profile instead of event. Flagged by Agent 4 in
-- docs/contracts/schema-requests.md as a known gap ("likely wanting a per-member opaque token similar
-- in shape to share_tokens") rather than filed as a formal request, since ICS feeds are already listed
-- under Agent 2's own stack items. Building it now rather than waiting to be asked twice.

create table public.calendar_tokens (
  id uuid primary key default extensions.uuid_generate_v4(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index calendar_tokens_profile_idx on public.calendar_tokens (profile_id);
create unique index calendar_tokens_token_idx on public.calendar_tokens (token) where revoked_at is null;

alter table public.calendar_tokens enable row level security;

-- Owner only: nobody else needs to see or manage another member's calendar subscription link.
create policy "calendar_tokens_select_own"
on public.calendar_tokens for select
to authenticated
using (profile_id = (select auth.uid()));

create policy "calendar_tokens_insert_own"
on public.calendar_tokens for insert
to authenticated
with check (profile_id = (select auth.uid()));

create policy "calendar_tokens_update_own"
on public.calendar_tokens for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));
