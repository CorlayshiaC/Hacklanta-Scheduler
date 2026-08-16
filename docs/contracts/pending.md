# Pending: stubs standing in for unpublished contracts

## From Agent 5

1. **`STUB(agent-1)` design primitives.** `components/ui/` is empty, no tokens file exists yet
   (`tailwind.config.ts` still has the old green/purple/pink `hl-*` palette from the current shell,
   not the neumorphic dark-purple spec). Every component under `components/public/` and
   `components/settings/` uses a small local set of placeholder layout primitives
   (`components/public/_stub-primitives.tsx`, `components/settings/_stub-primitives.tsx`): plain
   bordered surfaces, no hand-rolled dual shadows, no invented color values beyond the literal hex
   constants given in the shared-context spec (used directly, not redefined, since there is nothing
   yet to import from). Swap these for `NeuCard` / `NeuButton` / `NeuToggle` / `NeuWell` /
   `GridCell` once Agent 1 publishes. Tracking removal: grep `STUB(agent-1)`.

2. ~~**`STUB(agent-2)` tables.** `share_tokens`, `org_settings`, `notification_preferences`, and the
   `profiles.timezone` / `profiles.avatar_url` columns don't exist.~~ Resolved: all four landed
   (`20260816130700_org_settings.sql`, `20260816130800_notification_preferences.sql`,
   `20260816130900_share_tokens_and_public_schedule.sql`, `20260816130200_profiles_timezone_and_
   avatar.sql`). Rewired for real:
   - `/s/[token]` and `/api/og/[token]` now call the `get_public_schedule(token)` security definer
     function directly (`src/lib/public/get-schedule.ts`), no more fixture. `lib/public/stub-
     data.ts` deleted, nothing referenced it once the RPC call landed.
   - `src/lib/export/share.ts` now reads/writes the real `share_tokens` table instead of an in
     memory `Map`.
   - Settings > Organization reads/writes the real `org_settings` singleton row
     (`src/lib/settings/organization-actions.ts`), banner and disabled inputs removed.
   - Settings > Notifications reads/writes real `notification_preferences` rows per profile/kind/
     channel (`src/lib/settings/notification-actions.ts`), optimistic toggle with revert on failed
     save, banner removed.
   - Settings > Profile now has real timezone and avatar URL fields (`profiles.timezone` /
     `profiles.avatar_url`), no longer hidden.
   Tracking removal: grep `STUB(agent-2)` in `src/lib/export/share.ts`, the only remaining
   reference (organizer not yet reachable from `requireAdmin()`, see item 3 below, same root cause).

3. **`STUB(agent-2)` role vocabulary.** `app/(app)/settings/roles` renders three role options
   (`member`, `organizer`, `admin`) per the shared vocabulary, but the underlying mutation only
   accepts `admin | board_member` until the enum widens (see Agent 3's request 1 in
   `schema-requests.md`). Selecting "organizer" in the UI is disabled with a tooltip
   ("Organizer role ships once the schema update lands") rather than silently mapping it to
   something wrong.

4. **Reusing, not duplicating, `src/lib/admin/member-actions.ts`.** `updateMemberProfileAction`
   already implements role change with a last-active-admin guard and an audit log write. Rather
   than reimplement that guard, `app/(app)/settings/roles` imports and calls it directly. This is
   reading another agent's exported interface, not editing their file, allowed under the file-
   ownership rule. If its signature or the `applicationRoleSchema` enum changes (e.g. to add
   `organizer`), my settings page picks that up automatically with no changes needed on my side
   beyond removing the disabled state in item 3.

5. **No new dependencies added.** OG images use `next/og`'s built-in `ImageResponse`, not the
   external `@vercel/og` package (same API, zero bundle cost since it ships with Next). CSV export
   is hand-built string formatting, no CSV library. The embed widget is hand-authored vanilla JS
   with no build step, since its whole point is to stay tiny and dependency-free. `package.json` is
   not touched by any of Agent 5's work.

6. **`STUB(agent-1)` primitives still not swapped.** Agent 1's real primitive library and design
   contract are published (see "From Agent 1" below), but `components/public/_stub-primitives.tsx`
   and `components/settings/_stub-primitives.tsx` have not been swapped for `NeuCard`/`NeuButton`/
   `NeuToggle`/`NeuWell`/`NeuInput` yet, deferred as genuinely "whenever convenient" rather than
   done in the same pass as the schema rewiring above. `src/app/(app)/settings/layout.tsx` was
   updated once Agent 1's real `src/app/(app)/layout.tsx` shell landed, to stop double wrapping
   (dropped its own `min-h-screen`/max-width container now that the shell supplies one), but still
   keeps its own settings sub nav and the stub `Slab` wrapper. Next step: swap the stub primitive
   imports across the ten or so files under `components/public/` and `components/settings/` for the
   real ones. Tracking removal: grep `STUB(agent-1)`.

## From Agent 1

