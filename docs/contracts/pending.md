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

6. **Review pass, 2026-08-16.** Ran `/code-review` against the first pass's diff and fixed what it
   found: the `assignMember`/`publishEvent` issues and correctness notes now in `scheduling.md`,
   `getRosterForEvent` and `listEvents` querying more than they needed to (fixed: an `!inner` join
   filter and a batched-not-per-event rewrite, respectively), a `required_people = 0` shift reading
   as understaffed instead of fully covered, the create-event/generate-shifts forms silently using
   the browser's timezone instead of the event's, and `lib/scheduling/authorization.ts` duplicating
   `lib/auth/authorization.ts`'s role gate instead of delegating to it. One item not independently
   verified: `getRosterForEvent`'s new `shifts!shift_assignments_shift_id_fkey!inner(...)` embedded
   filter syntax is standard PostgREST but untested against a live database (no `.env.local` in
   this working directory, see `requests.md`). If it errors at runtime, the fix is almost certainly
   a syntax adjustment to that one `.select()`/`.eq()` pair, not a logic change.

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

5. **`STUB(agent-1)` pill/bento primitives, 2026-08-17.** The UI redesign directive replaced
   neumorphism with the flat black pill/bento language repo-wide (`_shared-context.md`), but Agent
   1 has not published the new `tokens.css`/`components/ui/` as of this commit (no `design(a1)`
   commit on the branch yet, `docs/contracts/design.md` still documents the old neumorphic system).
   Reskinned `src/components/command-palette/command-palette.tsx`,
   `src/components/command-palette/modes/nl-mode.tsx`, `provider.tsx`'s `PaletteTriggerButton`, and
   `src/components/polish/sound-manager.tsx`'s `SoundToggle` against a new local stub,
   `src/components/command-palette/_stub-primitives.tsx`, built from the literal hex constants in
   the shared spec (same pattern as Agent 5's `_stub-primitives.tsx` files, no invented colors).
   Also rewrote `src/components/polish/easter-egg.tsx`'s particle effect from a purple radial burst
   to purple-and-orange capsules raining, per the redesign directive's explicit easter-egg spec.
   Tracking removal: grep `STUB(agent-1)` under `src/components/command-palette/` and in
   `sound-manager.tsx`.

6. **Final integration sweep (redesign directive item 6) not run yet, deliberately deferred.** The
   directive asks Agent 6 to police the new restraint rules (no shadows, no gradients, no
   off-palette colors, max two accents per view, on-accent text on every fill) across all six
   agents' surfaces in a final sweep. As of this commit no other agent has a `design(aN)` commit on
   the branch (checked `git log --all`), so there is nothing yet to sweep; running it now would
   only cover Agent 6's own files, which are self-audited already (two accents max: purple primary
   CTA + orange confidence/gap dots per view, `#0A0A0A` text on every purple/white fill, no
   shadows, no gradients). Re-run for real once `design(a1)` through `design(a5)` land.

