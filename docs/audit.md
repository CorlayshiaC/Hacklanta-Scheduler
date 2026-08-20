# Repo audit: HackLanta Scheduler to prog scheduler

Author: Agent 1 (Foundation and Design System). Read-only analysis, no source files were changed to produce this
document.

## Framing

HackLanta Scheduler already solves the hard part of prog scheduler: shift definitions, coverage roles, availability
windows, candidate recommendation, publish/review workflow, RLS-backed authorization, and audit logging. That domain
logic is candidate core, not legacy to throw out. The work is generalization, not replacement:

- **Single event to multi-event.** Almost every refactor entry below traces back to one root cause: the app resolves
  "the event" by a hardcoded name (`getHackLantaIIEventForAdmin`, `getHackLantaIIAvailabilityEvent`, a `.eq("name",
  "HackLanta II")` lookup, or a `.order(starts_at).limit(1)` heuristic) instead of taking an `eventId`. Fixing that
  one seam in `src/lib/availability/event.ts`, `src/lib/admin/shifts/data.ts`, and their callers unlocks most of the
  rest.
- **Three conflated status concepts.** The codebase currently uses one enum, `assignment_status` (`draft` /
  `published` / `removed`), to mean two different things depending on the file: whether a whole schedule has been
  published (`schedule_publications`), and whether one assignment is active. Neither matches the target per-assignment
  vocabulary (`assigned` / `signup` / `swap_pending` / `dropped`). This needs a schema decision from Agent 2, not a
  find-and-replace. See `docs/contracts/schema-requests.md`.
- **No organizer tier, no swap/drop requests.** `app_role` is a strict `admin` / `board_member` binary and every RLS
  policy is written as `is_admin()` vs. own-row. There is no `organizer` role and no swap-request concept (table,
  states, notifications) anywhere in the code. Both are net-new builds on top of the salvaged core, not renames.
- **Design system is 100% replaceable.** `components/ui/` and `lib/utils/` do not exist yet in this repo. Every
  screen hand-rolls a green/indigo/pink "hacker" theme (`hl-card`, `hl-button-primary`, `hl-input`, `hl-badge`, plus
  inline `ink`/`muted`/`signal`/`electric`/`pulse` Tailwind colors). None of it survives; it is replaced wholesale by
  the neumorphic purple system in this contract.

## Keep

Works unchanged, or needs at most a cosmetic rename, for prog scheduler.

| Path | Why |
|---|---|
| `src/app/page.tsx` | Pure role-based redirect, no branding or hardcoded domain values. |
| `src/app/(auth)/callback/route.ts` | Generic Supabase OAuth/email callback with safe-redirect validation. |
| `src/lib/supabase/admin.ts`, `browser.ts`, `server.ts` | Generic Supabase client factories, no domain coupling. |
| `src/lib/env.ts`, `src/lib/env.server.ts` | Generic env validation with clean public/private separation. |
| `src/lib/auth/form-validation.ts` | Role-agnostic zod schemas; signup schema deliberately has no role field (privilege-escalation guard, keep this). |
| `src/lib/availability/time.ts` | Timezone-parameterized, DST-safe date/time utilities. Only the `HACKLANTA_TIME_ZONE` constant name is product-specific. |
| `src/lib/scheduling/recommendations.ts` | Fully data-parameterized candidate eligibility/scoring engine. Only the `status` union needs remapping once assignment states change. |
| `src/lib/notifications/provider.ts`, `service.ts` | Generic, swappable delivery seam with provider-as-injected-parameter. No HackLanta coupling. |
| `supabase/migrations/20260815232353_drop_events_36_hour_duration.sql` | Already the exact generalization this product needs (fixed-length hackathon to events of any duration). |
| `supabase/migrations/20260816013000_...security_definer.sql`, `20260816023600_...revoke_execute.sql` | General, reusable security-hardening patterns, no HackLanta specifics. |
| `tests/unit/auth-form-validation.test.ts`, `callback-route.test.ts`, `env.test.ts`, `recommendations.test.ts`, `app-shell.test.tsx` | Test generic behavior; HackLanta strings appear only as inert fixture data. |
| `next.config.ts`, `eslint.config.mjs`, `.prettierrc.json`, `postcss.config.mjs`, `vitest.config.mts`, `tests/setup/vitest.setup.ts`, `.env.example` | Generic tooling config, no product coupling. |

