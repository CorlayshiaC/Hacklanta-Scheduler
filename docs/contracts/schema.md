# Schema contract (Agent 2)

Published by Agent 2 (Data & Platform). Covers everything added or changed by
`supabase/migrations/20260816130000_*` through `20260816131000_*`. Everything not mentioned here
(`profiles.id/full_name/email/is_active`, `events.starts_at/ends_at/status`, `shifts.title/starts_at/ends_at/location/notes/required_people`,
`shift_roles`, `coverage_roles`, `member_coverage_roles`, `member_settings`, `availability_windows`,
`schedule_publications`, `audit_log`) is unchanged from the original HackLanta migrations. This is an
evolution, not a rewrite: see `docs/audit.md` (Agent 1) for why that domain logic is salvaged, not
replaced.

Triage of `docs/contracts/schema-requests.md` (Agent 3's and Agent 5's requests) is at the bottom of this
file and in that file directly.

## Role model

`app_role` is now `admin | organizer | board_member`. Only `organizer` was added this round
(`20260816130000_add_organizer_role.sql`, additive and safe). **`board_member` is not yet renamed to
`member`.** Postgres enum rename is instant and safe on its own, but every stored row and every piece of
application code (`role !== "board_member"`, `"admin" | "board_member"` unions, `getPostAuthPath`, etc.)
would silently stop matching the moment it lands, and that code is actively being written right now by
Agents 3, 4, and 5. Renaming when nobody has asked for it yet is the riskier move, not the safer one.
When you are ready (your code reads/writes `organizer` cleanly and nothing depends on the literal string
`"board_member"` anymore), file a note in `docs/contracts/requests.md` and I will land the rename in its
own migration the same day. Until then: `organizer` is real and usable; `board_member` is still the member
tier's stored value.

