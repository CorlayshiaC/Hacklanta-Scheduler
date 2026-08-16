# Cross-agent requests

Requests for a change in territory you do not own. Append with your agent number and target file, do not edit
another agent's request. The owning agent resolves it (strike through with `~~text~~` plus a one-line resolution)
when done.

## From Agent 1, 2026-08-16

**To: whoever owns `src/lib/auth/` (touches Agent 2's territory, `middleware.ts` and `src/lib/auth/authorization.ts`
are not in Agent 1's owned directories)**
`middleware.ts` locally re-declares `MiddlewareProfile.role: "admin" | "board_member"` instead of importing the
`app_role` type, and its admin-route gate (`role !== "admin"`) has no branch for `organizer`. This needs to move in
lockstep with the `app_role` schema change requested in `docs/contracts/schema-requests.md` item 1, including a
decision on whether `organizer` gets access to `/admin/*` routes or gets its own protected prefix.

Second, narrower gap in the same file: `protectedRoutePrefixes` does not include `/swaps` (the sidebar nav I'm
publishing below links to it as a member surface). Requesting it added alongside the `/settings` addition Agent 5
already requested below.

**To: Agent 3 (Shift Engine) and Agent 4 (Member Surfaces), once the primitive library and app shell below are
published**
Note: my brief said `app/(shell)/`, but Agent 5's already-committed docs (`public.md`, `pending.md`) reference
`app/(app)/settings/...`, so the shell layout lives at `src/app/(app)/layout.tsx` instead, matching what's already
load-bearing in their contracts rather than forcing a rename on their side. Purely a route-group label, does not
affect URLs.

The app shell supplies sidebar/top bar/mobile tab bar chrome, so the per-page `<AppShell><AppNav .../>` wrapping in
`src/app/admin/*/page.tsx` and `src/app/(board)/my-schedule/page.tsx` is now redundant (it will double-render chrome
once your pages move under the shell). When you next touch those pages:
1. Move them under `src/app/(app)/` (route groups do not affect URLs, so this is a pure relocation: `src/app/
   admin/**` to `src/app/(app)/admin/**`, `src/app/(board)/**` to `src/app/(app)/(board)/**`, or rename `(board)`
   to something role-neutral per `docs/audit.md` cross-cutting finding 3, your call since you own that content).
2. Drop the `<AppShell>` / `<AppNav>` wrapper, the per-page header/branding block, and the `<SignOutButton>`
   placement, the shell now provides all of that plus the sign-out control in the top bar.
3. Swap `hl-*` classes and inline `ink`/`muted`/`signal`/`warning`/`danger` colors for the tokens and primitives in
   `docs/contracts/design.md`.
`src/components/layout/app-shell.tsx` and `app-nav.tsx` are left in place (not deleted) specifically so this move
does not break your build before you get to it. Delete them once every page that imports them has migrated.

**To: whoever owns `src/lib/notifications/content.ts`**
Real bug independent of the rebrand: every subject line is hardcoded to `"HackLanta II"` (lines 48, 72, 80, 95) even
though the function already receives and correctly uses `input.eventName` in the body. Subject lines silently ignore
their own parameter, any other event's notification would still say "HackLanta II" in the subject today.

**To: whoever owns `src/lib/scheduling/` and `src/lib/availability/`**
`findOverlappingWindow` (`src/lib/availability/validation.ts:94`) and `windowsOverlap`
(`src/lib/scheduling/recommendations.ts:63`) independently implement the same interval-overlap check. Worth
consolidating into one shared time utility when you generalize these files, flagging so it doesn't get missed.

## From Agent 5, 2026-08-16

(Restored: this section was briefly overwritten by a concurrent edit to this file. No content lost, recovered from
git history at commit 903f286.)

**To: whoever owns `src/lib/auth/route-protection.ts`** (same file Agent 1 flagged above, adding a second, narrower
need)
Not currently in `protectedRoutePrefixes` (`/admin`, `/my-schedule`, `/availability`, `/schedule`, `/working-now`),
so `app/(app)/settings/*` is unauthenticated today. Requesting `/settings` added to that list. Additionally,
`settings/roles` and `settings/organization` are admin-only screens; requesting either a second route-matcher
helper for those two prefixes or extending `isAdminRoute` to also match them. Until this lands, both pages
perform their own server-side `requireAdmin()` check as defense in depth, not blocking.

**To: whoever owns `src/lib/env.ts` / `src/lib/env.server.ts` / `.env.example`**
Requesting `NEXT_PUBLIC_SITE_URL` added. Needed for absolute URLs in OG image metadata (`og:url`, `twitter:image`
need a full origin, not a relative path) and the "copy link" share action (`${SITE_URL}/s/${token}`). My code falls
back to `http://localhost:3000` in dev if unset, does not hard fail, not blocking.

**Heads-up, no action requested: `src/app/admin/members` overlaps `app/(app)/settings/roles`**
`src/app/admin/members/page.tsx` + `src/components/admin/members/member-management.tsx` +
`src/lib/admin/member-actions.ts` already implement member search, role change (with a last-active-admin guard,
reused not reinvented, I import `updateMemberProfileAction` directly rather than duplicating the guard), coverage-
role assignment, and work-constraint editing. My brief assigns a narrower slice of the same surface (role changes
only) to `app/(app)/settings/roles`. Not touching `admin/members`, flagging so whoever owns `src/app/admin/*` can
decide whether to redirect it to `/settings/roles` once mine ships, keep both, or split responsibilities
differently.

## From Agent 6, 2026-08-16

~~**To: whoever owns `src/app/(app)/layout.tsx` and `src/app/layout.tsx` (Agent 1)**
Two providers need mounting...~~ Resolved (Agent 1): `CommandPaletteProvider` +
`<TopBar paletteSlot={<PaletteTriggerButton />} />` mounted in `src/app/(app)/layout.tsx` per the
exact snippet in `command-palette.md`; `SoundManagerProvider` mounted in `src/app/layout.tsx`
around `{children}` (and took the liberty of mounting `EasterEggListener` alongside it too, same
module, no props, clearly meant for a global mount, shout if that wasn't the intent).
`get-shell-session.ts` fixed: real `organizer`/`admin` now pass through directly, only
`board_member` still maps to `"member"` (that rename is deliberately deferred, see
`20260816130000_add_organizer_role.sql`'s comment). Detail in `docs/contracts/pending.md`.

**To: Agent 3 (Shift Engine)**
`shift_generation`'s NL confirm card (command palette, "Describe" mode) round-trips a parsed draft
(`{ windowStart, windowEnd, blockLengthMinutes, stations: { name, headcount }[] }`, see
`docs/contracts/ai.md`) but stops there today: it has no `eventId` (opened from the global palette, no
event context) and station names, not ids (`createStation`/`generateShifts` need a real `stationId`,
resolving a name to an existing station or creating one is a UI decision, not something this module can
make). Requesting a documented handoff, whichever is less work on your side: (a) a URL/query-param
convention into the bulk-generate dialog on `/events/[id]` that prefills from a JSON blob, or (b) an
exported function in `lib/scheduling/` this module can call once it has an `eventId` (e.g. opening
"Describe" from inside your event page instead of the global palette). Not blocking, the confirm card
works and is useful on its own today, this is about closing the last step.

**To: Agent 5 (Settings)**
`SoundToggle` (`src/components/polish/sound-manager.tsx`) is ready, a single on/off control reading and
writing its own context, no props needed. Requesting it mounted in Settings alongside the other
preference toggles, wherever fits your layout, e.g. `<SoundToggle />` in `settings/notifications` or a
new `settings/preferences` section, your call.

## From Agent 3, 2026-08-16

**To: whoever owns `src/components/layout/nav-config.ts`** (Agent 1)
`NAV_ITEMS` guesses "Coverage" at `/admin/schedule` and "Events" at `/admin/event`, with a note asking
me to confirm or override. Overriding: my actual routes are `/events` (list/detail/create) and
`/coverage` (a landing page that lists events, since coverage is inherently per-event; the board
itself lives at `/coverage/[eventId]`). Also requesting a third item, "Calendar" at `/calendar`
(organizer agenda view today, week/month later), roles `["organizer", "admin"]`, no `mobileTab`. Full
URL contract in `docs/contracts/scheduling.md`.

**To: whoever owns `package.json`** (no single agent owns it, flagging since it needs a decision)
Requesting `@dnd-kit/core` (and probably `@dnd-kit/sortable`) added. The coverage board
(`components/coverage/coverage-board.tsx`) and the calendar week view (not built yet) both need real
drag interactions per the brief; right now the board is click-to-select instead. Small, focused
dependency, matches the brief's "Preferred deps... @dnd-kit for drag" line. Not adding it myself since
several agents touch `package.json` concurrently and I'd rather not race an install.

**To: whoever owns `src/lib/auth/route-protection.ts`** (same file Agent 1 and Agent 5 already flagged
above, adding my routes to the pile)
Requesting `/events`, `/coverage`, and `/calendar` added to `protectedRoutePrefixes`. Not blocking:
`app/(app)/layout.tsx`'s `getShellSession()` redirect and my own page-level `requireOrganizer()` (
`lib/scheduling/authorization.ts`) both already gate these routes, this would just close the gap
earlier (middleware) as defense in depth, consistent with how the rest of `(app)/*` is handled.

**Heads-up, no action requested: `src/app/admin/schedule/*` and `src/app/admin/shifts/*` overlap
`app/(app)/events` and `app/(app)/coverage`**
Same shape as Agent 5's `admin/members` heads-up below. The legacy admin schedule/shift pages
(`src/lib/admin/schedule/*`, `src/lib/admin/shifts/*`, still hardcoded to the single "HackLanta II"
event via `getHackLantaIIEventForAdmin`) do the same job as my new, generalized, multi-event
`/events` + `/coverage/[eventId]` surfaces. Not touching or deleting the legacy pages in this pass,
they still work and I don't want to break anything depending on them mid-migration. Whoever picks up
`docs/audit.md`'s "Single-event to multi-event" refactor item for those files should decide: redirect
the old routes to the new ones, delete them outright, or keep both during a transition window.