## Refactor

Correct domain concept, needs generalizing, renaming, or restyling. Grouped by theme; see `docs/contracts/schema-
requests.md` for the schema-level asks and `docs/contracts/requests.md` for asks addressed to specific agents.

**Single-event to multi-event (drop name-based event lookup, take `eventId`):**
`src/lib/availability/event.ts`, `src/lib/availability/data.ts`, `src/lib/availability/actions.ts`,
`src/lib/availability/validation.ts` (drops the `event.name !== "HackLanta II"` check), `src/lib/admin/shifts/data.ts`
(`getHackLantaIIEventForAdmin`), `src/lib/admin/shifts/actions.ts`, `src/lib/admin/member-data.ts` (currently picks
"the" event via `.limit(1)`), `src/lib/member/schedule.ts` (also has a latent bug: queries assignments by
`profile_id` with no `event_id` scope, then filters shifts to one event after the fact), `src/lib/scheduling/shift-
validation.ts` (drops the hardcoded America/New_York + event-name check), `src/components/admin/schedule/schedule-
workspace.tsx`, `src/components/admin/shifts/shift-management.tsx`, `src/components/availability/availability-
manager.tsx` (all three hardcode Oct 2026 day arrays instead of deriving days from `event.starts_at`/`ends_at`).

**Role and status vocabulary (needs schema change, not just a rename; see schema-requests.md):**
`src/lib/auth/authorization.ts` (`requireBoardMember`, binary `getAdminAuthorization`), `src/lib/auth/route-
protection.ts` (`getPostAuthPath`), `src/lib/auth/actions.ts`, `src/lib/admin/member-validation.ts`
(`applicationRoleSchema`), `src/components/admin/members/member-management.tsx`, `src/lib/admin/schedule/actions.ts`,
`metrics.ts`, `review.ts`, `src/lib/admin/shifts/actions.ts`, `src/components/member/member-schedule-workspace.tsx`,
`src/lib/notifications/types.ts` (`NotificationShift.status`), `src/types/database.ts` (regenerates from the DB,
fix migrations not this file). Every corresponding test file (`authorization.test.ts`, `route-protection.test.ts`,
`auth-actions.test.ts`, `member-validation.test.ts`, `member-management.test.tsx`, `shift-actions.test.ts`,
`schedule-metrics.test.ts`, `schedule-publish-action.test.ts`, `schedule-review.test.ts`, `availability-
actions.test.ts`, `availability-data.test.ts`, `member-schedule-data.test.ts`) asserts the old literals and needs to
move in lockstep with its source file.

**Design system restyle only (logic stays, hand-rolled `hl-*`/inline hacker colors go):**
`src/app/layout.tsx` (metadata copy only), `src/app/(auth)/sign-in/page.tsx`, `sign-up/page.tsx`,
`src/app/(board)/my-schedule/page.tsx`, `src/app/admin/page.tsx`, `members/page.tsx`, `schedule/page.tsx`,
`schedule/review/page.tsx`, `shifts/page.tsx`, `src/components/layout/app-nav.tsx`, `app-shell.tsx`,
`src/components/auth/sign-in-form.tsx`, `sign-up-form.tsx`, `sign-out-button.tsx`, `submit-button.tsx`,
`src/components/admin/schedule/review/schedule-review-panel.tsx`.

**Middleware:** `middleware.ts` duplicates a local `MiddlewareProfile.role: "admin" | "board_member"` type and needs
both the rename and a decision on whether `organizer` gets admin-route access. Not mine to edit; flagged for
whoever owns `src/lib/auth/` in `docs/contracts/requests.md`.

**Notification content:** `src/lib/notifications/content.ts` hardcodes subject lines to `"HackLanta II"` even though
the function already receives `input.eventName` and uses it correctly in the body. The subject line is silently
ignoring its own parameter, this is a real bug independent of the rebrand.

**Docs:** `AGENTS.md` and `README.md` document a real, reusable architecture (validation module layout, human-in-
the-loop recommendation flow, audit-log-on-every-mutation convention) but hard-lock scope to one HackLanta event and
must be rewritten for multi-event scheduling. `package.json` needs only its `name` field renamed.

