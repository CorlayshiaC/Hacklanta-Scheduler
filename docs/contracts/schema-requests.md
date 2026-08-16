# Schema requests from Agent 3 (Shift Engine & Organizer Surfaces)

Migrations are owned by Agent 2. These are requirements, not migration files. Existing
`supabase/migrations/*` already cover most of the shift-scheduling domain (`events`,
`coverage_roles`, `shifts`, `shift_role_requirements`, `shift_assignments`,
`member_coverage_roles`, `member_settings`, `availability_windows`). The gaps below are what
the prog scheduler generalization needs on top of that foundation.

## 1. Role model: add `organizer`

Current: `app_role` enum is `admin | board_member`.
Needed: `member | organizer | admin` per shared-context vocabulary.

- Add `organizer` as a new enum value (`alter type app_role add value 'organizer'`, additive and
  safe).
- Add `member` as a new enum value and backfill existing `board_member` rows to `member` in a
  follow-up migration once application code no longer reads `board_member` (Postgres enum values
  cannot be removed in the same transaction they're added, so this is two migrations: add value,
  then a later data migration + drop of the old value once nothing references it).
- Until this lands, my code treats `admin` as also authorized for organizer-only actions (both
  roles can do everything an organizer can, per the existing `is_admin()` check) and does not yet
  distinguish `organizer` from `admin`. Marked with `STUB(agent-2)` in `lib/scheduling/actions.ts`.

## 2. `events`: add `description` and `location` columns

Current `events` row: `id, name, starts_at, ends_at, timezone, status, created_by, created_at,
updated_at`. My event CRUD deliverable calls for `description` and `location` fields shown on the
event detail slab.

```sql
alter table public.events add column description text;
alter table public.events add column location text;
```

No RLS changes needed, existing event policies already gate by `status`/`is_admin()`.

## 3. `shift_assignments.status`: reconcile with organizer/self-signup vocabulary

Current values: `draft | published | removed`. That's a whole-schedule publish gate (an
assignment is invisible to its member until the whole schedule is published).

Shared-context vocabulary wants: `assigned | signup | swap_pending | dropped`, where the axis is
*how the assignment was created / its swap state*, not publish visibility.

Proposed reconciliation (does not require dropping the existing gate, just adding a second axis):

- Add a new column `origin text not null default 'assigned' check (origin in ('assigned',
  'signup'))` to `shift_assignments`, recording whether an organizer placed the member or the
  member self-signed-up. This lets the coverage board and roster panel distinguish the two per the
  brief without touching the existing publish-gate semantics.
- Extend `assignment_status` enum with `swap_pending` (assignment is mid-swap, visible but not
  editable by the assignee) alongside existing `draft | published | removed`. Treat `removed` as
  the `dropped` terminal state the brief describes.
- Event-level `status` (`draft | published | archived`, already exists) becomes the primary
  visibility gate for a shift's existence going forward for newly-created events under the
  generalized (non-HackLanta-hardcoded) flow; the per-assignment `draft/published` distinction can
  stay for the existing single-event publish-review workflow until Agent 2 decides whether to
  retire it. Flagging this as a design question, not a demand, since `lib/admin/schedule/review.ts`
  and the publish action depend on it today and I am not touching that code in this pass.

## 4. New `swap_requests` table

Needed for Agent 4's swap/drop flows and so the coverage board can render `swap_pending` state and
link to the open request.

```sql
create type public.swap_request_status as enum ('open', 'claimed', 'approved', 'declined', 'cancelled');

create table public.swap_requests (
  id uuid primary key default extensions.uuid_generate_v4(),
  shift_assignment_id uuid not null references public.shift_assignments (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  claimed_by uuid references public.profiles (id) on delete set null,
  status public.swap_request_status not null default 'open',
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index swap_requests_assignment_idx on public.swap_requests (shift_assignment_id);
create index swap_requests_status_idx on public.swap_requests (status);
```

RLS: requester and claimant can read/write their own rows; organizers/admins can read and decide
all rows for events they can manage. Happy to hand off exact policy text if useful, this is Agent
2's call.

## 5. `shifts.event_id` nullability (fast-follow, not blocking)

Shared-context: "Shifts usually belong to an event but can stand alone (weekly office hours)."
Current schema has `shifts.event_id uuid not null`. Supporting standalone shifts needs:

- `event_id` made nullable.
- `validate_shift_within_event()` trigger updated to skip the event-window bounds check when
  `event_id is null`.
- RLS policy for shifts with `event_id is null` (proposal: visible to all authenticated members,
  same as a published event's shifts, since there's no event to gate on).

Not blocking my first units of work. Every event-CRUD and coverage-board action I'm shipping now
assumes `event_id` is required; I'll pick this up once requested here is scheduled.

## 6. Notification kinds

`src/lib/notifications/types.ts` currently defines `scheduleNotificationEvents`:
`ASSIGNMENT_ADDED | ASSIGNMENT_CHANGED | ASSIGNMENT_REMOVED | SCHEDULE_PUBLISHED`. My deliverables
need:

