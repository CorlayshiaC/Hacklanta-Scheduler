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