**Seed data:** `supabase/seed.sql` keeps its role (seed data belongs here) but its content (HackLanta 2026 event,
Operations/Registration/Logistics roles) needs to become progsu-relevant fixtures (a GBM, a workshop, standalone
office hours).

## Delete

HackLanta-specific dead weight or code that actively conflicts with the shared spec.

| Path | Why |
|---|---|
| `src/app/globals.css` | Entire `hl-*` component layer and hacker-palette gradients conflict wholesale with the neumorphic system. Only the trivial base reset (`box-sizing`, `html`/`body` min-height, `:focus-visible`) is salvageable. Rewritten by Agent 1. |
| `tailwind.config.ts` | Entire color palette (`ink`/`muted`/`field`/`panel`/`elevated`/`signal`/`electric`/`pulse`) is the hacker theme this contract replaces. Only the `content` glob survives. Rewritten by Agent 1. |
| `supabase/migrations/20260815232830_create_hacklanta_ii_event_and_roles.sql` | Data migration that inserts a specific "HackLanta II" event and 5 named coverage roles directly into a schema migration. Baking one org's live event data into a versioned migration is an anti-pattern on top of being HackLanta-specific, and it is inconsistent with `seed.sql`, which seeds a *different* HackLanta event under a different id. Not mine to delete (migrations are Agent 2's exclusively); requested in `docs/contracts/schema-requests.md`. |

## Cross-cutting findings worth a second look

1. **Two independent HackLanta seed mechanisms disagree.** `supabase/migrations/20260815232830_...` seeds
   "HackLanta II" with 5 coverage roles; `supabase/seed.sql` separately seeds "HackLanta 2026" with 3 coverage roles
   and 3 shift roles. Only one seeding approach should carry forward, and it should not be a schema migration.
2. **Duplicate overlap-interval logic.** `findOverlappingWindow` (`src/lib/availability/validation.ts:94`) and
   `windowsOverlap` (`src/lib/scheduling/recommendations.ts:63`) independently implement the same interval-overlap
   check. Worth consolidating into one shared time utility during generalization (not mine to do, flagging for
   whoever owns `src/lib/scheduling/` and `src/lib/availability/`).
3. **`(board)` route group bakes in hackathon-board framing at the routing level**, not just in copy. Renaming it
   (e.g. to a role-neutral member route group) is part of the generalization, not cosmetic. See the route migration
   note in `docs/contracts/design.md`.
4. **`unique_active_shift_assignment` partial index** (`initial_schema.sql:157`) enforces one active assignment per
   person per shift using `status in ('draft','published')`. This pattern is correct and should carry forward, it
   just needs its `where` clause updated once `assignment_status` is redesigned.
5. **`RLS` is currently pure binary** (`is_admin()` vs. own-row) across every policy in
   `20260815223209_rewrite_rls_policies.sql`. Adding `organizer` is a real redesign (organizer scoped to events they
   manage), not an enum value plus a policy tweak.

## Notable conventions worth preserving verbatim

- `getActiveUserAuthorization`'s discriminated-union return type (`authorized: true | false` with a typed `reason`)
  in `src/lib/auth/authorization.ts`, and the `requireX()` (redirects) vs. `getX()` (returns a value) naming split.
- `getSafeCallbackRedirectPath` (`src/lib/auth/callback.ts`), a solid generic open-redirect guard.
- The fetch/compute split in `src/lib/admin/schedule/review.ts`: `buildScheduleReview` is a pure function tested
  without mocking Supabase at all. Keep this shape as the review engine generalizes.
- The `insertAuditLog(...)` + `redirectWithResult(...)` + `revalidatePath(...)` convention repeated across every
  server action in `src/lib/admin/`. Worth extracting into one shared helper when someone next touches that area.
- `app_private` schema pattern for `is_admin()` / `handle_new_user()`: SECURITY DEFINER, locked `search_path`,
  execute revoked from anon/authenticated. Extend with an `is_organizer()`-style helper, do not replace the pattern.
- Notification module layering: `types.ts` (pure types) to `content.ts` (pure content builder) to `provider.ts`
  (swappable delivery) to `service.ts` (orchestration, provider injected). Keep as-is.
- `vi.mock("server-only", () => ({}))` in `tests/setup/vitest.setup.ts` lets server-only modules be unit tested in
  jsdom. Keep this as new server-only domain modules are added.
