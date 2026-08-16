# Availability contract (Agent 4)

Published by Agent 4 (Member Surfaces). Covers the paint-grid data shapes, the `paintDraft` API
Agent 6 renders into, and the swap state machine as consumed from the member side. Implementation
lives under `lib/availability/`, `lib/shifts/`, `lib/swaps/`, `components/availability/`, and the
`(app)/{my-schedule,availability,shifts,swaps}` pages.

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

## 4. Swap state machine (as driven from the member side)

States and transitions are Agent 2's `swap_request_status` enum (`open`, `claimed`, `approved`,
`declined`, `cancelled`) and `swap_request_kind` (`swap`, `drop`); this section documents which
transitions my UI triggers, not a redefinition.

- **Open**: `requestSwapAction(assignmentId, kind)` inserts a `swap_requests` row
  (`requested_by = caller`). A database trigger flips the underlying `shift_assignments.status` to
  `swap_pending` atomically; the client never writes that column directly.
- **Claimed**: `claimSwapAction(swapRequestId)` calls the `claim_swap` RPC. Server-authoritative:
  race-safe (row-locked), rejects the requester claiming their own request, transfers the
  assignment atomically. First eligible claimer wins.
- **Approved / Declined**: organizer-mediated, not built by Agent 4 (Agent 3's roster/approval
  queue territory per the shared brief).
- **Cancelled**: `cancelSwapRequestAction(swapRequestId)` updates `status = 'cancelled'`, guarded
  `.eq("status", "open")` so only an untouched request can be self-cancelled.

Known gap: a member cannot currently browse other members' `open` swap requests to claim them. The
`swap_requests` SELECT RLS policy only allows the requester, claimant, or organizer/admin to read a
row. `claim_swap()`'s "first eligible claimer wins" design implies open-marketplace visibility was
intended; this looks like an RLS oversight rather than a deliberate restriction. Filed in
`requests.md`. Until it lands, the swaps page shows the caller's own shifts (real, request-swap
works) and the caller's own swap requests (real), with an honest "not visible yet" placeholder
where the open board would be.

## 5. Shift signup (not originally scoped as a contract, documented since Agent 3/6 may care)

`claimShiftAction(shiftId)` in `lib/shifts/actions.ts` calls the `claim_shift` RPC directly (no
client-side capacity/overlap pre-check beyond what the UI already knows from
`getOpenShiftsPageData`, which reads real `shift_assignments` counts). Server response errors are
mapped to short user-facing strings; anything unrecognized falls back to "Unable to take this
shift." Extend `CLAIM_SHIFT_ERROR_MESSAGES` in that file if `claim_shift`'s exception text changes.

## Status

Real and working today: per-event availability grid (paint + save), recurring availability grid
(paint + save), shift browsing + signup, swap request + cancel + claim, my swap requests list. Not
yet built: the open swap board (blocked on the RLS gap above), conflict-engine-sourced inline
messages on the shifts page (currently just "This overlaps a shift you already have." from
`claim_shift`'s own rejection, not Agent 3's richer conflict messages), and `paintDraft` is wired
into the component but nothing calls it yet (Agent 6's `availability-parse` module hasn't adopted
the conversion described in section 3).
