# Pending: stubs standing in for unpublished contracts

## From Agent 5 (V4 swap to real primitives, 2026-08-19, resolves the two sections below)

Agent 1 published the real V4 system for real (`bc757bd design(a1): V4 precision-instrument
redesign + motion-spec v4.1`, plus a real `docs/contracts/motion-spec.md`), and Agent 2 published
real `profiles.theme` persistence. `src/components/design-v3/` (the whole local stub: primitives,
motion subset, cookie-based theme mechanism) is **deleted**. Every Agent 5 surface now imports the
real `@/components/ui/*` primitives, the real `@/lib/utils/motion` presets, and the real
`useTheme()`/`ThemeToggle` (Settings' local `settings-theme-shell.tsx` cookie hack is gone,
replaced by the real `profiles.theme`-backed hook). `_stub-primitives.tsx` under both
`components/public/` and `components/settings/` are also deleted, same reason: every primitive they
approximated now has a real counterpart. Tracking removal confirmed empty: `grep -r "design-v3" src/`
returns nothing repo-wide. Verified against the whole repo: `npx tsc --noEmit -p .` shows 7 errors,
all pre-existing and already documented elsewhere in this file (role-enum rename fallout, `notes`-
field gap, two unrelated `.next/dev/types` build artifacts), none introduced or left by this pass;
`npm run lint` (`--max-warnings=0`) is fully clean.

Notes worth keeping from this swap:
- Sign-in is confirmed as the one real call site passing `wash shapes` to `Hero`, matching
  `design.md`'s explicit assignment ("sign-in/join (Agent 5) is the one call site that should pass
  `wash`/`shapes={true}` to `Hero`"). The real `Hero` component takes `children` only, not the
  `title`/`actions` slot API the local stub invented, sign-in's content moved into a small client
  component (`sign-in-content.tsx`) using the real `useHeroEntrance()` hook accordingly.
- Public schedule's "3/5 staffed" headcount ratio now renders through the real `StatusPill`
  (`approved`/`in_approval`/`not_assigned` with a custom `label` override), borrowing the
  approval-state visual language for something that isn't literally an approval state. Works, but
  if a future agent wants a dedicated non-approval-status primitive, this is the one place in
  Agent 5's territory doing that borrow.
- The OG image endpoint's literal hex constants (satori can't consume CSS or React) were quietly
  wrong by one token generation, an earlier pass's approximated purple canvas-tint
  (`rgba(124,92,246,.10)`) vs. the real published value (`rgba(109,74,255,.1)`). Now copied exactly
  from `tokens.css`. Same alignment applied to the PWA manifest/icon routes.
- `roles-table.tsx`'s role dropdown stays hand-rolled rather than `NeuSelect`: the real primitive's
  option type has no per-option tooltip/title field, needed for the disabled "Organizer role ships
  once the schema update lands" state. `NeuBadge` (chip, not status) is used for the role tag
  itself; `StatusPill` covers Active/Inactive, a judgment call documented inline since `StatusPill`'s
  state union doesn't literally name "active"/"inactive".
- Settings had a broader-than-expected cleanup: 14 files (not just the ones known to import the
  stub directly) referenced the now-dead local `--v3-*`/`--v4-*` CSS custom properties that only
  existed inside the deleted local theme root; caught via a full grep sweep before finishing, would
  otherwise have rendered invisible/unstyled text once that root was removed.
- Public schedule's print stylesheet's `[data-status-dot]` rule was rewritten to target the real
  `StatusPill`'s actual DOM structure (it has no `data-status-dot` attribute, that was the local
  stub's own addition), scoped to shift cards specifically.
- `profiles.theme`'s server-side default is still `'light'` (a known, already-flagged Agent 1/2 gap,
  not Agent 5's to fix): a signed-out visitor to the public schedule or sign-in may still see light
  server-rendered until that column default flips.

## From Agent 5 (V4.1 design + motion-spec pass, 2026-08-19, supersedes the V3 pass below)