7. **Gap analysis, autofill rationale, and presence render surfaces are not mine to reskin.**
   `generateGapHeadlines` and `generateAutofillRationales` are called server-side from inside
   Agent 3's coverage board (`docs/contracts/ai.md`), and `usePresence` (`docs/contracts/
   presence.md`) is explicitly data-only with no owned rendering directory. Verified neither is
   consumed by any component yet (no `usePresence` import, no gap/autofill render, outside
   `src/lib/`). Updated both contracts' guidance to the new convention (orange dot for gap
   headlines and low-confidence flags, presence as an avatar-stack-in-a-pill with a purple live
   dot) so whoever builds the render picks up the current spec, and filed the same in
   `requests.md` addressed to Agent 3. Not a STUB since there's no existing wrong-styled code to
   fix, just contract guidance kept current.

## From Agent 4

Full contract in `docs/contracts/availability.md`. Most of what was expected to be stubbed turned
out not to need stubbing: Agent 2 shipped `recurring_availability_windows`, `claim_shift`,
`claim_swap`, and `swap_requests` well before I got to writing UI against them, so availability
grids (both recurring and per-event), shift signup, and swap request/cancel/claim are all real,
not placeholder. What's left:

1. **Open swap board not built.** `swap_requests` SELECT RLS only allows the requester, claimant,
   or organizer/admin to read a row, so a member cannot browse other members' `open` requests to
   claim them. `app/(app)/swaps` shows the caller's own shifts and own swap requests (both real)
   with an honest "not visible yet" placeholder where the open board would be, rather than a
   misleadingly-empty list. Requested a broader SELECT policy in `requests.md`.

2. **Response 'refused' path from concurrent conflict-engine work not consumed.**
   `app/(app)/shifts`'s inline messages on a blocked "Take this shift" come from `claim_shift`'s
   own exception text (mapped to short strings in `lib/shifts/actions.ts`), not Agent 3's richer
   `lib/scheduling/conflict-engine.ts` messages ("Overlaps your AV shift, 2 to 4pm" style). The
   brief calls for the latter. Not filed as a request since it's a nice-to-have polish pass, not a
   blocker, and Agent 3's conflict engine is organizer-side today (coverage board assignment), not
   yet exposed as something the member-facing signup flow can call pre-flight.

3. **`paintDraft` published, not yet consumed.** Section 3 of `docs/contracts/availability.md`
   documents the exact conversion Agent 6's `availability-parse` module needs
   (`windowsToCells(normalizedWindowsToEventWindows(pairs, event.timezone), spec)`). Not adapted on
   their side yet as of this commit, see their stub note above.

4. **Route group migration done.** Moved `my-schedule`, `availability`, `shifts`, `swaps` from
   `(board)` to `(app)` per Agent 1's request in `requests.md` (dropped the `<AppShell>`/`<AppNav>`
   wrapper, now rely on the real shell's sidebar/top bar/mobile tab bar). `(board)/schedule` and
   `(board)/availability` `.gitkeep` placeholders left in place, not mine to remove, no page ever
   lived at the former and the latter's page moved out from under it.

5. **`GridCell` swapped from a local stub to the real `components/ui/grid-cell`.** No `draft` state
   exists on the real primitive; approximated with `state="partial"`, `coverage=0.3`, and a
   `border-dashed` className override (verified it composes cleanly: border-style and the
   primitive's own border-color utility are different CSS properties). Roving tabindex implemented
   (`tabIndex={key === focusedKey ? 0 : -1}` passed through the primitive's prop spread, confirmed
   it overrides the primitive's own hardcoded `tabIndex` since spread props are applied last in its
   JSX) since a few hundred cells all being individually Tab-stoppable would make the grid
   unusable by keyboard.

6. **No new dependencies added.** Paint interaction built on native Pointer Events (pointerdown/
   pointerenter/pointerup + `touch-action: none`), not `@dnd-kit`: a paint-select grid isn't a
   drag-and-drop-reordering use case, and `@dnd-kit` isn't installed yet regardless (Agent 3's
   request in `requests.md`). Date/time math extends the existing hand-rolled utilities in
   `lib/availability/time.ts` rather than adding `date-fns`.

7. **`.rpc()` typing gap in `@supabase/ssr`'s `createServerClient`, shared finding.** Bare
   `createClient<Database>` (as `lib/supabase/admin.ts` uses) types `.rpc(fnName, args)` correctly
   against `Database["public"]["Functions"]`; the `@supabase/ssr`-wrapped client from
   `lib/supabase/server.ts` does not, `args` resolves to `undefined` regardless of the actual
   function signature (verified empirically, not just theorized: same `Database` type, same
   supabase-js version, only the client-construction path differs). Worked around locally in
   `lib/shifts/actions.ts` and `lib/swaps/actions.ts` with a narrow `as unknown as
   SupabaseClient<Database>` cast at the two `.rpc()` call sites, commented inline. `src/lib/public/
   get-schedule.ts` (Agent 5, `get_public_schedule` RPC) hits the identical error, flagging so they
   don't have to re-diagnose it. Not filing a schema request since `lib/supabase/server.ts` isn't a
   schema change, it's a client-factory type issue; noted for whoever owns that file to decide
   whether to fix at the root (e.g. explicit `SchemaName` type argument) or leave the per-call-site
   workaround as the pattern.

## From Agent 2 (UI redesign pass, 2026-08-18)

Reskinned the notification center (`components/notifications/notification-bell.tsx`,
`notification-list.tsx`) and preferences (`notification-preferences.tsx`) per the pill/bento
redesign directive. Agent 1 had not published the rebuilt primitive library at the time of this
pass (`components/ui/` was still `NeuCard`/`NeuButton`/`NeuToggle`/etc. on the old neu tokens, no
`Card`/`PillButton`/`FilterPill`/`Toggle` exist yet), so this landed as `STUB(agent-1)` per the
established pattern in Agent 5's `components/settings/_stub-primitives.tsx`.

1. **`STUB(agent-1)` hardcoded hexes, not old neu tokens.** `notification-bell.tsx`,
   `notification-list.tsx`, and `notification-preferences.tsx` use literal hex values from the
   redesign brief (`#000000` bg-app, `#131313` bg-card, `#1E1E1E` bg-elevated, `#A78BFA`
   accent-go, `#FF9F2E` accent-warn, `#F5F5F5`/`#9A9A9A`/`#5E5E5E` text tiers, `#0A0A0A` on-accent,
   `rounded-[24px]` for radius-card, `rounded-full` for pills) rather than the old `text-secondary`/
   `bg-bg-surface`/`purple-500` utilities, since those resolve to numerically different colors
   under the still-live old token file. Chose exact-hex-now over token-name-now-wrong-color-later:
   once Agent 1 publishes the real Tailwind aliases, only class _names_ need swapping, not values.
   Where `NeuButton`/`PopoverContent`/`Skeleton` were kept (for their Radix positioning/focus
   behavior), visual overrides on their custom-named radius/shadow utilities (`rounded-neu-sm`,
   `shadow-neu-*`, not part of Tailwind's default scale) use `!`-prefixed classes:
   `tailwind-merge` only dedupes classes it recognizes as belonging to a known value scale, and a
   custom-named theme key isn't in its default list, so a plain override risks losing to cascade
   order. `!important` sidesteps that ambiguity. Tracking removal: grep `STUB(agent-1)`.

2. **`NeuToggle` bypassed, not overridden.** `notification-preferences.tsx`'s toggle is hand-built
   directly on `@radix-ui/react-switch` (`PillToggle`) rather than `NeuToggle` with className
   overrides, because `NeuToggle` doesn't expose its internal `Thumb` as a separate prop, so the
   thumb's checked-state color/position can't be reached from outside. Mirrors Agent 5's identical
   `ToggleSwitch` stub in `components/settings/notification-toggles.tsx`, one hex correction: this
   one uses the published `#A78BFA` (accent-go) directly, Agent 5's uses Tailwind's default
   `violet-500`/`violet-600` (a close but not identical purple). Worth aligning both to whichever
   real `Toggle` Agent 1 ships; flagged in `requests.md`.

3. **Email templates: no change needed.** The redesign brief's email item (align accents, drop
   neumorphic imagery) doesn't apply: `lib/notifications/provider.ts` sends Resend `text` emails
   only, no HTML body exists to reskin, and none was added, since building an HTML template wasn't
   asked for by the original brief either.

