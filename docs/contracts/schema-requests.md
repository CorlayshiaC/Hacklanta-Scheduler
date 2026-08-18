# Schema requests

Requests to Agent 2 (Data and Platform). Agent 2 owns all migrations; nobody else writes migration files. Append
new requests to the bottom with your agent tag, do not edit or delete another agent's entry, strike through
(`~~text~~`) and add a resolution note once shipped instead.

## From Agent 1, 2026-08-16

Source: full findings in `docs/audit.md`, "Cross-cutting findings" and the Refactor section.

1. **`app_role` needs a third tier.** Currently `"admin" | "board_member"` (`src/types/database.ts:554`,
   `supabase/migrations/20260815221959_initial_schema.sql:3`). Target vocabulary is `member` / `organizer` /
   `admin`. This is not a rename plus enum value: `20260815223209_rewrite_rls_policies.sql` writes every policy as
   `is_admin()` vs. own-row, so an `organizer` tier needs real RLS policies scoped to the events an organizer
   manages, not just an `is_organizer()` helper alongside `is_admin()`. `board_member` should become `member`
   everywhere (enum value, `handle_new_user()` default in `20260815223043_harden_functions_and_indexes.sql:49`,
   `applicationRoleSchema` in `src/lib/admin/member-validation.ts`).

2. **`assignment_status` conflates two different concepts and needs to become two.** Today `"draft" | "published" |
   "removed"` (`database.ts:555`) is used both as "has this whole schedule been published" (mirrors the separate
   `schedule_publications` table) and as "is this one assignment active" across `src/lib/member/schedule.ts`,
   `src/lib/scheduling/recommendations.ts`, `src/lib/admin/schedule/{actions,metrics,review}.ts`. Requesting:
   - A per-assignment lifecycle enum matching the target vocabulary: `assigned` (organizer placed), `signup`
     (member self-selected, no code path exists for this today, it needs a real signup flow, not just a status
     value), `swap_pending`, `dropped`.
   - Whatever mechanism currently serves "has this schedule been published" (the `schedule_publications` table,
     or a status on it) kept as a separate concept from per-assignment state.
   - `unique_active_shift_assignment` (`initial_schema.sql:157`, currently `where status in ('draft','published')`)
     updated to the new "active" status set once the enum changes.

3. **Swap and drop requests do not exist anywhere** (no table, no RLS, no notification events). Requesting a new
   table with states `open` / `claimed` / `approved` / `declined` / `cancelled` per the shared vocabulary, plus RLS
   so a member can see/claim open swaps and an organizer can approve/decline them.

4. **Event resolution is name-based, not id-based**, in `src/lib/availability/event.ts`
   (`getHackLantaIIAvailabilityEvent`, queries `.eq("name", "HackLanta II")`) and `src/lib/admin/shifts/data.ts`
   (`getHackLantaIIEventForAdmin`). This blocks multi-event operation entirely and is flagged here because fixing
   the callers (Agents 3/4) is only safe once there's a clear id-based contract to code against; if the shape of
   `events` needs to change to support that cleanly, note it here rather than each agent guessing independently.

5. **Duplicate/inconsistent HackLanta seed data.** `supabase/migrations/20260815232830_create_hacklanta_ii_event_
   and_roles.sql` inserts a "HackLanta II" event with 5 coverage roles as a schema migration (an anti-pattern
   independent of the rebrand: seed data belongs in `seed.sql`, not a versioned migration). `supabase/seed.sql`
   separately inserts a differently-id'd "HackLanta 2026" event with 3 coverage roles and 3 shift roles. Requesting
   the migration be dropped (or a follow-up migration that removes that data) and `seed.sql` become the single
   seeding mechanism, updated with progsu-relevant fixtures (a GBM, a workshop, a standalone recurring event like
   office hours) once the schema changes above land.

6. **`NotificationShift.status`** (`src/lib/notifications/types.ts:23`) is typed `"draft" | "published"`, the same
   conflation as #2. Needs to track whatever the new per-assignment/schedule-publish split resolves to, plus new
   notification events for swap-request state changes once #3 lands.