**Note on sequencing, checked against the branch's actual state before starting this pass:**
Agent 1 has published real V3 glass primitives since the V3 pass below landed
(`components/ui/` now has a real `ThemeToggle`, `AuroraWash`, `FloatShapes`, `Hero`, and glass
`NeuCard`/`Dialog`/`Popover`/`Tooltip`, per `docs/contracts/design.md`'s primitive table and
Agent 4's 2026-08-19 "V3 build, unblocked" note in `requests.md`). That publish does not cover this
pass: `design.md` still describes V3 aurora/midnight glass, not the V4 "precision instrument"
system (flat 10px cards, 6px controls, dark-default, pill-radius-for-avatars-only, dot+text status,
zero glow budget), and there is no `docs/contracts/motion-spec.md` in the repo yet either, matching
exactly what Agent 4 and Agent 6 independently found and flagged the same day (see their
2026-08-19 "V4 design + motion-spec v4.1, blocked on Agent 1's publish" and "motion spec v4.1" notes
below). Same posture as both of them: held a local stub rather than adopting the real (but now
one-generation-behind) V3 primitives, since swapping onto those would visually regress Agent 5's
surfaces to light-default glass, the opposite direction from where this pass needs to land. Will
swap for real imports once a `design(a1)` commit actually describes V4/v4.1, not before.

`src/components/design-v3/primitives.tsx` was rewritten wholesale for this pass (not extended
incrementally on top of the V3 stub, the visual language changed too much for that: no more blur/
translucency anywhere, `aurora.css`'s backdrop-filter fallback deleted as dead code). Kept at the
same file path so every consuming file's import line didn't need to change on top of the JSX
rewrite it needed anyway. Exports were renamed to v4.1-appropriate names rather than kept as V3
aliases (`GlassCard`→`Card`, `PillButtonV3`→`Button`, `v3Palette`→`v4Palette`, `V3Theme`→`V4Theme`,
new `StatusLine` for the dot+text status law, new `Avatar` for the one legitimate pill-radius use).
Implements Section 1 (timing tokens) of the motion spec in full
(`SPRING_SNAP`/`SPRING_STANDARD`/`SPRING_GENTLE`, `EASE_OUT_FAST`/`EASE_OUT_SLOW`,
`STAGGER_TIGHT`/`STAGGER_STANDARD`/`STAGGER_BARS`, `entranceCascade()`, `ENTRANCE_RISE`/
`ENTRANCE_RISE_LARGE`) plus the subset of Sections 2/7 that apply to Agent 5's actual surfaces
(theme-toggle icon rotation + View Transitions crossfade, the status dot/text change atom).
Sections 3/4/6/8/9/10 (dashboard, Gantt, count-up, availability, day-of/kiosk, the delight budget)
describe other agents' surfaces and were not reimplemented here. Verified against the whole repo:
`npx tsc --noEmit -p .` and `npm run lint` (`--max-warnings=0`) both show zero new errors from this
pass; remaining typecheck errors are the same pre-existing, already-documented ones (role-enum
rename fallout, `notes`-field gap) from other agents' in-flight work, unrelated to anything touched
here.

1. **Sign-in keeps the cinematic `Hero` treatment (the one sanctioned exception to "no decorative
   shapes"); `/join/[token]` loses it entirely.** Both flip from V3's light-default to V4's
   dark-default, no toggle on either (still Settings-only). `/join/[token]`'s three server-branched
   states now settle in on `ENTRANCE_RISE`/`SPRING_STANDARD` inside a flat `Card`, replacing last
   pass's hero/aurora treatment; same documented scope limit as before (a settle-in, not a true
   shared-element morph across server branches). `sign-in-cascade.tsx` was deleted, folded directly
   into `page.tsx` via `Hero`'s own entrance-cascade slots to avoid nesting two separate cascade
   containers around the same content.
2. **Public schedule (`/s/[token]`) and OG images: dark-default now too, decorative header wash
   removed, `ShiftCapsule` retired for `ShiftStatus` (dot + mono count, no pill background).**
   Per the "radius-pill reserved for avatars only" and "status is a dot plus text, never a badge"
   laws, the old pill-shaped fill/needed capsule doesn't survive this pass. Search-match
   highlighting moved off the status indicator (which only has three legitimate tones: pending,
   approved, muted, and a search match isn't one) onto the card's own border instead. Print styles
   audited again, no new rules needed, flat backgrounds are trivially stripped by the existing
   universal `@media print` reset.
3. **PWA manifest/icons: dark canvas with a radial purple tint, mark color re-verified by
   computing actual contrast** (`#A78BFA` ≈ 7.2:1 vs. `#0B0A14`, `#6D4AFF` ≈ 3.8:1, confirms why the
   spec itself splits fill-purple from text/line-purple for the dark theme). `sw.js`/
   `pwa-register.tsx` re-confirmed a second time to have no visual surface at all, still correctly
   untouched.
4. **Settings: dark becomes the default theme (real toggle unchanged, still cookie-persisted, cookie
   renamed `v3-theme`→`v4-theme`).** Every pill-radius surface (nav pills, badge-style role/active
   indicators) became flat rows or `StatusLine` dot+text. Applied "one filled primary button per
   view" at the page/panel level, not per-row (a data table's per-row "Save role" action is a table
   control, not a competing page-level CTA); demoted every other secondary action (copy link, send
   test post, search) to a text-link variant. Outlined-orange-pill destructive actions (revoke,
   demote) lost their pill shape too: revoke is now a warn-colored text link, demoting an admin's
   "Save role" is a solid warn fill instead of an outline.
5. **No new dependencies**, same as the V3 pass: `framer-motion` (already present) backs every
   animation here.

## From Agent 5 (V3 pass, 2026-08-19)

No `design(a1)` V3 commit exists on the branch as of this pass (latest design commit is still
`a855052`, the V2 dark flat pill/bento system; `tokens.css` is still `color-scheme: dark` only, no
light/dark split, no `useTheme`, no `AuroraWash`/`FloatShapes`/`Hero`, no v3 motion presets). Same
situation every prior wave in this repo hit against an unpublished contract: built a local
`STUB(agent-1)` layer against the written V3 spec rather than block. New shared file,
`src/components/design-v3/primitives.tsx` (+ `aurora.css`), Agent 5 territory only, holds
everything: `AuroraWash`, `FloatShapes`, `Hero`, `GlassCard`, `PillButtonV3`, `GlassInput`/
`GlassSelect`/`GlassToggle`, `v3Palette`, a minimal `entranceCascade`/`V3_SPRING`/`V3_PILL_TAP`
motion subset, and theme handling (`useThemeV3`, `V3ThemeRoot`/`useV3Theme` context, `ThemeToggleV3`,
`withThemeCrossfade`). Every component takes an explicit `theme` prop (or falls back to
`useV3Theme()` context) rather than reading an ambient global attribute, so swapping this file's
contents for real `@/components/ui` imports once `design(a1)`'s V3 pass lands should be a one-file
change, no call site should need to move. Tracking removal: grep `STUB(agent-1)` under
`src/components/design-v3/`, `src/app/(auth)/`, `src/components/auth/`, `src/components/public/`,
`src/components/settings/`, and `src/app/(app)/settings/`. Verified against the whole repo, not just
Agent 5's own files: `npx tsc --noEmit -p .` and `npm run lint` (`--max-warnings=0`) both show zero
new errors introduced by this pass; the typecheck errors that remain are the exact same pre-existing
role-enum-rename and `notes`-field ones already documented elsewhere in this file, from other
agents' in-flight work.

1. **Sign-in and `/join/[token]`: full `Hero` treatment, light theme only, no toggle** (that's
   Settings-only per the brief). `/join/[token]`'s three server-branched states (invalid/expired
   invite, not signed in, signed in) each settle in with a spring fade/scale via a new small client
   wrapper (`join-panel.tsx`) rather than a true shared-element morph across branches, a real
   cross-branch morph would need converting the flow to client-side state; flagged inline as a
   scope limit, not a silent gap. `ContinueWithGoogleButton`/`JoinWelcomeForm` still render through
   the real V2 dark-system primitives (`PillButton`, `NeuInput`), only their surface color is
   overridden for the light aurora background; swap to real V3 primitives once Agent 1 publishes.
2. **Public schedule pages (`/s/[token]`) and OG images (`/api/og/[token]`): light-only, no
   `FloatShapes`, capped blur.** Per the brief's own "cap blur layers, no floating shapes below the
   header" instruction for this logged-out, must-stay-fast surface: `AuroraWash` only, no `Hero`.
   `components/public/_stub-primitives.tsx` rewritten in place onto the light aurora palette, same
   exported names, zero call-site changes needed beyond direct hex swaps in `schedule-view.tsx`.
   The OG endpoint (satori/`next/og`, no `backdrop-filter` support) approximates glass with a
   translucent white rounded rect over a gradient wash instead, avoided `filter`/`backdrop-filter`
   entirely there as a reliability risk for an unauthenticated image endpoint. `print.css` audited,
   not rewritten: its existing universal `background: transparent !important` reset already
   neutralizes every new glass/gradient background (an `!important` stylesheet rule beats the plain
   inline `style` backgrounds all V3 surfaces use), verified via the cascade rule, not assumed.
3. **PWA (manifest, icons, splash): reskinned to the light aurora look, theme-color is static.**
   `manifest.ts`'s `background_color`/`theme_color` and the three `next/og`-drawn icon routes
   (`apple-icon.tsx`, `icon-192.png/route.tsx`, `icon-512.png/route.tsx`) now use the light aurora
   wash (`#F4F4F7` canvas, `#6D4AFF` mark) instead of flat black. These are all build-time/static,
   so real per-session dynamic theme-color (light manifest while the user is in dark mode) needs a
   runtime `<meta name="theme-color">` write from Agent 1's eventual global `useTheme`, app-shell
   territory, not buildable here; noted inline. `public/sw.js` has no inline offline HTML/CSS at
   all (pure fetch/cache logic), so the brief's "offline shell restyled" item is a no-op, nothing
   visual existed to restyle. `pwa-register.tsx` intentionally untouched: it renders no visual
   output, and its dev-vs-production registration gating is Agent 2's recent load-bearing fix for a
   real reload-loop bug (see "From Agent 2, 2026-08-18" below), correctly out of scope here.
4. **Settings: real light/dark glass, cookie-persisted toggle, not yet `profiles.theme`.** New
   `settings-theme-shell.tsx` (client) reads an initial `v3-theme` cookie value passed down from
   `settings/layout.tsx` (read server-side via `cookies()`, same no-flash pattern as Agent 1's
   `sidebar-collapsed` cookie) and owns the live theme state; `ThemeToggleV3` sits next to
   `SettingsNav`. This is cookie-only, not yet the real `profiles.theme` field the V3 brief calls
   for on Agent 2's side (doesn't exist yet), and it's a single local root, not a global context,
   so it works cleanly across settings pages but doesn't live-sync any other themed page (moot
   today since sign-in/join/public are deliberately light-only). `_stub-primitives.tsx` (settings)
   rewritten in place onto theme-aware glass wrappers, same exported names. `design-v3/
   primitives.tsx` gained real breadth in this sub-pass beyond the initial build (theme context/CSS-
   var cascade so server-rendered settings text can react to one client toggle without prop
   drilling across the RSC boundary, plus `GlassInput`/`GlassSelect`/`GlassToggle` replacing direct
   `NeuInput`/`NeuSelect`/`NeuToggle` imports in settings forms). One known, unfixed seam: Settings
   now renders as a light glass card floating on the still-dark V2 app shell background (`bg-app`
   black), since the shell itself is Agent 1's territory; expected to resolve once Agent 1's real
   V3 pass rolls the aurora canvas out app-wide. `settings/roles/page.tsx`'s pre-existing role-enum
   typecheck error (documented below, "From Agent 2, 2026-08-18 (V2 roles...)") is untouched by this
   pass, same known gap, not introduced or fixed here.
5. **No new dependencies.** `framer-motion` (already a dependency, used by Agent 1's own V2 motion
   presets) backs the float-shape animation and page-load spring settle-ins; no CSS-in-JS or theming
   library added for the cookie-based toggle.

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

**All four items below are resolved as of the V3 pass (2026-08-19), see "From Agent 2 (V3
dual-theme pass)" at the bottom of this file.** Items 1 and 2 are gone: those three files now carry
no colors, no glass, and no hand-built Radix controls at all. Item 3 is superseded: HTML email
templates now exist. Item 4 still stands as a known duplication, now with a recommendation.

1. ~~**`STUB(agent-1)` hardcoded hexes, not old neu tokens.**~~ Resolved 2026-08-19.
   `notification-bell.tsx`,
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

2. ~~**`NeuToggle` bypassed, not overridden.**~~ Resolved 2026-08-19: uses `NeuToggle` directly.
   `notification-preferences.tsx`'s toggle was hand-built
   directly on `@radix-ui/react-switch` (`PillToggle`) rather than `NeuToggle` with className
   overrides, because `NeuToggle` doesn't expose its internal `Thumb` as a separate prop, so the
   thumb's checked-state color/position can't be reached from outside. Mirrors Agent 5's identical
   `ToggleSwitch` stub in `components/settings/notification-toggles.tsx`, one hex correction: this
   one uses the published `#A78BFA` (accent-go) directly, Agent 5's uses Tailwind's default
   `violet-500`/`violet-600` (a close but not identical purple). Worth aligning both to whichever
   real `Toggle` Agent 1 ships; flagged in `requests.md`.

3. ~~**Email templates: no change needed.**~~ Superseded 2026-08-19: the V3 directive asked for
   real templates, so they were built (`src/lib/notifications/email-template.ts`). Original note:
   the redesign brief's email item (align accents, drop
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

## From Agent 3 (UI redesign pass, 2026-08-18)

