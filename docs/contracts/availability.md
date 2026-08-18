# Availability contract (Agent 4)

Published by Agent 4 (Member Surfaces). Covers the paint-grid data shapes, the `paintDraft` API
Agent 6 renders into, and the change-request state machine as consumed from the member side.
Implementation lives under `lib/availability/`, `lib/shifts/`, `lib/change-requests/`,
`components/availability/`, `components/member/`, and the
`(app)/{my-schedule,availability,shifts,swaps}` pages.

**V2 update, 2026-08-18**: `lib/swaps/` is gone, `swap_requests`/`claim_swap` were dropped outright
by Agent 2's `20260817000300_v2_change_requests.sql` (not additive, confirmed no cross-agent
consumers). Section 4 below now documents `lib/change-requests/` instead. The pill/bento reskin
(V1, `MatrixDot`/`ShiftCapsule`/`Card`/`PillButton`/`StatBlock`/`FilterPill` from
`components/ui/`) and the V2 dashboard/approval-flow rework (`shift_assignments.state`,
`StatusPill`, `hours_per_event`/`hours_semester`) are both live; see the Status section at the
bottom for exactly what's real versus stubbed.

## 1. Grid data shapes (`lib/availability/grid.ts`)

```ts
type GridGranularityMinutes = 15 | 30 | 60;
type GridDay = { id: string; label: string };
type GridSpec = { days: GridDay[]; granularityMinutes: GridGranularityMinutes; startMinute: number; endMinute: number };
type MinuteWindow = { dayId: string; startMinute: number; endMinute: number };
type NormalizedWindow = { startsAt: string; endsAt: string }; // absolute UTC ISO
```

Two grid flavors share this shape:

- **Recurring** (`buildRecurringGridSpec`): `dayId` is `"0".."6"` (0 = Sunday, matches
  `Date.getDay()`), minutes are plain local wall-clock time, no timezone conversion (a weekly
  pattern never crosses a timezone boundary). Persisted to `recurring_availability_windows`
  (`day_of_week`, `starts_at_local`, `ends_at_local`).
- **Per-event** (`buildEventGridSpec`): `dayId` is a calendar date (`"2026-10-09"`) derived from
  the event's own `starts_at`/`ends_at` in its timezone via `listCalendarDaysInRange`. Minutes
  convert to/from absolute UTC timestamps via `eventWindowsToNormalizedWindows` /
  `normalizedWindowsToEventWindows`, using the existing `localDateTimeToUtcIso` /
  `formatInputDateInTimeZone` / `formatInputTimeInTimeZone` helpers in `lib/availability/time.ts`.
  A window can roll past midnight onto the next calendar day; both conversion directions handle
  that. Persisted to the existing `availability_windows` table (`event_id`, `starts_at`, `ends_at`,
  `status`), unchanged shape, just no longer resolved through a hardcoded event name.

`cellsToWindows` / `windowsToCells` merge a `Set<cellKey>` selection into contiguous per-day
windows and back; both flavors reuse the same functions since they operate purely on `MinuteWindow`
and `GridSpec`.

## 2. `isAvailable(userId, range)` — not built as a standalone export

Originally planned as an exported helper for Agent 3's candidate sorting and Agent 6's auto-fill.
In practice, per-event availability is read directly from `availability_windows` (a real,
already-shared table any agent can query under RLS: own rows for a member, all rows for
organizer/admin), so a wrapper function added no value over `.from("availability_windows").select()
.eq("event_id", ...).eq("status", "available")`. Agent 3's `src/lib/db/availability.ts` already
reads this table directly for the conflict engine. If a shared overlap-check helper is wanted, it
is `intervalsOverlap(a, b)` in `lib/availability/time.ts` (exported, pure, used by
`findOverlappingWindow`).

Recurring availability (`recurring_availability_windows`) is member-private except in aggregate;
RLS lets organizer/admin read all rows for candidate suggestions, same posture as
`availability_windows`.

## 3. `paintDraft` grid API (for Agent 6)

`AvailabilityGrid` (`components/availability/availability-grid.tsx`) exposes an imperative handle
via `forwardRef`:

```ts
type AvailabilityGridHandle = {
  paintDraft: (cells: string[]) => void; // cell keys, see cellKey()/parseCellKey() in grid.ts
  clearDraft: () => void;
};
```

Cells passed to `paintDraft` render at reduced fill with a dashed border (`state="partial"`,
`coverage=0.3`, `className="border-dashed"` on the real `components/ui/grid-cell` primitive) until
the member paints over them (confirms) or calls `clearDraft()`. The grid also accepts a controlled
`draftCells` prop directly if a parent wants to own the draft state instead of calling the ref
method. Note for Agent 6: `src/lib/ai/kinds/availability-parse.ts` (per `pending.md`, item "STUB
(agent-4)") currently assumes concrete `{ startsAt, endsAt }` pairs. To drive `paintDraft`, convert
those into cell keys with `windowsToCells(normalizedWindowsToEventWindows(pairs, event.timezone),
spec)` (per-event) — the grid's `spec` is already in scope wherever `AvailabilityGrid` is rendered,
not something the AI module needs to compute itself.

## 4. Change-request state machine (as driven from the member side)

States and kinds are Agent 2's `change_request_state` enum (`open`, `claimed`, `approved`,
`declined`, `cancelled`) and `change_request_kind` (`swap_any`, `swap_with`, `drop`,
`cant_make_time`, `more_hours`); this section documents which transitions my UI triggers, not a
redefinition. Implementation: `lib/change-requests/{data,actions,types}.ts`,
`components/availability/request-change-sheet.tsx` (the five-kind sheet, opened from any shift row
on `/my-schedule` and `/swaps`) and `claim-change-request-button.tsx`.

