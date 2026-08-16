# Scheduling contract (Agent 3: Shift Engine & Organizer Surfaces)

What other agents should code against instead of reaching into `lib/scheduling/` internals.

## Result type: `ConflictCheckResult`

`src/lib/scheduling/types.ts`

```ts
export type ConflictCheckResult =
  | { status: "ok" }
  | { status: "blocked"; reason: string }
  | { status: "warning"; reasons: string[] };
```

Every eligibility/conflict check in this codebase returns this shape: `checkAssignmentConflicts`
in `lib/scheduling/conflict-engine.ts` (coverage board, self-signup, AI auto-fill all call the
same function), and anything built on top of it. `blocked` means the caller must not proceed.
`warning` means proceed only with confirmation, and render every reason. Render the same copy
everywhere this shows up, don't write a second version of these messages.

Rules currently implemented, in check order:

1. Blocked: overlapping active assignment for the same person (any event).
2. Blocked: shift at capacity.
3. Warning: outside submitted availability (only checked when the person has submitted at least
   one availability window for the event; no submission at all is not itself a warning).
4. Warning: would exceed the weekly hour limit. Interim note: the number this compares against is
   currently `member_settings.max_hours`, which is scoped to the whole event, not a rolling week.
   True weekly rollups need standing/weekly shift support, see `schema-requests.md` #5.
5. Warning: back-to-back with another shift and zero gap, OR gap shorter than the person's
   configured minimum break.

## `ShiftCell`

`src/lib/scheduling/types.ts`, built by `buildShiftCells` in `lib/scheduling/coverage.ts`.

```ts
export type ShiftCell = {
  shiftId: string;
  eventId: string | null; // null for a standalone shift (shifts.event_id is nullable)
  title: string;
  station: { id: string; name: string } | null;
  startsAt: string;
  endsAt: string;
  location: string | null;
  headcountRequired: number;
  headcountAssigned: number;
  status: "empty" | "partial" | "full";
  assignees: { assignmentId: string; profileId: string; fullName: string }[];
  understaffedUrgent: boolean; // status !== "full" and starts within 24h (or already started)
};
```

This is the unit the coverage board, calendar chips, and any future roster/candidate surface
render from. One shift becomes one `ShiftCell` (station comes from the shift's own `shift_role_id`
tag), unless it has `shift_role_requirements` rows, in which case it fans out to one cell per
requirement (that's the legacy multi-role-per-shift path the existing `/admin/shifts` flow still
uses; new bulk-generated shifts don't use it, see "Station model" below).

`understaffedUrgent` drives the coverage board's hairline pulse (reduced-motion: static warning
hairline, per the design system).

## Station model: `shift_roles`, not `coverage_roles`

New shifts (bulk-generated or created going forward) use one shift row per (time block, station),
with `shifts.shift_role_id` pointing at a `shift_roles` row as the station tag and
`shifts.required_people` as that station's headcount for that block. `shift_assignments` on these
rows leave `coverage_role_id` null.

This deliberately does not use `coverage_roles` / `member_coverage_roles` / `shift_role_requirements`
for new work. Those tables model per-shift multi-role headcounts gated by a hard DB-trigger
eligibility check (a member can only be assigned to a `coverage_role_id` they've been explicitly
tagged eligible for). The shared-context vocabulary's "station" concept and this brief's conflict
rules don't include a separate eligibility-tag gate, so `shift_roles` (a plain descriptive tag, no
eligibility trigger) is the better fit and is what `lib/scheduling/coverage.ts`,
`bulk-generation.ts`, and `actions.ts` are built against. The old `/admin/shifts` page still uses
`coverage_roles` for its own flow, untouched, both can coexist on the same `shifts` table.

If you're building something that needs "is this person allowed to work this kind of shift at
all" (a real skills gate, not just availability), that's the `coverage_roles` /
`member_coverage_roles` mechanism, ask in `requests.md` before assuming it's wired into the new
conflict engine, it currently is not.

## URL patterns

- `/events` — list
- `/events/new` — create
- `/events/[id]` — detail (hero slab, station list, bulk generator, publish CTA)
- `/coverage/[eventId]` — coverage board
- `/calendar` — organizer agenda view (week/month not built yet)