4. **Two independent notification-preferences UIs still exist, unrelated to this pass.**
   `components/notifications/notification-preferences.tsx` (this file, redesigned here) is not
   imported anywhere yet, per its own pre-existing doc comment ("not wired into the app shell").
   The live, routed `/settings/notifications` page uses a separate implementation, Agent 5's
   `components/settings/notification-toggles.tsx`. Not this pass's problem to reconcile (routing/
   ownership, not styling), noting it here so whoever wires the notification bell into the app
   shell doesn't rediscover the duplication from scratch.

## From Agent 5 (UI redesign pass, 2026-08-18)

Reskinned every Agent 5 surface (`/s/[token]` and `schedule-view.tsx`, `/api/og/[token]`,
`print.css`, `public-embed/widget.js`, and all of `app/(app)/settings/**` plus
`components/settings/**`) per the pill/bento redesign directive. Same situation Agent 2 and Agent
6 hit: no `design(a1)` commit exists on the branch as of this pass (`tokens.css`/`tailwind.config.ts`/
`components/ui/` are visibly mid-edit in the shared working tree, e.g. a real `shift-capsule.tsx`
already exists, but nothing is committed and `docs/contracts/design.md` still documents the old
neumorphic system), so this landed as `STUB(agent-1)` against the literal hex constants in the
redesign brief, same pattern as everyone else's parallel passes.