- `SHIFT_CANCELLED` (deleting a shift with assignees fires this per member removed).
- Swap lifecycle kinds for Agent 4: `SWAP_REQUESTED`, `SWAP_CLAIMED`, `SWAP_APPROVED`,
  `SWAP_DECLINED` (not mine to build the copy for, just noting the coverage board and my actions
  will need to trigger `SHIFT_CANCELLED` and read swap state).

This lives in `src/lib/notifications/`, which the shared context assigns to Agent 2
("notifications" is listed under Agent 2's stack items) even though the directory predates the
new agent split. Flagging here rather than editing it directly.

## Status

Nothing above is implemented yet as of this commit. `lib/scheduling/actions.ts` is coded against
the *current* schema and marked with `STUB(agent-2)` comments everywhere a request above would
change its shape.

---

# Schema requests from Agent 5 (Shareable Surfaces & Settings)

Builds on the foundation above. Does not repeat Agent 3's request 1 (`organizer` role): same need,
already filed, no changes to add. My roles admin screen (`app/(app)/settings/roles`) is coded
against the target three-role vocabulary but can only persist `admin | board_member` until that
lands, marked `STUB(agent-2)`.

## 1. New `share_tokens` table

Backs public schedule pages (`/s/[token]`) and OG images (`/api/og/[token]`). Full contract in
`docs/contracts/public.md`.

```sql
create table public.share_tokens (
  id uuid primary key default extensions.uuid_generate_v4(),
  event_id uuid not null references public.events (id) on delete cascade,
  token text not null unique,
  label text,
  created_by uuid not null references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index share_tokens_event_idx on public.share_tokens (event_id);
create unique index share_tokens_token_idx on public.share_tokens (token) where revoked_at is null;
```

RLS: no direct anon `select` on this table or on `shifts`/`shift_assignments`/`profiles` for the
public flow. Instead requesting a security-definer function, following the existing
`app_private.is_admin()` pattern from the initial migrations:

```sql
create or replace function public.get_public_schedule(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
  -- validates p_token exists and revoked_at is null, then returns event + shift +
  -- assignment data pre-shaped to the public contract (no email, no profile id, no role,
  -- assignee name already reduced to org_settings.public_name_display policy).
  -- returns null if token is missing or revoked; caller 404s on null.
$$;

revoke all on function public.get_public_schedule(text) from public;
grant execute on function public.get_public_schedule(text) to anon, authenticated;
```

Organizers/admins can `select`/`insert`/`update` (`revoked_at`) their own event's tokens through
normal RLS keyed on `is_admin()` or (once it exists) an organizer check, same shape as existing
event policies.

## 2. New `org_settings` table (singleton)

```sql
create table public.org_settings (
  id boolean primary key default true check (id),
  org_name text not null default 'progsu',
  default_shift_buffer_minutes int not null default 0,
  fairness_settings jsonb not null default '{}'::jsonb,
  semester_starts_on date,
  semester_ends_on date,
  public_name_display text not null default 'first_name'
    check (public_name_display in ('full_name', 'first_name', 'initials')),
  updated_at timestamptz not null default now()
);

insert into public.org_settings (id) values (true);
```

`id boolean primary key default true check (id)` is the standard singleton-row trick: only one row
can ever exist. RLS: readable by any authenticated user (several agents' UIs read semester dates
and buffers), writable by admin only.

## 3. New `notification_preferences` table

```sql
create table public.notification_preferences (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  channel text not null check (channel in ('email', 'in_app')),
  enabled boolean not null default true,
  primary key (profile_id, kind, channel)
);
```

`kind` should match whatever `src/lib/notifications/types.ts` settles on (currently
`ASSIGNMENT_ADDED | ASSIGNMENT_CHANGED | ASSIGNMENT_REMOVED | SCHEDULE_PUBLISHED`, plus Agent 3's
requested `SHIFT_CANCELLED` and the swap kinds). Not enforced as an enum/FK on purpose so new kinds
don't require a migration; the settings UI's source of truth for which kinds to render is a TS
const, ideally exported from `src/lib/notifications/types.ts` once Agent 2 owns it. RLS: a profile
can only read/write its own rows.

## 4. `profiles`: add `timezone` and `avatar_url`

```sql
alter table public.profiles add column timezone text not null default 'America/New_York';
alter table public.profiles add column avatar_url text;
```

Needed for the profile settings screen. Not requesting a profile-level "max hours per week"
column: `member_settings.max_hours` already exists per-event and is closer to what Agent 3's
conflict engine actually reads, so the profile settings screen edits that row for the member's
current active event rather than introducing a second, competing source of truth. Revisit if
multi-event concurrency makes a global default worth it.

## Status

Nothing in this section is implemented yet. Public pages, OG images, and the roles/notifications
settings screens run against local stubs until these land, see `pending.md`.