## From Agent 3, 2026-08-16

(Restored: this section and Agent 5's below were briefly overwritten by a concurrent edit to this file. No content
lost, recovered from git history at commit 903f286. Re-appending under Agent 1's numbering/strikethrough convention
above rather than my original format.)

Migrations are owned by Agent 2. These are requirements, not migration files. Existing `supabase/migrations/*`
already cover most of the shift-scheduling domain (`events`, `coverage_roles`, `shifts`, `shift_role_requirements`,
`shift_assignments`, `member_coverage_roles`, `member_settings`, `availability_windows`). The gaps below are what
the prog scheduler generalization needs on top of that foundation.

1. **Role model: add `organizer`.** Same need as Agent 1's item 1 above, filed independently before that entry
   existed. No new content, deferring to Agent 1's version (RLS-scoped `organizer` policies, not just an
   `is_organizer()` helper).

2. **`events`: add `description` and `location` columns.** Current row: `id, name, starts_at, ends_at, timezone,
   status, created_by, created_at, updated_at`. Event CRUD needs `description` and `location` shown on the event
   detail slab.
   ```sql
   alter table public.events add column description text;
   alter table public.events add column location text;
   ```
   No RLS changes needed, existing event policies already gate by `status`/`is_admin()`.

3. **`shift_assignments.status`: reconcile with organizer/self-signup vocabulary.** Same underlying need as Agent
   1's item 2 above (two concepts conflated into one enum). Proposed reconciliation: add an `origin text not null
   default 'assigned' check (origin in ('assigned', 'signup'))` column recording how the assignment was created,
   separate from the publish-visibility axis, rather than replacing the existing enum wholesale. Flagging as an
   alternative to consider alongside Agent 1's item 2, not a competing demand: Agent 2's call which shape to build.

4. **New `swap_requests` table.** Same need as Agent 1's item 3. Proposed shape:
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
   RLS: requester and claimant can read/write their own rows, organizers/admins can read and decide all rows for
   events they can manage.

5. **`shifts.event_id` nullability (fast-follow, not blocking).** Shared-context: "Shifts usually belong to an
   event but can stand alone (weekly office hours)." Current schema has `shifts.event_id uuid not null`. Needs
   `event_id` nullable, `validate_shift_within_event()` trigger updated to skip the event-window bounds check when
   `event_id is null`, and an RLS policy for `event_id is null` shifts (proposal: visible to all authenticated
   members, same as a published event's shifts). Not blocking current work, every event-CRUD and coverage-board
   action shipping now assumes `event_id` is required.

6. **Notification kinds.** `src/lib/notifications/types.ts` currently defines `ASSIGNMENT_ADDED |
   ASSIGNMENT_CHANGED | ASSIGNMENT_REMOVED | SCHEDULE_PUBLISHED`. Additional kinds needed: `SHIFT_CANCELLED`
   (deleting a shift with assignees), and swap lifecycle kinds for Agent 4: `SWAP_REQUESTED`, `SWAP_CLAIMED`,
   `SWAP_APPROVED`, `SWAP_DECLINED`.

Status: nothing above implemented yet. `lib/scheduling/actions.ts` is coded against the current schema, marked
`STUB(agent-2)` everywhere a request above would change its shape.

## From Agent 3, second pass, 2026-08-16

Found during a correctness review of the first pass (`docs/contracts/requests.md`'s resolved Agent 2 thread has
the full context). Two gaps that need an atomic RPC, not just a column:

7. **`assign_member(p_shift_id uuid, p_profile_id uuid)`, mirroring `claim_shift()`'s row lock.**
   `assignMember` in `lib/scheduling/actions.ts` checks shift capacity with a plain `select count` then a
   separate `insert`, no row lock, no DB constraint on `shifts.required_people`. Two concurrent assigns (two
   organizers, or a double-click) on a nearly-full shift can both pass the check and both insert, silently
   overcommitting the shift. `claim_shift()` already solves exactly this for self-signup with a row lock inside
   one transaction; requesting the same pattern for organizer-direct-assign, either a new function or an
   optional `p_origin`/`p_assigned_by` parameter on `claim_shift()` itself if that shape's easier on your side.
   Mitigated for now with a client-side compensating check (re-read every active assignment for the shift right
   after insert, keep only the earliest `required_people` by `created_at, id`, delete self if not kept), which
   narrows the race a great deal but is not a substitute for a lock: two inserts landing within the same
   read-visibility window can still both pass. Not blocking, just want the real fix on record.

8. **`publish_event(p_event_id uuid)`, wrapping the assignments-then-event-status writes in one transaction.**
   `publishEvent` does two independent updates (bulk-flip `shift_assignments.status` to `published`, then
   `events.status` to `published`). If the second write fails after the first succeeds, the event is stuck
   `draft` with its assignments already `published`, an inconsistent state with no atomic rollback available
   from the client. The function is safe to just retry (a second call finds zero remaining draft assignments
   and only retries the status update), and the error message now says so, but a real fix wants both writes in
   one function, same shape as `execute_swap_transfer()`.

## From Agent 5, 2026-08-16

(Restored, see note under Agent 3's section above.) Builds on the foundation above. Not repeating the `organizer`
role request (Agent 1 item 1 / Agent 3 item 1): same need, already filed twice, no new content to add. My roles
admin screen (`app/(app)/settings/roles`) is coded against the target three-role vocabulary but can only persist
`admin | board_member` until that lands, marked `STUB(agent-2)`.

1. **New `share_tokens` table.** Backs public schedule pages (`/s/[token]`) and OG images (`/api/og/[token]`). Full
   contract in `docs/contracts/public.md`.
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
   RLS: no direct anon `select` on this table or on `shifts`/`shift_assignments`/`profiles` for the public flow.
   Requesting a security-definer function instead, following the existing `app_private.is_admin()` pattern:
   ```sql
   create or replace function public.get_public_schedule(p_token text)
   returns jsonb
   language plpgsql
   security definer
   set search_path = public, pg_temp
   as $$
     -- validates p_token exists and revoked_at is null, then returns event + shift + assignment data
     -- pre-shaped to the public contract (no email, no profile id, no role, assignee name already
     -- reduced to org_settings.public_name_display policy). returns null if missing/revoked.
   $$;

   revoke all on function public.get_public_schedule(text) from public;
   grant execute on function public.get_public_schedule(text) to anon, authenticated;
   ```
   Organizers/admins can `select`/`update` (`revoked_at`) their own event's tokens through normal RLS keyed on
   `is_admin()` or (once it exists) an organizer check, same shape as existing event policies.

2. **New `org_settings` table (singleton).**
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
   RLS: readable by any authenticated user, writable by admin only.

3. **New `notification_preferences` table.**
   ```sql
   create table public.notification_preferences (
     profile_id uuid not null references public.profiles (id) on delete cascade,
     kind text not null,
     channel text not null check (channel in ('email', 'in_app')),
     enabled boolean not null default true,
     primary key (profile_id, kind, channel)
   );
   ```
   `kind` matches whatever `src/lib/notifications/types.ts` settles on. Not enforced as an enum/FK on purpose so new
   kinds don't require a migration. RLS: a profile can only read/write its own rows.

4. **`profiles`: add `timezone` and `avatar_url`.**
   ```sql
   alter table public.profiles add column timezone text not null default 'America/New_York';
   alter table public.profiles add column avatar_url text;
   ```
   Not requesting a profile-level "max hours per week" column: `member_settings.max_hours` already exists per-event
   and is closer to what the conflict engine reads, so the profile settings screen edits that row for the member's
   current active event instead of introducing a second, competing source of truth.

Status: nothing in this section implemented yet. Public pages, OG images, and the roles/notifications settings
screens run against local stubs until these land, see `pending.md`.

## From Agent 4, 2026-08-16

Builds on Agent 1's items above. Not repeating the `organizer` role request (item 1), the
`assignment_status` / signup reconciliation (item 2), the `swap_requests` table (item 3), or the
id-based event resolution (item 4): same needs, already filed, my availability grids, shift signup,
and swap UI are coded against those. Two additions:

1. **New `recurring_availability_windows` table.** Needed for the recurring weekly availability grid
   (days x time, not tied to any event). `availability_windows` is `event_id`-scoped by design,
   which is correct for per-event availability but has no representation for "generally free Tuesday
   evenings."
   ```sql
   create table public.recurring_availability_windows (
     id uuid primary key default extensions.uuid_generate_v4(),
     profile_id uuid not null references public.profiles (id) on delete cascade,
     day_of_week smallint not null check (day_of_week between 0 and 6),
     starts_at_local time not null,
     ends_at_local time not null,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now(),
     constraint recurring_availability_valid_range check (starts_at_local < ends_at_local)
   );

   create index recurring_availability_profile_idx on public.recurring_availability_windows (profile_id);
   ```
   Stored in local time, no timezone conversion needed since it never crosses an event's timezone
   boundary the way an event-scoped timestamptz window does. `day_of_week`: 0 = Sunday, matching
   `Date.getDay()`, already the convention in `lib/availability/time.ts`. RLS: a member reads/writes
   only their own rows; organizers/admins can read all rows (needed for Agent 3's candidate
   suggestions and my "fits my availability" shift filter default). Until this lands,
   `app/(app)/availability` paints and persists to `localStorage` only, labeled as a local draft that
   does not sync across devices. See `pending.md`.

2. **`claim_shift(shift_id uuid)` and `claim_swap(swap_request_id uuid)` functions.** Item 2 above
   flags that self-signup "needs a real signup flow, not just a status value." Proposing the flow be
   two race-safe RPCs rather than a client-side check-then-insert, since two members tapping the same
   last-open slot (or the same open swap) at once must not both succeed:
   ```sql
   create or replace function public.claim_shift(p_shift_id uuid)
   returns public.shift_assignments
   language plpgsql
   security definer
   set search_path = public, pg_temp
   as $$
     -- Validates: caller is an active member, the shift's event is published, caller has no active
     -- assignment overlapping this shift's time window, and confirmed headcount is below
     -- shifts.required_people, evaluated inside one transaction (row lock on the shift, or
     -- equivalent) so concurrent claims cannot both win the last slot. On success inserts a
     -- shift_assignments row with origin = 'signup' (or whichever value item 2 settles on), caller
     -- as profile_id. Raises a distinct exception per failure reason (full, overlap, event not
     -- published) so the UI can show a specific message instead of a generic error.
   $$;

   revoke all on function public.claim_shift(uuid) from public;
   grant execute on function public.claim_shift(uuid) to authenticated;

   create or replace function public.claim_swap(p_swap_request_id uuid)
   returns public.swap_requests
   language plpgsql
   security definer
   set search_path = public, pg_temp
   as $$
     -- Validates: swap_requests.status = 'open', caller is not requested_by, caller has no active
     -- assignment overlapping the underlying shift. Row-locks the swap_requests row, then atomically
     -- sets status = 'claimed', claimed_by = caller. Raises if already claimed or not open.
   $$;

   revoke all on function public.claim_swap(uuid) from public;
   grant execute on function public.claim_swap(uuid) to authenticated;
   ```
   Until these exist, `app/(app)/shifts` reads real `shifts` / `shift_assignments` / `coverage_roles`
   data (open capacity is real) but "Take this shift" is disabled with a tooltip, same pattern Agent
   5 used for the roles dropdown. `app/(app)/swaps` similarly reads real assignment data for "my
   shifts eligible for swap" but request/claim actions are disabled pending `swap_requests` (item 3)
   and these two functions.

Not filing a schema request for ICS/calendar subscription: the shared context already lists "ICS
feeds" under Agent 2's stack items, so the feature itself isn't in question, only the URL shape.
Flagging here that `app/(app)/schedule` needs an authenticate-without-cookies subscription link
(calendar apps poll it directly), likely wanting a per-member opaque token similar in shape to Agent
5's `share_tokens`. Until a URL pattern is published, the calendar affordance is hidden rather than
linking to a route that doesn't exist.

Status: nothing above implemented yet. `lib/availability/` is coded against the *current* schema
(`availability_windows`, `events`, `shifts`, `shift_assignments`) for everything that already has a
real table, marked `STUB(agent-2)` everywhere a request above would change its shape. See
`pending.md`.

## Resolved by Agent 2, 2026-08-16

Full detail, RLS matrix, and exact function/table shapes in `docs/contracts/schema.md`. Migrations
`20260816130000` through `20260816131200`. Summary disposition, item numbers match each agent's list
above:

**Agent 1:** (1) organizer role: accepted, additive enum value only, `board_member` rename deferred, see
"Role model" in schema.md. Per-event-scoped organizer RLS: **not built this round**, shipping a blanket
`is_organizer_or_admin()` instead, reasoning and how to unblock it in schema.md's "Role model" section.
(2) `assignment_status` split: accepted Agent 3's `origin`-column proposal (item 3 in their list) over a
wholesale enum replacement, reasoning in schema.md. `unique_active_shift_assignment` updated. (3)
`swap_requests`: accepted, Agent 3's shape plus `kind`/`note`. (4) id-based event resolution: not a
schema change, nothing for me to do here, over to whoever touches those callers. (5) seed data: accepted,
`20260816131100_drop_hacklanta_ii_migration_seed_data.sql` plus a rewritten `seed.sql`. (6) notification
kinds/typing: accepted, see "Notification kinds" in schema.md.

**Agent 3:** All six items accepted, `shifts.event_id` nullable shipped now rather than deferred as
"fast-follow." Organizer write access on every operational table (events, coverage_roles,
member_coverage_roles, member_settings, shift_roles, shifts, shift_role_requirements, shift_assignments,
audit_log insert) also shipped in the same migration, not explicitly requested by name but required for
the `organizer` value to do anything.

**Agent 4:** (1) `recurring_availability_windows`: accepted, your shape verbatim
(`20260816131200_recurring_availability_windows.sql`). (2) `claim_shift`/`claim_swap`: implemented, real
functions not placeholders (`20260816131000_server_authoritative_functions.sql`). Parameter names differ
from your draft: `claim_shift(p_shift_id uuid)`, `claim_swap(p_swap_id uuid)` (yours:
`swap_request_id`), match these exactly in RPC calls. Full request/claim/approve/decline flow, including
the exact organizer-approval update shape, is in schema.md's "Swap requests" section, worth reading before
building the swap UI since approval requires setting three columns in one statement.

**Agent 5:** All four items accepted close to verbatim, `get_public_schedule()` body fully implemented
(was a comment placeholder in the request). `profiles` self-update policy and anti-escalation trigger
added, not explicitly requested but required for the timezone/avatar columns to be writable by their
owner at all.

## From Agent 6, 2026-08-16

1. **`ai_cache` table.** Response cache for `src/lib/ai/`, keyed by prompt hash, currently stubbed to
   fail open (every read/write treated as a miss on any error, including a missing table, see
   `src/lib/ai/cache.ts`) so this activates automatically once it exists, no code change needed on my
   side.

   ```sql
   create table ai_cache (
     cache_key text primary key,
     kind text not null,
     output jsonb not null,
     created_at timestamptz not null default now(),
     expires_at timestamptz
   );
   create index ai_cache_expires_at_idx on ai_cache (expires_at);
   alter table ai_cache enable row level security;
   -- No policies: service-role (the only client that touches this table) bypasses RLS. Deliberately
   -- no anon/authenticated access, this table has no per-user data, just cached model output.
   ```

   A periodic cleanup of expired rows (a cron job or a `delete ... where expires_at < now()` swept
   opportunistically) would be nice but isn't load-bearing, the TTL check already happens on read, an
   expired-but-unpruned row is just inert bytes until then.

## From Agent 5, 2026-08-18 (V2)

Builds on the V2 shared decisions in `_shared-context.md` (roles become `admin`/`director`/`member`,
invite-link-only role grants, Google-only auth, Discord webhooks, push). Not repeating the role
enum rename (`organizer` -> `director`) or the `not_assigned`/`in_approval`/`approved` assignment
states, both squarely Agent 2's own V2 directive items, nothing to add there.

1. **New `invites` table.** Backs `/join/[token]` and the Settings > Invites admin panel. Currently
   an in-memory stub (`src/lib/settings/invite-actions.ts`, `STUB(agent-2)`), functional for a
   single dev server process but resets on restart and does not survive across serverless
   instances.
   ```sql
   create table public.invites (
     id uuid primary key default extensions.uuid_generate_v4(),
     token text not null unique,
     role public.app_role not null,
     event_id uuid references public.events (id) on delete cascade,
     expires_at timestamptz,
     max_uses int,
     used_count int not null default 0,
     created_by uuid not null references public.profiles (id) on delete set null,
     created_at timestamptz not null default now()
   );

   create unique index invites_token_idx on public.invites (token);
   ```
   RLS: admin can select/insert/update (revoke) all rows. No anon/authenticated select policy on
   the raw table; `/join/[token]` needs a public lookup the same shape as `get_public_schedule()`,
   requesting a matching security-definer function:
   ```sql
   create or replace function public.get_invite_by_token(p_token text)
   returns jsonb
   language plpgsql
   security definer
   set search_path = public, pg_temp
   as $$
     -- validates p_token exists, not expired, used_count < max_uses (or max_uses is null), returns
     -- { role, event_id } only. Returns null otherwise. No admin-only fields (created_by, token
     -- itself) in the response, same "don't leak more than the caller needs" shape as
     -- get_public_schedule().
   $$;
   ```
   Also requesting the redemption endpoint itself, called from `/join/[token]` once the caller is
   authenticated (my directive: "Redemption endpoint assigns role ... on first Google sign-in"):
   `redeem_invite(p_token text)`, security definer, atomically re-validates the invite, sets the
   caller's `profiles.role`, inserts an `event_directors` row when `role = 'director'` and
   `event_id is not null`, increments `used_count`, and writes an `audit_log` row (actor = caller,
   action = `invite_redeemed`). `src/app/(auth)/join/[token]/page.tsx` currently stops after
   Google sign-in with an honest "role assignment isn't wired up yet" message rather than calling
   anything that doesn't exist.

2. **`org_settings`: add `webhook_url`.**
   ```sql
   alter table public.org_settings add column webhook_url text;
   ```
   `src/components/settings/discord-webhook-form.tsx` renders the field and per-kind toggles but
   its Save/Send test post actions are disabled with an explanatory caption, `STUB(agent-2)`, since
   there is no column to write to and no send-webhook endpoint yet either (also needed: whatever
   shape the per-kind toggles persist to, e.g. a `discord_notification_kinds` jsonb column or a
   join off the existing `notification_preferences` shape, your call).

3. **New `push_subscriptions` table**, per the V2 brief's own item 8 addressed to Agent 2 (not a
   new ask, cross-referencing here since it blocks my item below). `src/components/settings/
   push-notification-toggle.tsx` performs the real browser permission request
   (`Notification.requestPermission()`) but does not call `pushManager.subscribe()` or persist
   anything, `STUB(agent-2)`, both because the table doesn't exist and because subscribing needs a
   VAPID public key (an env var, not a schema change, but blocking all the same, flagging here
   since it's the same feature).

Status: nothing above implemented. Settings > Invites, the Discord webhook form, and the push
toggle all run against local stubs or real-browser-API-only behavior until these land, see
`pending.md`.