Tokens, `components/ui/` primitives (`NeuCard`, `NeuButton`, `GridCell`, and 17 more, see
`docs/contracts/design.md`), and the app shell are published as of this commit. Item 1 above is
resolved on my side, swap `_stub-primitives.tsx` whenever convenient.

1. ~~**`STUB(agent-2)` role vocabulary**, `src/app/(app)/get-shell-session.ts`.~~ Resolved:
   `20260816130000_add_organizer_role.sql` landed the real `organizer` value, `get-shell-session.ts`
   now passes `organizer`/`admin` through directly (flagged stale by Agent 6, who noticed real
   organizers were still being hidden from organizer-gated nav/commands, thank you). Narrow stub
   remains: `app_role` still has `board_member` instead of `member` (rename deliberately deferred,
   see that migration's comment), so `get-shell-session.ts` maps `board_member` -> `"member"` until
   the rename ships. Tracking removal: grep `STUB(agent-2)` in that file.

## From Agent 3

1. **Coverage board is click-to-select, not drag-to-assign.** `components/coverage/coverage-board.tsx`
   renders the real `GridCell` primitive (rows per station, one cell per shift, `understaffedUrgent`
   as a small danger-dot pulse) but assignment is a select-a-cell-then-pick-a-member panel, not the
   drag interaction the brief describes. `@dnd-kit` is not in `package.json`, requested in
   `requests.md`. Tracking removal: grep `TODO(agent-1)` in that file.
2. **Bulk generator is a plain form, not the dialog-with-live-preview.** `components/shifts/generate-
   shifts-form.tsx` already computes the exact preview list via `generateShiftGrid` (pure, unit
   tested), it just renders inline instead of in `Dialog` (which exists at
   `src/components/ui/dialog.tsx` now and wasn't there when this was first built). Small follow-up,
   not schema- or contract-blocked. Tracking removal: grep `TODO(agent-1)` in that file.
3. **Calendar is agenda-only.** `app/(app)/calendar/page.tsx` has no week or month view yet. Same
   `@dnd-kit` dependency gap blocks the week grid's drag-to-move/resize.
4. **Weekly hour limit is really an event-total limit.** `checkAssignmentConflicts`'s
   `maxHoursPerWeek` parameter is fed from `member_settings.max_hours`, which caps hours for the
   whole event, not a rolling calendar week. Correct today for one-off events; will read wrong once
   standalone/recurring weekly shifts (`shifts.event_id is null`) are staffed through the same
   engine. Documented in `docs/contracts/scheduling.md`, not filed as a schema request since it's a
   computation gap, not a missing column.
5. **`shift_assignments.status = 'removed'` on unassign does not check for an open swap request
   first.** If an organizer unassigns someone mid-swap (`swap_pending`), any open `swap_requests` row
   for that assignment is left pointing at a removed assignment. Narrow edge case, not hit by normal
   organizer-assign/unassign flow (swaps are member-initiated). Flagging for whoever builds swap
   approval UI to decide the right guard, not blocking.

## From Agent 6

1. **`STUB(agent-2)` `ai_cache` table.** Doesn't exist yet (requested in `schema-requests.md`).
   `src/lib/ai/cache.ts` reads and writes against it through an untyped client (deliberately not the
   generated `Database` type, which doesn't know this table), both fail open on any error including a
   missing table, so every AI kind works identically before and after the migration, just without
   caching until then. Tracking removal: grep `STUB(agent-2)` in `src/lib/ai/cache.ts`.

2. **`STUB(agent-4)` availability-parse output shape.** `src/lib/ai/kinds/availability-parse.ts`
   assumes concrete `{ startsAt, endsAt }` instant pairs (matching `availability_windows`' insert
   shape) rather than a recurring pattern, since Agent 4 hasn't published a `paintDraft` contract to
   code against yet. Adjust once they do. Tracking removal: grep `STUB(agent-4)` in that file.

3. **Resolved: mounted.** `CommandPaletteProvider`/`PaletteTriggerButton` (`src/app/(app)/layout.tsx`)
   and `SoundManagerProvider`/`EasterEggListener` (`src/app/layout.tsx`) were mounted by Agent 1,
   see the resolution note under Agent 6's section in `requests.md`. Zero registered commands exist
   yet, by design: the self-registration pattern in `command-palette.md` means other agents add
   their own as they build the surfaces those commands act on, this isn't blocked on anyone.
   `SoundToggle` still needs mounting in Settings, requested from Agent 5 in `requests.md`, open.

4. **Not stubbed, deliberately left as a documented gap.** `shift_generation`'s confirm card has no
   path from "here's the parsed draft" to "shifts exist in the database": it never had a real
   `eventId` or station-id resolution to work with in the first place (opened from the global
   palette). See `docs/contracts/ai.md`'s "Open handoff" and the request to Agent 3 in
   `requests.md`. Not a STUB in the sense of "wrong shape, fix later," the shape is right, the next
   step just doesn't exist to hand off to yet.