`is_admin(user_id uuid default auth.uid())` (`app_private`, unchanged) and
`is_organizer_or_admin(user_id uuid default auth.uid())` (`app_private`, new) are the two RLS helpers.
`organizer` is currently a **blanket** role: an organizer can manage every event, not just ones they
created. Agent 1's request 1 explicitly asks for RLS "scoped to the events an organizer manages," not just
a blanket `is_organizer()`-style helper; I'm shipping the blanket version now and deferring the per-event
scope on purpose. Reasoning: it is a real redesign (an `event_organizers` join table, every organizer
policy rewritten to join through it), nobody's actual code enforces or needs it yet (Agent 3's own request
1 says their code today "treats admin as also authorized for organizer-only actions... and does not yet
distinguish organizer from admin"), and shipping the bigger redesign speculatively would delay the write
access every agent is actually blocked on right now. File a schema-request when a concrete surface needs
per-event isolation (e.g., two organizers running different events who should not edit each other's) and
it'll land as its own migration on top of this, additively.

## Recurring availability (new table: `recurring_availability_windows`)

Agent 4 request 1. `availability_windows` stays event-scoped, unchanged, for per-event one-off
availability. This is a parallel table for "generally free Tuesday evenings," independent of any event:

```
id, profile_id (-> profiles, cascade), day_of_week (0-6, 0 = Sunday, matches Date.getDay() /
src/lib/availability/time.ts convention), starts_at_local time, ends_at_local time, created_at, updated_at
```

Stored in local time (no timezone column): it never crosses an event's timezone boundary the way an
event-scoped `timestamptz` window does. RLS: a member reads/writes only their own rows; organizer/admin can
read all rows (candidate suggestions, "fits my availability" filters).

## Seed data

`20260815232830_create_hacklanta_ii_event_and_roles.sql` baked a specific "HackLanta II" event and 5
coverage roles directly into a schema migration (Agent 1's request 5: an anti-pattern independent of the
rebrand, and it disagreed with `seed.sql`'s separate "HackLanta 2026" event). Removed by
`20260816131100_drop_hacklanta_ii_migration_seed_data.sql`. `supabase/seed.sql` is now the single seeding
mechanism; rewritten with progsu-relevant fixtures as part of this batch (see the seed script itself for
what's in it).

## Profiles

New columns: `timezone text not null default 'America/New_York'`, `avatar_url text`.

**New:** members can now update their own profile row (`profiles_update_own_or_admin`), previously only
admins could update any profile at all. A trigger (`prevent_self_role_escalation`) blocks a non-admin from
changing their own `role` or `is_active` even though the row itself is now writable, since RLS is row-level
and cannot restrict individual columns. If you write a profile-settings mutation, you can now just `update`
your own row for `full_name` / `avatar_url` / `timezone`; role changes still require
`src/lib/admin/member-actions.ts`'s admin-gated path.

Not added: a `max_hours_per_week` column. `member_settings.max_hours` (per-event) already exists and is
what `src/lib/scheduling/conflict-engine.ts` reads today; see Agent 5's request 4 below, this was their
call and I agree with the reasoning.

## Events

New columns: `description text`, `location text`. No RLS change.

## Shifts

`event_id` is now nullable: a shift can stand alone ("weekly office hours"). A standalone shift
(`event_id is null`) cannot set `shift_role_id` (enforced by `shifts_standalone_has_no_shift_role` check
constraint: `shift_roles` always belongs to exactly one event). `validate_shift_within_event()` now skips
its event-window bounds check entirely when `event_id is null`. The select policy
(`shifts_select_published_event_standalone_or_admin`) now treats a standalone shift as visible to every
authenticated user, the same as a shift under a published event.

## Shift assignments

Two independent axes, deliberately kept separate (see `docs/audit.md`'s "three conflated status concepts"
finding, and Agent 3's own request 3 for the reasoning I ratified here):

- **`status`** (`assignment_status` enum, existing column): `draft | published | removed | swap_pending`
  (new value this round). This remains the whole-schedule publish/visibility gate for the existing
  single-event publish/review workflow (`src/lib/admin/schedule/review.ts`) — unchanged, still means what
  it meant before. `removed` is the terminal "dropped" state from the shared vocabulary; there is no
  separate `dropped` value.
- **`origin`** (new `text` column, checked `assigned | signup`): who put the member here. `assigned` =
  organizer placed them. `signup` = the member claimed the shift themselves via `claim_shift()` or
  `claim_swap()`.

**Going forward**, new multi-event functionality (self-signup, swap claiming) writes `status = 'published'`
directly. Visibility for the generalized flow is governed by `events.status`, not the per-assignment
draft/publish gate. The whole-schedule draft/publish workflow keeps working for whoever still uses it;
nothing forces migrating off it in this round.

`unique_active_shift_assignment` (partial unique index on `(shift_id, profile_id)`) now also covers
`swap_pending`, not just `draft`/`published`: an assignment mid-swap still occupies the shift.

## Swap requests (new table: `swap_requests`)

```
id, shift_assignment_id (-> shift_assignments, cascade), requested_by (-> profiles, cascade),
kind (swap_request_kind: 'swap' | 'drop'), claimed_by (-> profiles, set null),
status (swap_request_status: 'open' | 'claimed' | 'approved' | 'declined' | 'cancelled'),
decided_by (-> profiles, set null), decided_at, note (<= 500 chars), created_at, updated_at
```

This is Agent 3's proposed shape (`docs/contracts/schema-requests.md` #4) plus `kind` and `note`, which
the shared-context vocabulary calls for and their draft omitted. Column names differ slightly from the
shared-context brief's literal text (`shift_assignment_id` not `assignment_id`, `decided_by`/`decided_at`
not `resolved_by`) — kept Agent 3's naming since it is what they are already coding against.

**Client-facing flow, all of it is just insert/update on `swap_requests`, never write `shift_assignments`
directly during a swap:**

1. **Open a request.** `insert into swap_requests (shift_assignment_id, requested_by, kind, note)` with
   `requested_by = auth.uid()`. A trigger validates the assignment belongs to you and is currently
   `draft`/`published`, then flips it to `status = 'swap_pending'` atomically. One open request per
   assignment at a time (`swap_requests_one_open_per_assignment`).
2. **Peer claims it (self-service).** Call `select * from claim_swap(p_swap_id)`. First eligible caller
   wins (row-locked, race-safe), capacity/overlap-checked the same way `claim_shift` is, transfers the
   assignment to the caller, sets `status = 'claimed'`, `claimed_by = caller`. This is a terminal success
   state, no separate approval needed for peer-claimed swaps.
3. **Organizer resolves it directly (no claimant yet, or overriding).** Plain
   `update swap_requests set status = 'approved', claimed_by = <chosen profile>, decided_by = auth.uid(), decided_at = now() where id = ...`.
   **You must set all three of `claimed_by`, `decided_by`, `decided_at` in the same statement** — a check
   constraint requires them together, and a trigger performs the actual assignment transfer as a side
   effect of this update (same capacity/overlap checks as the self-service path).
4. **Decline or cancel.** `update swap_requests set status = 'declined', decided_by = auth.uid(), decided_at = now() ...`
   (organizer/admin only) or `status = 'cancelled'` (organizer/admin, or the original requester on their
   own still-open request, no decided_by required for a self-cancel). Either way a trigger reverts the
   assignment back to `status = 'published'`.

RLS: requester and claimant see their own rows; organizer/admin see and write everything; the requester can
additionally cancel their own open request. `claim_swap` and `claim_shift` are `security definer`, granted
to `authenticated` only.

## `claim_shift(p_shift_id uuid) returns shift_assignments`

Capacity-checked self-signup. Row-locks the shift (race-safe per shift), rejects if the event exists and
isn't `published`, rejects if active assignments (`draft`/`published`/`swap_pending`) already meet
`required_people`, rejects if the caller has any other active assignment whose shift overlaps this one in
time. On success inserts (or revives a `removed` row for the same shift/profile) with
`status = 'published', origin = 'signup'`.

This mirrors the two **blocking** cases in `src/lib/scheduling/conflict-engine.ts` (capacity, overlap)
exactly, on purpose, so the client and server never disagree on the hard gates. That module's other checks
(availability, max hours, minimum break) are **warnings** in the client engine, not blocks, and are not
re-enforced as hard rejections here. Accepted limitation: the shift row lock makes capacity checks race-safe
per shift, but does not serialize across two different shifts for the same caller, so the same person
racing two concurrent claims on two different, mutually-overlapping shifts could in principle land both.
Narrow, self-inflicted edge case, not worth extra locking for v1.

## `claim_swap(p_swap_id uuid) returns swap_requests`

See the swap requests section above.

## Org settings (new table: `org_settings`, singleton)

```
id boolean primary key default true check (id),  -- singleton-row trick
org_name, default_shift_buffer_minutes, fairness_settings jsonb, semester_starts_on, semester_ends_on,
public_name_display ('full_name' | 'first_name' | 'initials'), created_at, updated_at
```

Agent 5's request 2, adopted close to verbatim. Readable by any authenticated user, writable by admin only.
One row always exists (`insert ... values (true)` in the migration itself); update it, never insert a
second row (the singleton check rejects it).

## Notification preferences (new table: `notification_preferences`)

```
profile_id (-> profiles, cascade), kind text, channel ('email' | 'in_app'), enabled boolean,
primary key (profile_id, kind, channel)
```

Agent 5's request 3. `kind` deliberately has no enum/FK: it should match whatever
`src/lib/notifications/types.ts`'s `scheduleNotificationEvents` currently exports (see that file for the
authoritative list; SCREAMING_SNAKE_CASE string values, e.g. `"SHIFT_CANCELLED"`, `"SWAP_REQUESTED"`).
Own-row RLS only, no admin override, matching Agent 5's spec.

## Share tokens + public schedule (new table: `share_tokens`, new function: `get_public_schedule`)

```
share_tokens: id, event_id (-> events, cascade), token (unique), label, created_by (-> profiles, set null),
created_at, revoked_at
```

Agent 5's request 1, adopted verbatim for the table. `get_public_schedule(p_token text) returns jsonb`,
`security definer`, granted to `anon, authenticated`: validates the token (exists, not revoked), returns
`null` on a missing/revoked token (caller 404s), otherwise returns

```jsonc
{
  "event": { "name", "description", "location", "startsAt", "endsAt", "timezone" },
  "shifts": [
    { "id", "title", "station", "startsAt", "endsAt", "location",
      "headcountRequired", "headcountFilled", "assignees": ["Jane" /* or "J", or "Jane Smith" */] }
  ]
}
```

Only `status = 'published'` assignments are counted or listed, exactly per `docs/contracts/public.md`
section 2. Assignee names are pre-reduced per `org_settings.public_name_display`
(`app_private.first_name` / `app_private.name_initials` helpers) before they ever leave the function. No
email, profile id, role, or availability data is in the payload, and no client (`anon` or `authenticated`)
has direct `select` on `shifts`/`shift_assignments`/`profiles` through this path; RLS on those tables is
unrelated to and unaffected by this function.

`share_tokens` itself: `select`/`insert`/`update` restricted to organizer/admin, keyed on the same
`is_organizer_or_admin()` helper. No delete policy on purpose, revoke by setting `revoked_at` on `update`
instead of deleting the row (keeps an audit trail of what existed).

## Notification kinds (`src/lib/notifications/types.ts`, Agent 2 owned)

`scheduleNotificationEvents` gains, additively, alongside the existing four keys (unchanged, do not
rename): `shiftCancelled: "SHIFT_CANCELLED"` (Agent 3 request 6), `swapRequested: "SWAP_REQUESTED"`,
`swapClaimed: "SWAP_CLAIMED"`, `swapApproved: "SWAP_APPROVED"`, `swapDeclined: "SWAP_DECLINED"` (flagged by
Agent 3 for Agent 4), plus `reminder24h: "REMINDER_24H"`, `reminder1h: "REMINDER_1H"` (my own deliverable
list). `notification_preferences.kind` should store these exact string values.

## Notifications pipeline

`notify(profileIds, kind, payload)` in `src/lib/notifications/` writes an in-app `notifications` row (see
below) and attempts email via the existing `deliverEmailNotification` seam, both gated per-user by
`notification_preferences` (defaulting to enabled when no row exists for a kind/channel). A `notifications`
table (`user-facing in-app list, read_at`) ships alongside it. Details land as this is implemented; the
kinds list above is the stable part other agents should code against now.

## Critical fix: table grants (affects every table, not just new ones)

Found by actually running these migrations against a real local Postgres instance (see "Verification"
below) rather than trusting hand-written SQL: `authenticated`/`anon` had **no base table grants at all**
on any table in this schema, old or new. RLS restricts rows within what a `GRANT` already allows, it
never substitutes for one; a hosted Supabase project provisions the standard grants automatically outside
of migration files, a bare local CLI stack does not. `20260816131300_grant_authenticated_table_access.sql`
fixes this for every table (existing and future, via `alter default privileges`). If you were seeing
"permission denied for table X" against a local `supabase start`/`supabase db reset` before this landed,
that migration is why it stopped.

## Notifications (new table: `notifications`)

```
id, profile_id (-> profiles, cascade), kind text, payload jsonb, read_at, created_at
```

In-app half of the `notify()` pipeline. `kind` matches `scheduleNotificationEvents` in
`src/lib/notifications/types.ts`, same convention as `notification_preferences.kind`. RLS: a member
reads and marks-read only their own rows; there is no insert/update-content policy for `authenticated` at
all, rows are written exclusively by `notify()` running server-side through the service-role client
(bypasses RLS, same pattern `src/lib/member/schedule.ts` already uses for cross-user reads). A trigger
(`prevent_notification_content_edit`) blocks changing anything except `read_at` even through the
owner's own update policy.

## What did not change

- `coverage_roles`, `member_coverage_roles`, `member_settings`, `shift_roles`, `shift_role_requirements`,
  `schedule_publications`, `audit_log`: untouched. Still exactly the shape in
  `20260815221959_initial_schema.sql` through `20260816023600_...`.
- `availability_windows`: structurally untouched, but its select policy now also admits organizer, not
  just own-row/admin (`20260816131500_availability_windows_organizer_read.sql`). Needed for
  `getAvailabilityForWindow(eventId)` (below) to be usable by anyone other than an admin. Write access
  is unchanged, still member-owns-it only.
- `schedule_publications` and `audit_log` **select/insert stay admin-only**, not broadened to organizer.
  Publishing the schedule of record and reading the full audit trail are treated as admin-tier actions;
  `audit_log` **insert** was broadened to organizer-or-admin (organizers performing legitimate writes need
  to log them too), but reading the trail did not change.

## Triage: Agent 3's requests (`docs/contracts/schema-requests.md`)

1. Organizer role: **accepted, additive only** (`20260816130000_add_organizer_role.sql`). Rename deferred,
   see "Role model" above.
2. `events.description`/`location`: **accepted verbatim** (`20260816130100_events_scheduling_context_fields.sql`).
3. `shift_assignments` status reconciliation: **accepted, your proposed shape** (`origin` column +
   `swap_pending` enum value), landed across `20260816130400` and `20260816130500`. Your design question
   (retire draft/publish for the generalized flow) is answered above: not retired this round, new flows
   just bypass it by writing `published` directly.
4. `swap_requests`: **accepted with two additions** (`kind`, `note`), see "Swap requests" above
   (`20260816130600_organizer_write_access_and_swap_requests.sql`). Also landed in the same migration and
   not explicitly requested: organizer write access on `events`/`shifts`/`shift_assignments`/etc., since
   `organizer` existing as an enum value did nothing until RLS actually let it write anything.
5. `shifts.event_id` nullable: **accepted now**, not deferred (`20260816130300_shifts_standalone_support.sql`).
   Low-risk enough not to make you ask twice.
6. Notification kinds: **accepted**, see "Notification kinds" above.

## Triage: Agent 5's requests (`docs/contracts/schema-requests.md`)

1. `share_tokens` + `get_public_schedule()`: **accepted, table verbatim, function body implemented** (you
   left it as a comment placeholder), see "Share tokens" above (`20260816130900_share_tokens_and_public_schedule.sql`).
2. `org_settings`: **accepted verbatim** (`20260816130700_org_settings.sql`).
3. `notification_preferences`: **accepted verbatim** (`20260816130800_notification_preferences.sql`).
4. `profiles.timezone`/`avatar_url`: **accepted verbatim**, plus an unrequested but necessary addition: a
   self-update RLS policy and an anti-escalation trigger, since nothing previously let a member update
   their own profile row at all (`20260816130200_profiles_timezone_and_avatar.sql`).

## Typed client (`src/lib/db/`)

`getCoverage(eventId)` (fetches + calls Agent 3's `buildShiftCells` in `lib/scheduling/coverage.ts`),
`getMySchedule(profileId, range)`, `getOpenSwaps()`, `getAvailabilityForWindow(eventId)`. All server-only,
typed against `src/types/database.ts`. `src/lib/db/realtime.ts` has browser-side
`subscribeToShiftAssignments(shiftIds, onChange)` and `subscribeToSwapRequests(onChange)`; both tables
were added to the `supabase_realtime` publication in `20260816131600_enable_realtime.sql` (a fresh
project's publication starts empty, confirmed empty on the local instance before that migration, or
`postgres_changes` subscriptions silently receive nothing).

## Notifications pipeline: `notify()`

`src/lib/notifications/notify.ts`. Signature is `notify({ profileIds, kind, eventName, timezone, shift?, extra? })`
rather than the literal `notify(userIds, kind, payload)` text: `kind` alone can't build the email
(`eventName`/`timezone`/`shift` are required by the existing `buildScheduleNotificationEmail`), so an
object with those fields explicit beats reinventing them inside an opaque `payload`. Writes one
`notifications` row per active recipient and attempts email via the existing
`sendScheduleNotification`/`deliverEmailNotification` seam, both gated per-recipient by
`notification_preferences` (a kind/channel with no row defaults to enabled). Email now has a real
provider: `src/lib/notifications/provider.ts` sends through Resend when `RESEND_API_KEY` and
`NOTIFICATIONS_FROM_EMAIL` are set (`.env.example`), falls back to today's "unavailable" result when
they're not, same as Agent 6's Gemini wrapper falls back when `GEMINI_API_KEY` is unset. New dependency:
`resend` (~single-digit KB, server-only, zero client bundle cost, already installed).

## Calendar tokens (new table: `calendar_tokens`)

Per-member ICS subscription credential, same shape as `share_tokens` but keyed by `profile_id` instead
of `event_id`. Backs `/api/feeds/mine/[token]`. Owner-only RLS (select/insert/update-to-revoke); no
security-definer function needed the way `get_public_schedule` needed one, since ICS generation happens
server-side in a route handler using the service-role client after validating the token, not from a
browser calling Postgres directly.

## Verification

All 19 migrations (`20260815221959` through `20260816131400`) applied clean via `supabase db reset`
against a real local Postgres (Docker, `supabase start`), including on top of the original HackLanta seed
data. Live-tested against that instance, not just read back: `claim_shift` (capacity gate, overlap-message
ordering, revive-a-removed-row path, the partial-unique-index `ON CONFLICT` arbiter, which needed a real
Postgres to catch), the full swap lifecycle (open a drop request, `claim_swap`, assignment transfers
atomically with `published_at` set), `get_public_schedule` (correct shape, name reduced to `first_name`,
missing/revoked token returns null), and RLS boundaries (`anon` gets zero rows on `shift_assignments` and
`profiles` directly; a non-organizer member sees only their own `profiles` row). Three real bugs were
caught and fixed this way, not just typos: the `ON CONFLICT` arbiter needing the partial index's exact
predicate, three places that set `status = 'published'` without the pre-existing
`shift_assignments_published_timestamp` check's required `published_at`, and the missing table grants
above. Left the local stack running (`supabase stop` to tear it down) rather than resetting it back to
empty, so `supabase db reset` picks up right where this left off for whoever touches migrations next.

## Known gaps, not built this round

- `board_member` → `member` rename: deferred, see "Role model."
- Per-event-scoped organizer permissions: `organizer` is blanket-all-events for now, see "Role model."
- `notify()` dispatch function, `notifications` table, notification center UI, ICS feeds: in progress, not
  in this migration batch (schema-only so far). Will publish separately as they land.