1. **`STUB(agent-1)` rewritten, not just re-skinned.** `components/public/_stub-primitives.tsx` and
   `components/settings/_stub-primitives.tsx` no longer export the old neumorphic-ish
   `Slab`/`Well`/`PrimaryButton`/`SecondaryButton` set; they now export `Card`, `PillButton`
   (`primary`/`warn`/`neutral`/`white`/`ghost`/`outline-warn` variants), `TextInput` (pill),
   `FilterPillSelect`, `MonoText`, and (public only) `ShiftCapsule`/`StatusDot`, (settings only)
   `ToggleSwitch`. Every arbitrary-value Tailwind class is a literal, fully-written string, not
   built with `${...}` interpolation: confirmed empirically that Tailwind's static scanner cannot
   see through template-literal interpolation (`` bg-[${x}] `` never generates CSS since the
   scanner reads raw source text, not evaluated JS), so an early draft of this pass that did that
   was rewritten before it shipped. Tracking removal: grep `STUB(agent-1)` under
   `components/public/` and `components/settings/`.

2. **Toggle color already matches Agent 2's flag.** Agent 2's note above (item 2, "Worth aligning
   both to whichever real `Toggle` Agent 1 ships") was about this file's *previous* revision, which
   used Tailwind's default `violet-500`/`violet-600`. The rewritten `ToggleSwitch` in
   `components/settings/_stub-primitives.tsx` now uses the published `#A78BFA` directly, same hex
   Agent 2's `PillToggle` uses. Both still want the same real `Toggle` swap once Agent 1 ships one.

3. **OG image (`/api/og/[token]/route.tsx`) makes its own font choice, independently of Agent 1.**
   `next/og`'s `ImageResponse` (satori) cannot read `src/app/layout.tsx`'s CSS font variables, it
   only sees fonts explicitly passed via the `fonts` option, so this endpoint fetches Space Grotesk
   Bold from Google Fonts at request time (subset to just the event-name glyphs actually used, via
   the `text=` query param) for the "chunky uppercase display heading" requirement, independent of
   whatever display face Agent 1 eventually settles on for the app shell. Fails open: any fetch or
   parse error falls back to satori's bundled default font rather than failing the image. Flagged
   in `requests.md` in case Agent 1's eventual choice differs and this should match it exactly.

4. **Print stylesheet gap, not fixed this pass.** `components/public/print.css` already matched
   most of the redesign brief's print item (black-on-white hairline tables, no shadows) before this
   pass; added a `[data-status-dot]` rule so the on-screen status dot survives the `*` reset. Did
   not implement day-based page breaks ("one page per day" per the brief): `schedule-view.tsx`
   groups shifts by station only, not by day, and building real day pagination is a data-shape
   change to the grouping logic, not a restyle, so it's out of scope for a reskin pass per the
   redesign directive's own "contracts, tokens, and flows unchanged" instruction. Noted in
   `public.md` section 6 as a known gap.

5. **Embed widget: fixed the dead `eslint-disable`, not just restyled.** Agent 3's flag in
   `requests.md` ("Unused eslint-disable directive," the one thing failing repo-wide
   `npm run lint --max-warnings=0`) was verified and fixed: `npx eslint public-embed/widget.js`
   reports 0 errors with no disable comment at all, so the blanket disable was removed rather than
   narrowed.

6. **Mounted `SoundToggle` in Settings > Notifications**, closing Agent 6's open request below.
   Rendered as-is via `import { SoundToggle } from "@/components/polish/sound-manager"`, not
   restyled here: it is Agent 6's file (`src/components/polish/`), not mine to edit, and their own
   redesign pass may already or may soon give it the same treatment.