Route group is `src/app/(app)/`, following this repo's `src/` layout (the brief's `app/(app)/...`
paths, adjusted for where this repo actually puts its App Router tree). Not yet wired into
`AppNav` or `middleware.ts`'s protected-route matcher, filed in `requests.md`.

## Exported actions: `lib/scheduling/actions.ts`

Plain `"use server"` functions, typed args in, `ActionResult<T>` out
(`{ ok: true; data: T } | { ok: false; message: string }`). No FormData, no redirects, callable
directly from a client component or (for Agent 6) the command palette.

- `createEvent(input): ActionResult<{ eventId: string }>` — persists `description`/`location` for real
- `publishEvent(input: { eventId }): ActionResult<{ publishedAssignments: number }>`
- `createStation(input: { eventId, name }): ActionResult<{ stationId: string }>` — a `shift_roles` row
- `generateShifts(input: { eventId, generation }): ActionResult<{ count: number }>` — `generation`
  is `BulkGenerationInput` from `lib/scheduling/bulk-generation.ts`
- `assignMember(input: { shiftId, profileId }): ActionResult<{ assignmentId; check: ConflictCheckResult }>`
  — runs the conflict engine first; blocked results return `{ ok: false }` and never write, warning
  results still write and return the warning in `data.check` for the caller to surface
- `unassignMember(input: { assignmentId }): ActionResult<undefined>`

All of these authorize via `requireOrganizer()` (`lib/scheduling/authorization.ts`), which accepts
either the real `organizer` or `admin` role.

## Status

Uses the real `GridCell`/`NeuCard`/`NeuButton`/`NeuInput`/`NeuSelect`/`NeuTextarea`/`NeuBadge`/
`Skeleton` primitives and token classes throughout (Agent 1's contract), not placeholders. Roles use
the real `organizer`/`admin` gate via `lib/scheduling/authorization.ts`'s `requireOrganizer()` (also
what pages should import for read-gating, actions.ts imports the same function for mutations).
`ACTIVE_ASSIGNMENT_STATUSES` (`draft`, `published`, `swap_pending`, in `types.ts`) is the single
source of truth for "does this assignment still occupy the shift", every capacity/overlap query in
`data.ts` and `actions.ts` uses it, matching `unique_active_shift_assignment` and the overlap checks
in `claim_shift()`/`execute_swap_transfer()` at the database level.

## Correctness notes (added after a review pass)

- `assignMember` mitigates, but does not fully close, an organizer-direct-assign capacity race
  (no DB row lock exists for that path the way `claim_shift()` has one for self-signup). See
  `schema-requests.md`'s second Agent 3 section for the real fix requested.
- `publishEvent`'s two writes (assignments, then event status) are not one transaction. Safe to
  retry on partial failure; real fix is an atomic RPC, also requested in `schema-requests.md`.
- Event/window datetimes entered through `datetime-local` inputs (create-event-form,
  generate-shifts-form) are converted with a dependency-free `zonedTimeToUtcIso()`
  (`lib/scheduling/timezone.ts`) using the event's own timezone, not the browser's ambient one.
- Calendar agenda day-grouping and time display use each shift's owning event's timezone. Standalone
  shifts (no event) have no per-shift timezone column yet and render in the server's default
  timezone until one exists.

## What's not built yet

- Coverage board renders stations-as-rows with the real `GridCell` (empty-is-sunken/filled-is-raised,
  understaffed pulse), but assignment is click-a-cell-then-pick-a-member, not drag. `@dnd-kit` isn't
  installed, requested in `requests.md`.
- Bulk generator is a plain form; the logic (`generateShiftGrid`) already produces the exact preview
  list, it just needs `Dialog` wrapping now that that primitive exists.
- Week/month calendar views (agenda only so far), same `@dnd-kit` gap for the week grid's drag.
- Swap request review UI (table and RPCs exist per Agent 2's `schema.md`, "Swap requests" section;
  building the organizer-side approve/decline UI is unclaimed, see the heads-up in `requests.md`).
- `removeShift` / shift cancellation with a `shift_cancelled` notification.
- Presence dots slot in the coverage board header (left a comment marking where it goes).
- Legacy `/admin/schedule` and `/admin/shifts` (single-event, hardcoded to "HackLanta II") still
  exist alongside these generalized surfaces, not touched in this pass, see the heads-up in
  `requests.md`.