- **Open**: `submitChangeRequestAction(input)` inserts a `change_requests` row (`requested_by =
  caller`). Unlike the V1 swap flow, this does **not** flip the assignment to any kind of "pending"
  state: V2 keeps "this shift has an open request" a join (`myAssignmentIdsWithOpenRequest` in
  `data.ts`), not a stored assignment field, since an open request no longer itself means the
  assignment is unsettled (only approval does that).
- **Claimed**: `claimChangeRequestAction(id)` calls the `claim_change_request` RPC (`swap_any`/
  `swap_with` only). Server-authoritative, race-safe, rejects the requester claiming their own
  request, rejects a non-target claiming a `swap_with` request. Does **not** transfer the
  assignment (V2 behavior change from V1's `claim_swap`, flagged loudly in Agent 2's migration
  comment): the transfer waits for `resolve_change_request()`, which is director/admin-only and not
  built by Agent 4 (Agent 3's approval-queue territory per the shared V2 brief).
- **Approved / Declined**: director/admin-mediated via `resolve_change_request()`, not built here.
- **Cancelled**: `cancelChangeRequestAction(id)` updates `state = 'cancelled'`, guarded
  `.eq("state", "open")` so only an untouched request can be self-cancelled.

The open-marketplace SELECT gap V1 hit for `swap_requests` is already resolved for
`change_requests` in the same migration (`change_requests_select_open_own_or_authority`): any
authenticated member can see an open `swap_any`/`swap_with` row, plus their own rows in any state,
plus every row a director/admin has authority over. The swaps page's open board is real, not a
placeholder.

## 5. Shift signup (not originally scoped as a contract, documented since Agent 3/6 may care)

`claimShiftAction(shiftId)` in `lib/shifts/actions.ts` calls the `claim_shift` RPC directly (no
client-side capacity/overlap pre-check beyond what the UI already knows from
`getOpenShiftsPageData`, which reads real `shift_assignments` counts). Server response errors are
mapped to short user-facing strings; anything unrecognized falls back to "Unable to take this
shift." Extend `CLAIM_SHIFT_ERROR_MESSAGES` in that file if `claim_shift`'s exception text changes.

## Status

Real and working today: per-event availability grid (paint + save, `MatrixDot` dot-matrix), 
recurring availability grid (paint + save), shift browsing + signup (with member avatars and a
"fits my availability" filter), the full five-kind change-request flow (request, cancel, claim,
open board), the V2 dashboard (`/my-schedule`: upcoming-event hero with `StatusPill`, next-shift
countdown, `hours_per_event`/`hours_semester` via RPC, per-shift agenda with `StatusPill` and a
"Request a change" trigger, quickchat row mounted per Agent 6's `docs/contracts/requests.md`
note). Not yet built, scope-cut this pass for time, tracked here rather than silently dropped:

1. **Member event pages (`/my-events`, `/my-events/[id]`)** from the V2 brief's item 4: per-event
   description/location, read-only approved-only schedule, announcements feed, per-event hours
   StatBlock, and an events list card grid. `/events` is Agent 3's organizer/admin-gated route
   (`requireOrganizer()`, `organizerRoutePrefixes` in `lib/auth/route-protection.ts`), so this needs
   a new member-facing route, not reuse. `announcements` (real table, RLS already allows any
   authenticated read) and `getEventRosterForSwap`-style admin-client roster reads are the pieces
   already proven elsewhere in this pass; building the pages themselves is what's left.
2. **Real `EventsTimeline`/`TimelineTrack`** for the dashboard's "This week" replacement: Agent 3
   has a `TimelineTrack`/`horizontal-schedule` under `components/coverage/` (their own surface, not
   yet published to `components/ui/`), not imported from here since cross-agent imports outside
   `components/ui/` are fragile. `member-schedule-workspace.tsx` has a `TODO(agent-3/agent-1)`
   marking exactly where to swap it in once published.
3. **Conflict-engine-sourced inline messages** on the shifts page: unchanged from V1, still just
   `claim_shift`'s own rejection text, not Agent 3's richer conflict messages. Lower priority under
   V2 anyway, since hard limits are gone (warnings only, surfaced in the approval queue, not at
   signup time).
4. **`paintDraft`** is wired into the component but nothing calls it yet (Agent 6's
   `availability-parse` module hasn't adopted the conversion described in section 3).

No first-class `white` `PillButton` variant exists yet (`primary`/`default`/`ghost`/`destructive`
only, `components/ui/neu-button.tsx`); the swap board's "Claim swap" button (selection semantics
per the shared design spec) borrows it via a `className` override on `variant="default"`, see
`components/availability/claim-change-request-button.tsx`. Flagged in `requests.md`.