Reskinned every Agent 3 surface (`components/coverage/coverage-board.tsx`,
`components/shifts/generate-shifts-form.tsx`, `components/events/*`,
`app/(app)/{events,coverage,calendar}/**`) onto the pill/bento redesign. Started this pass against
a local `STUB(agent-1)` primitive set (`components/shifts/_stub-primitives.tsx` +
`_stub-filter-pill.tsx`, same pattern as Agent 5's stub) since `components/ui/` still had only the
old neumorphic primitives when the pass began. Agent 1 published the real
`Card`/`PillButton`/`ShiftCapsule`/`StatBlock`/`FilterPill`/`IconButton` mid-pass; migrated every
consumer to the real primitives and deleted both stub files before finishing, so there is no
`STUB(agent-1)` left anywhere in Agent 3's territory. Notes for whoever touches these files next:

1. **Drag-to-assign shipped.** `coverage-board.tsx`'s old `TODO(agent-1)` ("click-to-select, not
   drag-to-assign") is resolved: roster chips are `@dnd-kit/core` draggables, `ShiftCapsule`s are
   droppables, dropping a chip on a non-full capsule calls the same `assignMember` action the
   click-to-select `AssignPanel` uses. Click-to-select is kept, not replaced, specifically as the
   keyboard-operable path (dnd-kit's pointer sensor has no keyboard equivalent wired up here); both
   paths call the same server action so they can't drift.
2. **Bulk generator is now a dialog with a live preview**, resolving the other old
   `TODO(agent-1)`. `generate-shifts-form.tsx` opens from a primary `PillButton` trigger, previews
   every shift `generateShiftGrid` would create as hollow (`state="empty"`) `ShiftCapsule`s grouped
   by station before anything is written.
3. **New stat row (slots filled, fill rate, open gaps, hours scheduled)** replaces the old thin
   progress bar on the coverage board. Deliberately has no `delta` on any `StatBlock`: the brief's
   reference shows a delta triangle vs. yesterday, but no historical coverage snapshot exists in
   the schema to compute one honestly, and `StatBlock`'s real API has no `tone` prop either (the
   numeral is always `text-primary`, only the delta triangle carries color), so "open gaps" reads
   as a plain count, not an orange number. Fabricating a delta or hand-styling the numeral orange
   would have fought the published primitive; flagging in case a real historical-snapshot table
   ever lands and this is worth revisiting.
4. **Filters (Day, Station) added to the coverage board**, client-side over the already-fetched
   `cells`, no new query. No "Event" filter on this page (the event is already fixed by the route);
   an event-level filter would make more sense on a future combined view, not here.
5. **Fixed a real timezone bug while rewriting `coverage-board.tsx`**: the old `AssignPanel`
   formatted shift times with a bare `Intl.DateTimeFormat` and no `timeZone`, i.e. the browser's
   zone, not the event's, the same class of bug already fixed elsewhere per my own item 6 below.
   Now threaded through as an `eventTimezone` prop and formatted with `formatShiftTime` from
   `lib/utils/format`.
6. **Unified the event status pill.** One of the parallel restyle passes on `events/[id]/page.tsx`
   independently invented a solid-fill status pill (draft as solid orange) instead of reusing the
   real `NeuBadge` outline/tint variants (`warning`/`purple`/`default`) that `events/page.tsx` and
   `coverage/page.tsx` already used. Solid orange for "draft" also collides with orange's
   gap/warning meaning elsewhere on the same board. Replaced with `NeuBadge` everywhere so the
   status color code is consistent across all three list surfaces, matching the original
   pre-redesign `STATUS_VARIANT` mapping (`draft: "warning"`, `published: "purple"`,
   `archived: "default"`).
7. **Week/month calendar view still not built**, unchanged from before this pass, see my item 3
   above in the previous section. Still gated on real calendar-grid composition, not a redesign
   blocker.

## From Agent 5 (V2, 2026-08-19)

Full detail and exact schema shapes requested in `schema-requests.md`, cross-agent notes in
`requests.md`. Summary of what's real vs. stubbed:

1. **Sign-in (`/sign-in`) is real, Google auth itself is not usable yet.** Google-only per the V2
   brief, `ContinueWithGoogleButton` calls the real `supabase.auth.signInWithOAuth({ provider:
   "google" })`. `STUB(agent-2)`: fails until the Supabase project's Google provider has real
   credentials configured (their V2 item 5). The callback route (`src/app/(auth)/callback/
   route.ts`) needed no changes, its generic `exchangeCodeForSession(code)` already handles an
   OAuth code the same way it handles an email-link code.

2. **PWA shell is real**: `src/app/manifest.ts` (native Next.js convention, no edit to
   `layout.tsx` needed for the manifest link tag itself), `icon-192.png`/`icon-512.png`/
   `apple-icon.tsx` (drawn via `next/og` `ImageResponse`, zero new dependency, same technique as
   the OG image endpoint), `public/sw.js` (hand-rolled, no Workbox/Serwist/next-pwa dependency
   added). Known limitation, documented in `sw.js`'s own header comment: only caches real browser
   navigations (app-icon launch, hard refresh), not Next's client-side RSC soft-navigations, so
   offline in-app link clicks between "/" and "/my-schedule" will still fail. Correct full-App-
   Router offline support needs a library; not added without going through the usual
   package-change channel. `<PwaRegister />` and `<InstallPromptBanner />` are built and ready but
   need mounting by Agent 1 and Agent 4 respectively, requested in `requests.md`.
   `<InstallPromptSettingsCard />` is mounted, in Settings > Profile.

3. **`STUB(agent-2)` Discord webhook config.** `src/components/settings/discord-webhook-form.tsx`
   renders the full form (webhook URL, per-kind toggles) but Save and Send test post are disabled
   with an explanatory `title` tooltip, same pattern as V1's disabled "Organizer" role option:
   `org_settings.webhook_url` doesn't exist, nothing to persist to. Tracking removal: grep
   `STUB(agent-2)` in that file.

4. **`STUB(agent-2)` push notifications, partially real.** `src/components/settings/
   push-notification-toggle.tsx`'s browser permission request
   (`Notification.requestPermission()`) is real and only ever fires from the toggle itself, never
   on load, per the V2 brief. What happens after permission is granted is not: no
   `pushManager.subscribe()` call, no persistence, since there is no `push_subscriptions` table and
   no VAPID key. The toggle is honest about this in its own caption rather than implying it's
   fully wired.

5. **`STUB(agent-2)` invite links, functional end-to-end within one dev process.**
   `src/lib/settings/invite-actions.ts` backs Settings > Invites (create/list/revoke, real UI, real
   interactions) and `/join/[token]` (real invalid/expired handling, real Google sign-in hookup,
   real "set your display name" second step writing to `profiles.full_name`) against an in-memory
   `Map`, not the real `invites` table. Explicitly does NOT grant the invite's role on redemption:
   `/join/[token]` shows an honest "role assignment isn't wired up yet" message post-sign-in rather
   than faking a role grant, since that write is Agent 2's `redeem_invite()` per the V2 brief
   ("Redemption endpoint assigns role ... via Agent 2's endpoint"). Tracking removal: grep
   `STUB(agent-2)` under `src/lib/settings/invite-actions.ts` and
   `src/app/(auth)/join/[token]/page.tsx`.

6. **Not started this pass, deliberately deferred: audit log viewer and the public-page
   three-state status update.** Both are fully blocked on schema that doesn't exist yet
   (`audit_log`; the `not_assigned`/`in_approval`/`approved` assignment-state enum). The public
   schedule page's current data shape (`get_public_schedule()`'s filled/needed aggregate, no
   per-assignment state exposed) has no three-state model to render yet, faking one would mean
   inventing a shape that doesn't match whatever Agent 2 ships. Picking both up once `feat(a2)`
   lands.

7. **Existing V1 stub primitives (`components/public/_stub-primitives.tsx`,
   `components/settings/_stub-primitives.tsx`) still not swapped for the real ones**, now doubly
   unblocked since Agent 1's real library is confirmed published and using the identical hex
   values. All new V2 work in this pass (sign-in, PWA, invites, Discord form, push toggle) was
   built directly on the real primitives (`Card`, `PillButton`, `NeuInput`, `NeuSelect`,
   `NeuToggle`) rather than adding to the stub debt; the V1 files are unchanged this pass. Next
   step: swap the ten or so V1 files over, same as noted in the previous section.

## From Agent 6 (V2, 2026-08-19)

Full contract: `docs/contracts/quickchat.md` (new). Summary:

1. **`STUB(agent-1)` fully paid off, no new stub debt.** V1's `command-palette/_stub-primitives.tsx`
   deleted; `command-palette.tsx`, `nl-mode.tsx`, `provider.tsx`'s `PaletteTriggerButton`, and
   `sound-manager.tsx`'s `SoundToggle` all migrated onto Agent 1's real primitives (`Card`,
   `PillButton`, `NeuTabs`, `NeuBadge`, `ShiftCapsule`, `NeuToggle`). Quickchat (new this pass) was
   built directly on real primitives throughout, including the V2 `QuickchatButton`/
   `QuickchatAnswerCard` once Agent 1 published them mid-pass (see quickchat.md's "Primitives and
   motion"). Tracking removal: nothing left to grep, `STUB(agent-1)` no longer appears anywhere
   under `src/components/command-palette/` or `src/lib/quickchat/`.

2. **Quickchat: real data, not stubbed, one honest scope caveat.** All five preset queries compute
   from real, already-published functions (Agent 2's `hours_per_event`/`hours_semester` RPCs,
   Agent 4's `getMemberSchedulePageData`/`getOpenShiftsPageData`), not fixtures. The one caveat:
   every query inherits the "current/default event" scoping those functions already carry
   (`getAvailabilityEventById`'s own doc comment calls this an interim heuristic), so a member in
   more than one concurrent published event only gets the default one's answers. Not filed as a
   schema request, this is Agent 3's multi-event-context item to eventually resolve, not a missing
   column.

3. **Real bug fixed, not mine to have broken.** `src/lib/ai/kinds/autofill.ts` failed typecheck
   after Agent 3's conflict-engine downgrade removed the `blocked` variant from `ConflictCheckResult`
   entirely (V2 shared decision: hard limits are gone). Fixed by deleting the now-meaningless
   `isBlocked` filter and its import; `rankAutofillCandidates` now ranks every candidate, which is
   correct under the new model (nothing is ever excluded, only warned about). Caught by a routine
   `npx tsc --noEmit -p .` before this pass's own changes, unrelated to them.

4. **AI auto-schedule rewiring: nothing to rewire yet.** Verified no UI anywhere calls
   `autofill_rationale` or `gap_analysis` (same finding as V1). The V2 target contract (assignments
   land `in_approval` with `proposed_by: 'ai'`, `RankedCandidate.conflict.reasons` feeds the
   `warnings` column) is documented in `ai.md`'s new "AI auto-schedule, V2 status" section and
   requested from Agent 3 in `requests.md`, since the write path lives in their coverage board.

5. **Palette role-gating: no code change needed.** `CommandContext.role` re-exports `ShellRole`
   (`components/layout/nav-config.ts`), still the pre-rename `"member" | "organizer" | "admin"` as
   of this commit per Agent 1's own V2 note above. This module passes `role` through opaquely, the
   rename will apply with zero edits here once it lands, same as every previous role change this
   project has made. Agent 6 registers no commands itself (self-registration pattern), so "retire
   organizer-gated commands" has nothing to act on in this module either.

6. **`StatusPill` deliberately not used in the NL confirm cards.** Its three states all describe a
   real assignment row; an NL-parsed draft is not an assignment in any state, using it would
   misrepresent "not submitted anywhere yet" as "assignment exists, unfilled." Reasoning and the
   kept alternative (hollow `ShiftCapsule` + orange confidence dot) in `quickchat.md`.

## From Agent 2 (V2 roles/approval/change-requests migration, 2026-08-17/18)

Full contract: `docs/contracts/schema.md`, "V2: roles, approval flow, change requests, events
content, platform." Cross-agent breakage list filed in `requests.md`. Scope calls made this pass,
not asked-for deviations from the shared brief but decisions the brief left implicit:

1. **`shift_assignments.state` is additive, `status`/`origin` are deprecated, not dropped.** Same
   reasoning V1 used for deferring the `board_member` rename: a same-commit removal would strand
   Agent 3's `admin/schedule/review.ts` and every other consumer mid-flight. File a request once
   nothing reads `status`/`origin` anymore and I'll drop them in their own migration.

2. **`hours_per_event`/`hours_semester` are `security definer` functions, not SQL views.** The brief
   said "SQL views or helpers"; views would need their own RLS-equivalent (a `security_barrier` view
   plus row filtering) to let an admin/director read someone else's hours while still restricting a
   plain member to their own — a function with an explicit authorization check inside is the more
   direct way to express that exact rule, and matches every other authority check in this schema
   already being a function, not a view.

3. **No `sendPush()` caller yet.** `src/lib/notifications/push.ts` is a ready-to-call primitive
   (subscribe/send/prune-stale-on-410), but nothing in this codebase decides *when* a 24h/1h reminder
   should fire — that scheduler doesn't exist yet (V1's `reminder24h`/`reminder1h` notification kinds
   were always "stable part to code against," never wired to an actual timer). Whoever builds that
   scheduler calls both `notify()` and `sendPush()` from it. Not blocking Agent 5's PWA work (the
   subscribe/unsubscribe UI and service worker `push` listener don't need the scheduler to exist).

4. **`resolve_change_request`'s `cant_make_time`/`more_hours` kinds have no assignment-mutation
   side effect on approve**, unlike `swap_any`/`swap_with`/`drop`. Resolving them is purely
   informational (the director/admin sees the request, presumably acts on it through the normal
   coverage board, same as they would today). If Agent 3's approval queue wants a different
   affordance for these two kinds specifically (e.g. a "reassign" shortcut), that's UI, not schema.

5. **No dedicated Discord copy for `announcementPosted` in `content.ts`.** That kind never goes
   through `buildScheduleNotificationEmail` (announcements aren't shift-shaped, see
   `createAnnouncementAction`'s own Discord dispatch), so there's deliberately no branch for it there
   to avoid dead code a future reader might think is reachable.

6. **`redeem_invite()`'s role bypass is scoped as narrowly as it could be.** Transaction-local
   (`set_config(..., true)`), one flag (`app_private.system_write`), checked only by
   `prevent_self_role_escalation`. Verified both directions against real Postgres: the function
   grants a role successfully, and a direct unauthorized role write from a non-admin session is still
   rejected exactly as before V2. If a future function needs the same bypass, reuse the flag rather
   than inventing a second one.

7. **Tracking removal: none of this is `STUB(agent-N)`.** Every migration in this batch was written
   against the real, current schema (not a guessed contract) and live-tested against a real local
   Postgres before this doc was written, same verification bar V1 set. There is nothing here waiting
   on another agent to unblock it.

## From Agent 3 (V2 pass, 2026-08-19)

Built the biggest V2 slice: horizontal by-person schedule (the flagship), a 4-way view switcher,
the approval queue, warnings-only conflict engine, and event management additions. Notes for
whoever touches this territory next:

1. **Horizontal schedule shipped as the real thing, not a stub.** `components/coverage/
   horizontal-schedule.tsx`: people as rows, `ScheduleCapsule` (StatusPill-colored) per assignment
   positioned on a real proportional time axis (`components/coverage/timeline-track.tsx`'s
   `TimelineTrack`/`TimelinePill`, a local `STUB(agent-1)` since Agent 1 hadn't published the real
   primitive yet at time of writing, generic enough to also back the semester timeline). Drag a
   capsule to a different person's row to reassign, drag horizontally on its own row to retime
   (15m snap, deadzone under 5 minutes to avoid accidental retimes on a plain click). Both actions
   (`reassignAssignment`, `retimeShift` in `lib/scheduling/actions.ts`) reset the assignment(s)
   back to `in_approval`, matching "every write lands as in_approval." Retiming moves the whole
   shift (time belongs to the shift, not one assignment), so it affects every assignee at once,
   flagged inline in the function's own doc comment, not hidden.
2. **View switcher, URL-held (`?view=person|station|day|list`), all four real.** By person =
   the horizontal schedule above. By station = the v1 coverage board, unchanged mental model,
   internally migrated to read/write the new `state` column so it can't drift from the other three
   views. Day = the same horizontal schedule filtered to one day (reuses it wholesale, "denser"
   falls out naturally from the shorter time range, not a separate implementation). List = a plain
   compact table over a shared `flattenPersonScheduleGrid` helper (`lib/scheduling/data.ts`), one
   row per assignment plus one row per shift with remaining open slots.
3. **Conflict engine downgraded to warnings-only**, per the shared decision. `checkAssignmentConflicts`
   never returns "blocked" anymore (removed the whole variant from `ConflictCheckResult`), both old
   block conditions (overlap, at-capacity) are warning reasons now. This broke `lib/ai/kinds/
   autofill.ts`'s `isBlocked` import (Agent 6's file, not mine to fix); flagged in `requests.md`,
   Agent 6 fixed it themselves within the same session. `assignMember`'s old race-safe
   recheck-and-delete-if-over-capacity block was deleted outright too, it was hard-limit
   enforcement by another name and directly contradicted "nothing blocks."
4. **`publishEvent` decoupled from assignment approval.** V1 conflated "publish this event" with
   "flip its draft assignments to published and notify members"; V2 separates the two entirely
   (event visibility vs. per-assignment approval are independent concepts now), so `publishEvent`
   only flips `events.status` and no longer touches `shift_assignments` or sends per-assignment
   notifications, that's the approval queue's job (`approveAssignments`, wraps the real
   `approve_assignments` RPC, admin-only, matching the RPC's own check). Its return type changed
   from `{publishedAssignments: number}` to `undefined`; verified nothing consumed the old field.
5. **Deleted `lib/scheduling/authorization.ts` outright.** Built a local `requireDirectorOf` stub
   early in this pass (before `event_directors` existed), then discovered Agent 2 had independently
   built the real, canonical version directly in `lib/auth/authorization.ts` (plus a
   `requireOrganizer` alias so my V1 call sites didn't break). Rather than keep two parallel
   per-event-authorization implementations that could drift, deleted mine and switched every call
   site (7 files) to import from `lib/auth/authorization.ts` directly. `assignMember`/
   `unassignMember` still call the page-level `requireOrganizer()` blanket check before they know
   the shift's event id (fetching the shift first would mean an unauthenticated read happens before
   any auth check); the real per-event boundary is Postgres RLS either way
   (`shift_assignments_admin_or_director_update` and siblings), documented as a deliberate,
   narrow gap, not an oversight.
6. **Approval queue, director assignment, and director notes** delegated to parallel builds against
   data/actions I built first (`getApprovalQueue`, `approveAssignments`, `declineAssignment`,
   `getEventDirectors`, `listDirectorCandidates`, `assignEventDirector`, `removeEventDirector`,
   `updateShiftNotes`, all in `lib/scheduling/{data,actions}.ts`). Director notes reuse the
   existing `shifts.notes` column (no new schema needed, it just wasn't exposed by any V2 surface
   yet). Announcements UI calls Agent 2's already-built `createAnnouncementAction`
   (`lib/announcements/actions.ts`, not mine, handles Discord webhook posting itself), only the
   composer/feed UI is mine.
7. **Added `ShiftCell.notes` (and `ShiftForCoverage.notes`), a required field, not optional.**
   Broke two files outside my territory that construct these types directly instead of going
   through my loaders (`src/lib/db/coverage.ts`, a separate typed-client wrapper around my own
   `buildShiftCells`, and Agent 6's `tests/unit/ai-gap-analysis.test.ts` fixture). Both flagged
   with exact one-line fixes in `requests.md`, not touched myself, neither is my file.
8. **Templates (V2 item 6) deferred, not built.** Needs new schema (a `shift_templates` table)
   I can't add myself and was the lowest-priority item in the brief ("a quiet dialog, big
   time-saver", explicitly a nice-to-have). Proposed shape filed in `schema-requests.md`.
9. **Not done this pass:** live drag-and-drop keyboard path for the horizontal schedule (same gap
   V1's coverage board has, click-to-select on `ShiftCapsule`'s `interactive` prop remains the
   keyboard-operable fallback; a real dnd-kit `KeyboardSensor` integration for a 2D
   reassign-and-retime gesture is a bigger unit of work than this pass had room for). Motion
   presets (Agent 1's `fillIn`/`listStagger`/`pageTransition` from `lib/utils/motion.ts`) are not
   yet wired into any of these new surfaces, everything above is static, functionally complete but
   pre-polish; flagging so a follow-up pass knows exactly what's left rather than re-discovering it.

## From Agent 4, 2026-08-19

**V3 directive (aurora glass / midnight glass, motion v3) is entirely blocked on Agent 1's publish.**
`docs/contracts/design.md` and `src/styles/tokens.css` are still the v2 flat black/pill system as of
this commit, no `useTheme`, no glass `Card`, no `AuroraWash`/`FloatShapes`/`Hero`, no
`entranceCascade`/`morphTo`/`drawIn` in `lib/utils/motion.ts`. Per the wave-order rule and the V3
brief's own text ("this lands before other agents restyle"), not hand-rolling glass/gradient/motion
in feature code ahead of that. Filed the API shape I need from `Hero` and a timing question about
`entranceCascade` on server-rendered pages in `requests.md`, addressed to Agent 1.

Exact scope queued for the moment Agent 1 announces readiness, no other prep needed since the v1->v2
migration precedent means `Card`/`StatusPill`/`StatBlock`/`PillButton` restyle in place with zero
call-site changes:
1. `src/components/member/member-schedule-workspace.tsx`: "Upcoming event" card becomes the `Hero`
   mount (dashboard). `StatBlock`s already use the `animated` (countUp) prop, nothing to change there
   beyond whatever visual restyle ships with the primitive itself. `entranceCascade` wraps the four
   regions (hero, stats, timeline row, quickchat) in that order.
2. `src/components/availability/request-change-sheet.tsx`: sheet-open transition swaps to the spring
   preset; kind-selection options become a pill grid (mostly already pills); submit gets the
   button-morphs-to-confirmation treatment.
3. Member-facing event page (inside `src/app/(app)/events/[id]/page.tsx`, currently mid-flight with
   uncommitted changes from another agent per `git status`, not touching until that settles):
   `Hero` on the header, announcements as glass rows with `entranceCascade`, "My hours" as a
   `countUp` `StatBlock`.
4. Mobile bottom tabs are Agent 1's file (`src/components/layout/mobile-tab-bar.tsx`), not mine; my
   only V3 obligation there is verifying blur/scroll performance once Agent 1 ships the glass
   version and falling back to solid on mobile if it jank, per the brief.
5. `src/app/(app)/coverage/[eventId]/page.tsx`, `coverage-board.tsx`, and `events/[id]/page.tsx` all
   have large uncommitted diffs from another in-flight agent pass (per `git status` at session
   start); confirmed not touching any of them until that lands, to avoid stepping on mid-flight work.

## From Agent 2 (V3 dual-theme pass, 2026-08-19)

Delivered the V3 Agent 2 slice: `profiles.theme` plus its read/write helpers, the notification
center and preferences onto Agent 1's primitives, and real HTML email templates. Discord post
format is unchanged, per the directive.

Unlike every prior redesign pass, this one had no `STUB(agent-1)` to write: Agent 1's V3 token
layer, `tailwind.config.ts` alias table, `NeuCard` glass treatment, and `lib/utils/motion.ts`
preset library were already live in the shared working tree, so this pass consumed the real
primitives and semantic tokens throughout. `npm run check:colors` (Agent 1's new hex script)
reports zero violations in `src/components/notifications/`.

1. **Nothing blocked.** No stubs, no invented contracts, no waiting on another agent.

2. **Email templates are the one file in the app with literal hex values, unavoidably.**
   `src/lib/notifications/email-template.ts` inlines the V3 light palette as hex because email
   clients support neither CSS custom properties nor external stylesheets nor class selectors, so a
   token reference has nothing to resolve against in an inbox. Agent 1's `check:colors` scans only
   `src/app` and `src/components`, so it does not fire today; if that scan is ever widened to
   `src/lib`, this file needs an explicit exclusion. Flagged to Agent 1 in `requests.md`.

3. **The dark theme deliberately does not reach email.** A dark-mode member still gets the light
   template. Building a second dark variant would mean either respecting the account preference
   (wrong: people read mail in a different context and often a different app than the one they set
   the preference in) or respecting the client's `prefers-color-scheme` (unreliable: Gmail and
   Outlook.com rewrite colors rather than honoring media queries). The template instead declares
   `color-scheme: light` so those clients stop auto-inverting it, which is the outcome that
   actually matters. Revisit only if members ask.

4. **Duplicate notification-preferences UIs, still unreconciled** (item 4 of the 2026-08-18 section
   above, restated with a recommendation now that both are on real primitives).
   `components/notifications/notification-preferences.tsx` (mine, V3-styled, still imported
   nowhere) and `components/settings/notification-toggles.tsx` (Agent 5's, wired into the live
   `/settings/notifications` route) do the same job against the same table. Recommendation: keep
   Agent 5's, since it owns the route, and delete mine once someone confirms the routed page covers
   every kind in `scheduleNotificationEvents`. Not doing that unilaterally: the deletion is in my
   territory but the decision affects Agent 5's route.

5. **The notification bell is still not mounted anywhere.** `TopBar` has had a `notificationSlot`
   prop since the v2 shell, and `src/app/(app)/layout.tsx` passes `paletteSlot` but not
   `notificationSlot`, so the notification center has never actually rendered for a user. Both files
   are Agent 1's. One-line request filed in `requests.md`.

## From Agent 1, 2026-08-19 (V3: dual-theme aurora/midnight glass, published)

Resolves Agent 4's block above and item 5 just above it. Full detail and reply to both agents:
`docs/contracts/requests.md`, `docs/contracts/design.md` "V3: dual-theme glass". Nothing left
pending on my side for this pass; `check:colors`'s outstanding hits belong to Agents 2 and 5's own
directories, tracked in `requests.md`, not a stub I'm carrying.

## From Agent 6, 2026-08-19 (V3)

1. **Command palette, quickchat, AI reveal restyled onto Agent 1's real V3 glass tokens.**
   `command-palette.tsx`/`provider.tsx` (glass panel, `useEntranceCascade`, spring open, a
   hand-rolled pill mode-switcher with a `layoutId` morph indicator via `MORPH_TRANSITION` since
   Radix `NeuTabs` doesn't do a shared-element underline morph itself), `quickchat-row.tsx`
   (`pillPress`, `MORPH_TRANSITION` pop), `modes/nl-mode.tsx` (untouched, repaints for free via
   the back-compat aliases, exactly as `design.md`'s migration strategy promises). Briefly built a
   local `STUB(agent-1)` CSS-variable approximation before Agent 1's real tokens landed mid-session
   (visible via `tokens.css`/`tailwind.config.ts`/`design.md` going from uncommitted to committed
   while this was in flight); reverted all of it once the real thing showed up rather than
   shipping two parallel token systems. No trace of that stub left in the tree.

2. **New: `src/components/ai/autofill-reveal.tsx` (`AutofillProposalReveal`), not mounted
   anywhere.** `rankAutofillCandidates` (`src/lib/ai/kinds/autofill.ts`) has never had a UI
   consumer; `coverage-board.tsx` doesn't call it. This is the V3 brief's "single most demo-able
   moment" (AI proposals as orange in-approval bars via `useDrawIn`/`drawInDelay`'s 60ms stagger,
   plus a `useCountUp` proposal-count badge), built self-contained per the quickchat precedent so
   whoever wires up an actual autofill trigger can mount it. Ready-to-mount note also in
   `requests.md` addressed to Agent 3.

3. **Fixed two build/test breaks in my own territory, flagged by others, not touched by them:**
   `src/app/api/ai/shift-generation/route.ts` was still gating on the retired `"organizer"` role
   string (`getRoleAuthorization("director")` now); `tests/unit/ai-gap-analysis.test.ts`'s `cell()`
   fixture was missing `notes: null`; `tests/unit/ai-autofill.test.ts`'s first case asserted the
   pre-V2 hard-block behavior (`rankAutofillCandidates` now ranks a self-overlapping candidate as
   a warning, never drops it). All three now typecheck/pass.

Nothing else pending on my side for this pass. `npm run check:colors` findings under
`components/notifications/`, `components/public/`, `components/settings/`, `app/api/og/`,
`app/manifest.ts`, `app/icon-*`, `app/apple-icon.tsx` are Agents 2 and 5's, already tracked in
`requests.md`, not mine to carry.

## From Agent 6, 2026-08-19 (V3 enforcement sweep)

Directive item 4, run once Agents 2 and 5 reported their V3 passes done. Full findings and detail
in `docs/contracts/requests.md`: two real bugs, both Agent 5's `design-v3/primitives.tsx` STUB(agent-1)
never getting migrated onto Agent 1's now-published real primitives (a disconnected `/settings/*`
theme system, and a reintroduced contrast-floor regression on dark-mode primary buttons), plus a
process note to Agent 1 about `check:colors` needing an exemption for OG image/manifest/icon/print
files before it can safely gate `npm run lint`. Reduced-motion, one-hero-per-view, and
entrance-cascade-fires-once all came back clean everywhere a consumer exists. Nothing left for me
to do here until Agent 5 responds; not fixing `design-v3` myself since it's called from directories
I don't own.

## From Agent 4, 2026-08-19 (V3 build, was blocked, now unblocked and shipped)

Built the full V3 scope queued in this file's earlier Agent 4 entry, now that Agent 1's glass/
motion/Hero layer is published (`b2f5b4d`). `npm run build`'s webpack compile, `npm run typecheck`
(net of the pre-existing organizer/director-rename fallout other agents already flagged, untouched
by this pass), `npm run lint` on every file this pass touched, and `npx vitest run` all clean.

1. **Dashboard (`my-schedule`).** `member-schedule-workspace.tsx` converted to a client component
   (needed for the motion hooks and the realtime subscription below; it already received fully
   resolved data as props from the server page, so this is a standard "server page, client
   workspace" split, not a new server/client boundary). The "Upcoming event" card is now `Hero`.
   The whole page cascades in once via `useEntranceCascade` across four regions in order: hero,
   stats, a real personal-schedule strip, quickchat. Replaced the old ad hoc pill-list strip with
   an actual `TimelineTrack`/`TimelinePill` (published to `components/ui/` since my last note, no
   longer the cross-agent-import problem it was), each lane sweeping in via `useDrawIn` (a
   transform-scaled wrapper div, not the pill itself, see the file's own comment: `TimelinePill`
   has no children slot to layer a custom draw-in mask onto, closed API, not mine to edit).
2. **Live approval flip.** Subscribes to Agent 2's `subscribeToShiftAssignments` (already published,
   `lib/db/realtime.ts`) scoped to the member's own assigned shift ids. An UPDATE where the
   assignment flips from not-approved to approved gets a brief `accent-go` ring on its timeline
   pill, real feedback in view rather than requiring a manual refresh; `TimelinePill`'s own
   `tone`-driven background-color transition (already in Agent 1's file) handles the actual
   warn-to-go color crossfade for free. This is a ring, not `fillIn`'s scaleX sweep: `fillIn`
   expects to render its own absolutely positioned inner layer, which again needs a children slot
   `TimelinePill` doesn't have. Flagged the tradeoff in `requests.md` rather than silently
   downgrading it.
3. **State management note, for whoever touches this file next.** This branch's lint config bans
   both "mirror a prop into state via an Effect" (`react-hooks/set-state-in-effect`) and "read or
   write a ref during render" (`react-hooks/refs`), which rules out the usual React-docs pattern for
   "state that mirrors a prop but also needs local overrides" (comparing against a ref of the last
   prop seen, adjusting state during render). Landed on: keep only the realtime overrides as state
   (a small `Map<id, AssignmentState>`), derive the displayed `assignments` array during render by
   merging that map over `data.assignments` via `useMemo`, no ref, no mirrored full-array state.
4. **`RequestChangeSheet`.** Kind picker is a `grid-cols-2`/`grid-cols-3` pill grid instead of a
   vertical list. Entrance now layers a `SPRING_TRANSITION` slide (translate-y) on top of
   `DialogContent`'s own fade, applied to a plain child (not `asChild`: `DialogContent`, Agent 1's
   file, always renders its own Close button alongside children, so Radix's Slot's single-child
   requirement would throw). Submit morphs the button's content into a "Sent" confirmation
   (`AnimatePresence` + `SPRING_TRANSITION`, `motion.div layout` for the width settle), then closes
   on a short delay.
5. **`/my-events` and `/my-events/[id]`, previously scope-cut, built this pass.** New files:
   `lib/member/events.ts` (`listMemberEvents`, `getMemberEventDetail`, published-events-only,
   reuses `getMemberSchedulePageData` for the per-event assignment/hours query rather than
   re-deriving it, filters to `state === "approved"` for the "approved-only schedule" scope note),
   `components/member/member-events-list.tsx` (glass card grid, `entranceCascade`),
   `components/member/member-event-detail.tsx` (`Hero` header with description, a `countUp` "My
   hours" `StatBlock`, day-grouped approved schedule, read-only announcements with a nested
   `entranceCascade`). Not reusing Agent 3's `AnnouncementsFeed`: it ships its own compose box tied
   to `createAnnouncementAction`, which would either need an authorization check duplicated here or
   render a compose UI to members who can't use it; wrote a small read-only rows list instead.
   Route isn't in the nav yet or in `protectedRoutePrefixes`, both flagged in `requests.md`
   (Agent 1, Agent 2 respectively); the page itself still gates via `requireAuthenticatedUser()` and
   a 404 for a non-published event id, so this is defense-in-depth only, same shape as the
   `/approval` gap Agent 3 flagged earlier.
6. **Fixed a stale test, found while typechecking this pass.** `tests/unit/member-schedule-data.
   test.ts` predated the V2 rewrite entirely (asserted the old `status: "draft"/"published"` field
   and a `schedule_publications`/`data.publication` concept that `getMemberSchedulePageData` no
   longer has, current implementation reads `state: "in_approval"/"approved"` and has no
   publication concept at all). Confirmed via `git stash` that these failures pre-date this pass
   (not something introduced here), but it's my own file testing my own module, so rewrote it
   against the current implementation rather than leaving it red. All 25 tests in the three
   `tests/unit/*` files this pass touches or is adjacent to now pass.
7. **New file: `lib/member/schedule-helpers.ts`.** Split the pure, I/O-free pieces
   (`getMemberScheduleSummary`, `groupMemberAssignmentsByDay`, and their supporting types) out of
   `lib/member/schedule.ts`, which has `import "server-only"` at the top of the whole file. That
   guard makes every export unusable from a "use client" component regardless of whether the
   specific function does I/O, which broke the production webpack build the first time
   (`member-event-detail.tsx`, then `member-schedule-workspace.tsx`, both need these pure functions
   client-side). `schedule.ts` re-exports both names unchanged, so its existing server-side callers
   and the test suite above didn't need any changes.
8. **Not done this pass, real gaps:** no keyboard/dnd-kit path for the `TimelineTrack` schedule
   strip (click-to-select isn't wired there either, `TimelinePill`'s `onClick` prop exists but isn't
   used here yet, same class of gap Agent 3 already flagged for the coverage board and horizontal
   schedule). `RequestChangeSheet`'s "sheet" framing is still a centered `Dialog`, not a true
   edge-anchored sheet, since no `Sheet` primitive exists in `components/ui/`; the spring slide
   approximates it without one, not requesting a new primitive since the approximation reads fine.
   Mobile blur/scroll performance verification (my directive's item 5) not done: needs a real
   mid-range device or throttled profiling, not something to fake from a typecheck/lint/build pass.

## From Agent 4, 2026-08-19 (V4 design + motion-spec v4.1, blocked on Agent 1's publish)

Entirely blocked, same as the V3 block earlier in this file: `docs/contracts/design.md` is still
V3 glass, `docs/contracts/motion-spec.md` does not exist yet, `src/styles/tokens.css` has none of
the new v4 tokens (`--canvas`, `--card`, `--elevated` at the new dark-purple values, `--radius-card:
10px`, `--radius-control: 6px`), and `lib/utils/motion.ts` has none of the v4.1 spring tokens
(`spring-snap`/`spring-standard`/`spring-gentle`) or named patterns (FLIP view-switch, shared-element
morph rules, the status-change atom, drawIn's new stagger-bars cadence). Not hand-rolling any of it
ahead of Agent 1's publish, per the wave-order rule and the spec's own division of labor.

Queued scope for the moment it lands, filed here so there's nothing to re-derive:
1. **`my-schedule` dashboard.** Structural layout (hero, gradient Ask-prog-style panel, three stat
   cards, timeline) stays: motion-spec.md section 3 describes this page's existing V3 shape almost
   exactly. What changes is the visual language (10px cards, dot-plus-text `StatusPill` restyle,
   mono mono numerals, zero glow outside the one gradient panel) and the entrance timeline (exact
   millisecond sequence in section 3, replacing `entranceCascade`'s 40ms stagger with the new
   staggered/timed sequence). The "Ask prog" gradient panel itself is Agent 6's territory (it's
   the evolution of quickchat), I only mount it via `QuickchatRow`, same as today.
2. **Personal schedule strip (`TimelineTrack`/`TimelinePill`).** Section 4's Gantt choreography
   (drawIn from each bar's own start-time origin, `stagger-bars` at 28ms, capped at 24 bars) applies
   here too, once `TimelineTrack`'s closed API (still no children slot, confirmed in my last pass)
   gets whatever update Agent 1 ships for it, or I re-confirm the transform-scaled-wrapper
   workaround still satisfies "animate only transform and opacity" (law 1) with the v4.1 spring
   values swapped in.
3. **Realtime approval flip.** Section 7's status-change atom (dot crossfades 200ms, text does a 6px
   vertical slot-machine slide, a single 500ms hairline glint sweep on the member's own row) replaces
   my current `accent-go` ring treatment, once the atom's building blocks (a slot-machine text swap
   helper, a glint sweep preset) are in `lib/utils/motion.ts`. My `subscribeToShiftAssignments`
   wiring from the V3 pass stays as-is, only the visual response to the event changes.
4. **`RequestChangeSheet`.** Pill grid becomes plain hairline-outlined chips per the new status/chip
   rendering rules (no stadium shapes outside avatars). Submit-morph-to-confirmation already uses
   `SPRING_TRANSITION`; swapping that constant for `spring-snap` once published is a one-line change,
   not a restructure. The "sheet sliding on the spring" framing note from my V3 pass still applies:
   no `Sheet` primitive exists, still approximating with a spring-driven translate on a plain child.
5. **`/my-events` list and detail.** Card grid restyles to 10px cards with hairline dividers (no
   `interactive`-prop hover-lift glow per the new zero-glow-by-default rule, motion-spec.md doesn't
   list a hover pattern for plain browse cards, will ask if Agent 1's publish doesn't cover it).
   Announcement rows' `entranceCascade` becomes whatever list-stagger token fits (`stagger-tight` at
   24ms reads closer to "table rows/checklist items" than `stagger-standard`, worth confirming
   against Agent 1's implementation once it exists rather than guessing now).
6. **One open question for whenever this unblocks, not urgent:** law 6 ("lists longer than 30 items
   do not stagger; the first 12 cascade, the rest appear with them") has no obvious owner between
   the primitive (`useEntranceCascade`/its v4.1 successor could cap internally) and the caller (each
   feature agent could slice its own list before mapping). Whichever Agent 1 picks, I'll match it
   rather than build a third convention; not blocking on this, just flagging before I guess.

## From Agent 6, 2026-08-19 (motion spec v4.1 landed)

The pasted "PROG SCHEDULER MOTION SPEC (v4.1)" plus a new v4 design system (dark-default
"precision instrument," replacing V3's aurora glass) arrived for all six agents. Nobody has
published anything for it yet: no `docs/contracts/motion-spec.md`, no v4 token values in
`tokens.css`/`tailwind.config.ts`, `design.md` still describes V3.

Split my own response in two, learning from the V3 cycle where guessing Agent 1's color/class
naming meant a full throwaway restyle once they published for real:

1. **Color tokens: holding.** Not touching my three surfaces' color classes until Agent 1 publishes
   the real v4 palette (`--canvas`, `--card`, status-dot-not-badge rendering, `radius-card: 10px`,
   `radius-control: 6px`, etc.). Guessing here is exactly the wasted work from last time.
2. **Motion: applied now.** Unlike colors, the spec's timing tokens (section 1) are literal numbers,
   not names to invent, so there's no guessing risk. Added `src/lib/design-stub/motion-v4.ts`
   (`STUB(agent-1)`, exact spring/stagger/easing values from section 1, plus a `useReducedTransition`
   helper for law 5 and a `staggerDelay` helper for law 6's 30/12 cascade cap) and applied it to all
   three of my owned surfaces:
   - Command palette: scrim fade 120ms, panel scale 0.98-to-1 plus 6px rise on spring-standard,
     results cascade on stagger-tight capped at 8 (section 2's palette-specific override of law 6's
     general cap), selection highlight now slides between rows via `layoutId` instead of toggling
     background per row, closing collapses 0.85 scale-fade in 100ms (required restructuring the
     component around `AnimatePresence` instead of an early `return null`), mode tabs now render as
     a sliding underline on spring-snap instead of a filled pill (matches "Mode tab underline
     slides," not the old filled-pill morph).
   - Quickchat: implemented the literal shared-element morph section 5 calls for ("Quickchat chip to
     its answer card... and back"), previously an explicit non-goal on my side (see the V3-era note
     this replaces): each chip now shares one `layoutId` across its collapsed and expanded render,
     so the tapped chip's own bounding box grows into the answer card in place, `layout` on the row
     springs sibling chips out of the way. Answer text fades in as one 120ms block, no typewriter.
   - `AutofillProposalReveal`: cascade now capped at 24 (section 9) with `STAGGER_BARS_MS` (28ms,
     was 60ms under the old V3 spec), and the proposal-count badge now rolls up only once the last
     bar's draw-in animation completes (`onAnimationComplete`), not on mount, matching "as the last
     bar lands, the approval queue badge rolls up its count." Still not mounted anywhere (see prior
     note); still scoped to one gap's candidate list, not "bars onto the Gantt," since that spans
     Agent 3's coverage board, filed as a cross-agent note in `requests.md`.

`npm run check:colors` still exists and still gates on the *old* V3 hex values it happens to also
flag (nothing in it is v4-aware yet, it just flags any raw hex/rgb outside owned directories,
which is still correct). Typecheck, lint, and the two AI unit tests all clean on this pass.

## From Agent 2 (motion spec v4.1, 2026-08-19)

My animated surface under this spec is exactly one: the notification center (section 2,
"Notification panel"). Email templates and Discord posts have no motion by definition, so items 2
and 4 of the V3 directive have no v4.1 follow-up. Nothing here is blocked; four preset-layer gaps
are filed to Agent 1 in `requests.md` and each call site carries a greppable `MARK(agent-1 v4.1)`.

**Applied.**

1. Panel slides 16px from the right edge on the shared spring; the fade comes from
   `PopoverContent` itself rather than being applied twice.
2. Rows cascade at stagger-tight (24ms), down from the 40ms stagger-standard they used in V3.
3. Bell tilts 8 degrees and returns, once per arriving batch, silent under reduced motion.
4. The unread dot fades over 200ms on read instead of switching between frames (section 7: reading
   is a state change, not an entrance). Opacity, not a background swap, per law 1.

**A law 2 violation this pass found and fixed, worth reading if you own a panel that refetches.**
Opening the panel set `loadState` back to `"loading"`, which unmounted `NotificationList` and
remounted it when the refresh resolved. The row cascade therefore ran twice on every single open:
once when the panel mounted, again when the background refresh landed. It looked like a stutter and
read as a bug, and it is precisely the "entrances fire once per navigation, never on a data refresh"
law. The skeleton is now a first-load-only state: once rows exist they stay on screen through every
refresh, the cascade root stays mounted, and only genuinely new rows animate in. A failed background
refresh now keeps the working panel instead of replacing it with an error card.

Any surface that shows a skeleton on refetch has this bug. It is invisible in code review because
nothing about the animation is wrong; the remount is.

**Deliberate omissions, so they do not read as oversights.**

1. **No count-up on the bell badge.** Section 6's count-up is for stat numerals. The tilt already
   marks the arrival, and rolling digits inside a 16px chip would be a second animation for one
   event. The badge swaps instantly.
2. **`notification-preferences.tsx` gets no choreography.** It is still not routed anywhere (the
   live `/settings/notifications` renders Agent 5's `notification-toggles.tsx`), and I recommended
   deleting it in the V3 pass. Adding motion to a component I have recommended removing is work
   with a negative expected value. It stays static until that call is made.
3. **No delight moment.** Section 10's list is closed and none of the four are mine. A notification
   arriving is routine, and the tilt is feedback, not celebration.

**One motion rule of this surface is unit tested** (`tests/unit/notification-center.test.ts`).
`isArrivingBatch` in `components/notifications/utils.ts` decides whether an unread-count change is
an arriving batch. It lives outside the component because all four of its branches are behavioral
rules Agent 6's sweep enforces (no tilt on first load however large the backlog, one tilt per batch
rather than per notification, nothing on an unchanged count, nothing when the count drops), and a
wrong answer there is silent rather than visible. The rest of the surface's motion is variants and
transitions, which are not meaningfully unit testable; those need the reduced-motion emulation flag
per law 5, listed in my verification notes.

## From Agent 1, 2026-08-19 (V4: precision instrument + motion-spec v4.1, published)

Resolves Agent 4's and Agent 6's V4 blocks above and Agent 2's four preset-layer gaps. Full detail
and per-agent replies: `docs/contracts/requests.md`, `docs/contracts/design.md` "V4: precision
instrument", `docs/contracts/motion-spec.md` (new). Also fixed in this pass, not previously
pending anywhere but worth a note here: `get-shell-session.ts`'s stale `board_member` mapping
(`ShellRole` now says `"director"`, matching the landed migration) and two missing `NAV_ITEMS`
entries (`/approval`, `/my-events`).

**Known gap, filed as a request, not fixed here:** `profiles.theme`'s column default and Agent 2's
`DEFAULT_PROFILE_THEME` are both still `'light'`, a V3 leftover now that V4 makes dark the default.
Not my migration to write; every signed-in member and signed-out page server-renders light until
Agent 2 flips it.

Nothing else left pending on my side for this pass.

## From Agent 6, 2026-08-19 (V4 real preset layer landed, stub retired)

Agent 1 published the real V4 tokens and `docs/contracts/motion-spec.md`'s preset layer
(`bc757bd`) mid-session, same pattern as the V3 cycle. Deleted `src/lib/design-stub/motion-v4.ts`
and rewired all three of my surfaces onto the real exports:

- Command palette: `SPRING_SNAP`/`SPRING_STANDARD`/`STAGGER_TIGHT` from `@/lib/utils/motion`
  replace my stub's copies. Kept a local `reducedMotion ? { duration: 0 } : SPRING_X` fallback for
  the two raw-constant usages (panel scale+rise, selection/underline slide) since there's no named
  hook for that exact shape, matching the same idiom the real file itself uses internally.
- Quickchat: now uses the real `MORPH_TRANSITION` plus `MORPH_TEXT_INCOMING` (the real midpoint
  text-crossfade variant, section 5) for the answer card's label/text reveal, replacing my
  hand-rolled duration/delay pair.
- `AutofillProposalReveal`: switched to the real `useDrawIn`/`drawInDelay` (28ms default, matches
  section 9 exactly) instead of my local copy. Also added `shadow-glow`, since `design.md`'s "Glow
  budget" section explicitly names "the AI reveal moment" as one of exactly two glow-exempt
  surfaces and calls it out as my territory.

No color-class changes needed anywhere, confirming the V3-cycle lesson held: every existing
`bg-surface-card`/`text-text-secondary`/`rounded-pill`/etc. class already repaints onto V4's
dark-default palette automatically per the migration strategy. Typecheck, lint, `check:colors`, and
the two AI unit tests all clean.

## From Agent 4, 2026-08-19 (V4 precision instrument + motion-spec v4.1, built)

Built the full queued scope from my earlier V4 block, now that Agent 1's token layer, primitives,
and the v4.1 motion preset library are published (`bc757bd`). Two cross-agent asks filed in
`requests.md` (a `TimelineTrack` today-line/marker animation request to Agent 1, a `QuickchatRow`
chip-cascade timing request plus a stale-stub-import note to Agent 6), neither blocking.

1. **`my-schedule` dashboard, rebuilt to motion-spec.md section 3's exact sequence,** not the
   generic 40ms `useEntranceCascade` stagger V3 used. Every element now gets its own explicit delay
   against a single 0ms baseline (title/date fade at 0ms, `Hero` via `useHeroEntrance()` at 60ms, the
   new `GradientPanel`-wrapped "Ask prog" panel at 140ms, three stat cards at 180/220/260ms via
   `useMotionPreset()`'s entrance-rise, the timeline card at 320ms), rather than a uniform
   container/item stagger, since the spec's timings aren't evenly spaced. Moved the page-level
   `<h1>My schedule</h1>` + description out of `my-schedule/page.tsx` (a server component with no
   entrance choreography of its own) and into the workspace component, since section 3's "0ms: page
   title and date fade in" needs to be a `motion` element and the workspace is the client boundary;
   `page.tsx` now only renders the async-redirect success/error banner and mounts the workspace.
2. **Count-up timing fix.** `StatBlock`'s `useCountUp` starts rolling the instant it mounts,
   independent of its parent `motion.div`'s visual entrance delay (a Framer `transition.delay` never
   gates when child effects run), so the "Hours for next event" numeral was finishing its roll while
   still invisible behind the card's own fade-in. Added a small local `useRevealAfter(ms)` hook
   (gates the value passed to `StatBlock` behind a `setTimeout` matching the card's own 220ms
   entrance delay, collapses to immediate under reduced motion) so the count-up visibly starts "the
   frame its card lands," per the spec's own wording. Not adding this to `lib/utils/motion.ts`: it's
   sequencing glue specific to how this one page composes cards and delays, not a general preset.
3. **Real `useCountdown` for "Next shift."** Replaced the old hand-rolled
   `setInterval`-via-`Date.now()`-on-every-render `formatCountdown` with Agent 1's
   `useCountdown(targetEpochMs)`, which owns the once-per-second tick and the `isFinalMinute` flag;
   paired `isFinalMinute` with a plain `transition-colors duration-1000` class swap to
   `text-accent-warn` in the final 60 seconds, exactly per section 6.
4. **Approval-flip glint replaces the old ring hack.** V3's `ring-2 ring-accent-go/60` on
   `TimelinePill` (a workaround for the primitive having no `fillIn`-style inner layer) is now the
   real motion-spec.md section 7 pattern: `GLINT_KEYFRAMES`/`glintTransition(500)` (the
   self-approval duration, distinct from the 300ms "someone else changed this" case, which I don't
   have a surface for yet since nothing else on this page shows another member's assignment) render
   a full-width hairline sibling under the affected `TimelinePill`, matching the spec's own wording
   ("the row's hairline glints once") rather than clipping to the pill's bounds, which its closed API
   doesn't support anyway.
5. **Bar draw-in capped at 24 and re-anchored to the timeline card's own landing time.** Per section
   4's "capped at the first 24 bars" (via `drawInDelay`'s own doc comment: clamp the index yourself)
   and section 3's implication that bars sweep in once their containing card has actually arrived,
   not from t=0 while the card is still invisible: each lane's delay is now `320ms +
   drawInDelay(min(index, 24))`, not just `drawInDelay(index)`.
6. **`/my-events` list and per-event announcements switched to `useCascadeItem()`.** Both lists
   (a semester's published events, a single event's announcement history) can plausibly exceed 30
   rows over time, so law 6's cap now applies; the outer four-section `MemberEventDetail` cascade
   (never more than four sections) correctly stays on the unbounded `useEntranceCascade`. Also
   dropped `Hero`'s now-inert `shapeCount` props on both the dashboard and the event header: V4
   defaults `shapes`/`wash` to `false` (illustration system narrowed to sign-in only), so passing a
   shape count with no `shapes={true}` had no effect either before or after this pass, just noise.
7. **Availability delight moment (section 8 + delight budget item 1), built new, no schema
   needed.** `AvailabilityManager`'s "✓ Saved" text is now a real drawn checkmark (`motion.path`
   `pathLength` 0 to 1 over `EASE_OUT_SLOW`'s 240ms, matching section 8's "the save tick draws its
   checkmark path over 240ms" exactly). First-ever submission is derived from a real server fact
   already in hand rather than a new persisted flag: `initialCells.size === 0` at mount (the member
   genuinely had zero windows for this event when the page loaded) gates a one-time 600ms expanding
   hairline ring on the first successful save that leaves that state, guarded by a ref so a second
   save later in the same session doesn't replay it. Considered a `profiles` boolean for a true
   "once per account, ever" (the mount-time check only proves "first time this session," not
   lifetime, if the member submits, clears everything, and submits again before their next server
   round trip) but didn't request one: this is a delight cosmetic, not data-critical, and the
   mount-time-empty heuristic already covers the overwhelmingly common real case correctly without a
   schema request for a nice-to-have, same judgment call Agent 1 made for the sidebar-collapsed
   cookie in the V2 pass.
8. **Not done this pass, real gaps:** the two `TimelineTrack`/`QuickchatRow` internal-animation asks
   above (today-line draw, chip cascade) are blocked on the owning agents, not attempted from
   outside their closed primitives. Section 8's "paint: cells fill with a 90ms scale-from-0.6 pop"
   and "class-block locked cells" tilt-refuse are not built: the former needs a change inside
   `MatrixDot` (Agent 1's primitive, currently a plain CSS `scale-110` transition, not the spec's
   pop-from-0.6 shape) which I didn't request since it's a small polish item, not filed as urgent;
   the latter has no underlying feature in this codebase at all (no "class-block locked cell"
   concept exists anywhere), not fabricating a new feature to hang an animation off of. Mobile
   blur/scroll performance verification from the V3 pass is still outstanding, unchanged this pass.

## From Agent 2 (2026-08-20): the invite STUB is resolved, and the Map is gone

`src/lib/settings/invite-actions.ts`'s `STUB(agent-2)` ("no `invites` table yet ... backed by an
in-memory Map ... redemption is intentionally NOT implemented here, that is Agent 2's endpoint") is
closed on both counts.

- The real implementation lives in `src/lib/invites/data.ts` (Agent 2). `invite-actions.ts` is now
  thin `"use server"` wrappers over it, keeping every exported name, type, and import path the panel
  and join page already use — `InviteSummary`, `InviteRole`, `createInviteAction`,
  `listInvitesAction`, `revokeInviteAction`, `getInviteByTokenAction`, `completeJoinWelcomeAction`.
  No consumer changed. `InviteRole` is now the `app_role` enum type rather than a hand-written union
  of the same three strings.
- The Map mattered more than it looked. On Vercel each serverless instance holds its own, so an
  admin could create a link on one instance and the recipient would land on another and be told the
  link was invalid. That was survivable while invites were a nicety; it is not now that an invite
  link is the only way into the app.
- `/join/[token]` redeems for real. It reads auth through the new
  `getPendingUserContext()` rather than `getAuthenticatedUserContext()`, because a brand-new account
  is `is_active = false` until redemption and every other auth helper reports a pending user as
  signed out — using one of those there renders a "Continue with Google" button to someone who is
  already signed in, which loops through Google back to the same screen forever.
- Redemption happens on render, not behind an "Accept" button: the click that arrived is the
  acceptance (same shape as an email verification link), and `redeem_invite()` is idempotent per
  caller so a reload or React double-render is harmless.

`getInviteByTokenAction` returns real `role`/`eventId` and neutral placeholders for the rest of
`InviteSummary` (`expiresAt: null`, `maxUses: null`, `usedCount: 0`, `createdAt: ""`). Those fields
are admin bookkeeping and the caller is unauthenticated; the join screen reads neither. If a future
pass wants to show a visitor "3 of 5 spots left", that is a policy decision about what a stranger
holding a token may learn, not a wider `select`.

**For Agent 5:** two copy details on your screens are now slightly behind the behaviour, both minor,
both yours. `/sign-in`'s inactive message reads "Your account is inactive. Contact an admin." — for
the common case (someone who signed in without an invite) something closer to "You need an invite
link to join, ask an admin for one" would be truer. And `components/settings/invite-links-panel.tsx`
asks for a director invite's event as a pasted UUID; an event picker would be the obvious
improvement now that the flow is real.

**Also changed, one line, mine:** `getPostAuthPath()` returns `/coverage` instead of `/admin` for
admin and director. `/admin` is the retired V1 command centre (dead design system, hardcoded to
"HackLanta II · October 9-11, 2026") and was the first screen an admin saw after signing in. The
tree is still routable; it is just no longer the front door. Whoever ports the useful parts of
`/admin/*` onto V4 can delete it.
