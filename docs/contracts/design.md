# Design contract

Published by Agent 1 (Foundation and Design System). Token names and primitive APIs here are
stable as of this commit; a breaking prop-API change after today gets posted in
`docs/contracts/requests.md` addressed to all agents. Live examples of every primitive in every
state: `/design` (dev-only route, under `src/app/(app)/design/`).

**2026-08-18: full UI redesign.** Neumorphism is removed. The product is now a flat, true-black
pill/bento dashboard (Nixtio-style reference): true-black canvas, flat charcoal bento cards, pills
as the atomic shape, purple and orange as the only two semantic accents, white pills for
selection/self, no shadows, no gradients. This replaces the neumorphic dark-purple system
wholesale. See "Migration strategy" below for how existing feature code keeps working through it.

**2026-08-18 v2: navigation, motion system, new primitives, density pass.** The sidebar is now a
collapsible icon rail (see "App shell"). Motion moves from one ad hoc `useMotionPreset()` hook to a
small named preset library that is now the *only* way feature code may animate anything, see
"Motion". Three new primitives ship for the v2 roles/approval-flow/horizontal-schedule work:
`StatusPill`, `TimelineTrack`/`TimelinePill`, `QuickchatButton`/`QuickchatAnswerCard`. `Card`'s
`padded` default tightens from `p-5` to `p-4`.

## Source of truth

- `src/styles/tokens.css`: every color, radius, and motion value as CSS custom properties. Do not
  redefine these anywhere else.
- `tailwind.config.ts`: the Tailwind-facing mapping of those tokens to utility classes. Do not add
  colors or radii here, request additions in `docs/contracts/requests.md`.
- `src/components/ui/`: the primitive library. Features import these, never hand-roll a color or
  radius.
- `src/lib/utils/`: `cn` (class merging), `formatShiftTime` / `formatShiftDate` / `formatShiftRange`
  / `formatShiftDuration` / `getShiftDurationMinutes`, and `motion.ts`'s preset library (the only
  motion vocabulary in the app, see "Motion" below).

## Tokens

| Token | Value | Tailwind utility |
|---|---|---|
| `--bg-app` | `#000000` | `bg-app` (page canvas) |
| `--bg-card` | `#131313` | `bg-card` (flat bento cards) |
| `--bg-elevated` | `#1E1E1E` | `bg-elevated` (pills, inputs, hover rows, wells) |
| `--accent-go` | `#A78BFA` | `bg-accent-go`, `text-accent-go`, `border-accent-go`. Purple: good/filled/available/confirmed/selected-affordance. |
| `--accent-warn` | `#FF9F2E` | `bg-accent-warn`, `text-accent-warn`, `border-accent-warn`. Orange: gap/pending/needs-attention, **and** destructive actions. There is no separate red/danger color, see "Danger folds into warn" below. |
| `--pill-white` | `#FFFFFF` | `bg-pill-white`, `text-pill-white`, `border-pill-white`. Selection or "you/yours" only, sparingly. |
| `--on-accent` | `#0A0A0A` | `text-on-accent`, `bg-on-accent`. Required text/icon color on top of any accent-go, accent-warn, or pill-white fill. Never white text on a purple or orange fill. |
| `--text-primary` | `#F5F5F5` | `text-text-primary` (~17:1 on `bg-card`) |
| `--text-secondary` | `#9A9A9A` | `text-text-secondary` (~6.6:1 on `bg-card`, safe for body text) |
| `--text-muted` | `#5E5E5E` | `text-text-muted`, **decorative/non-essential only, see Contrast floor** |
| `--border-hairline` | `rgba(167,139,250,.2)` | `border-hairline` (purple-tinted, not neutral: plain white-alpha nearly vanished on `bg-app`, see Agent 2 fix in `pending.md`) |
| `--radius-card` | `24px` | `rounded-card` (bento cards, dialogs, floating layers) |
| `--radius-pill` | `999px` | `rounded-pill` (every button, input, badge, chip, tab, toggle) |

Opacity modifiers (`bg-accent-go/10`, `border-accent-warn/40`) work on every color above via the
same `--x-rgb` sibling-variable trick as the prior system (Tailwind cannot inject an alpha channel
into an opaque `var(--x)` reference at build time, verified empirically against this exact config).
If you add a new solid color, add its `-rgb` sibling too.

**Danger folds into warn.** The old system had a separate `--danger` red. The new system does not:
Agent 5's own redesign brief specifies destructive actions ("revoke token", "demote", "cancel
shift") as **outlined orange pills**, matching the "at most two accents" restraint rule. `danger`
and `warning` both resolve to `accent-warn` now (see Migration strategy). If a future surface
genuinely needs to distinguish "this is risky" from "this is a plain gap", raise it in
`docs/contracts/requests.md` rather than reintroducing a third accent locally.

**Shadows: none**, anywhere, for elevation. Depth comes only from the `bg-app` -> `bg-card` ->
`bg-elevated` tonal steps and from shape. The one surviving `boxShadow` utility is
`shadow-focus-ring` (`focus-visible:shadow-focus-ring`, every interactive primitive uses it): a
hard-edged double ring, not an elevation shadow, this is the focus-visibility mechanism, not a
neumorphic leftover.

**Motion**: `duration-fast` (120ms), `duration-base` (200ms), `ease-neu-out` (name unchanged,
still current). Pressable pills/capsules scale to `active:scale-[0.97]` (cards use a subtler
`active:scale-[0.99]`). Plain CSS transitions add `motion-reduce:transition-none` /
`motion-reduce:animate-none` themselves.

**v2: the preset library in `@/lib/utils/motion` is the only motion vocabulary in the app.**
Feature code may not write its own Framer Motion `Transition`/`Variants` literal or a new
`animate:pulse`-style custom keyframe; animate only through these exports, all reduced-motion-aware
internally so callers never write their own `useReducedMotion()` check:

| Preset | Export | Shape |
|---|---|---|
| pageTransition | `useMotionPreset()` | `{ transition, fast, variants }`, fade + 8px rise. The original hook, unchanged. |
| listStagger | `useListStagger(staggerMs?)` | `{ container, item }` Variants, 40ms default cadence between children. |
| pillPress | `PILL_TAP` | `{ scale: 0.97 }`, a `whileTap` target for a Framer Motion button/capsule (CSS `active:scale-[0.97]` remains correct for anything not already a `motion.*` element). |
| drawerSlide | `MOTION_DRAWER` | `Transition`, 180ms, the sidebar rail's width tween; reusable for any other expand/collapse. |
| fillIn | `useFillIn()` | `{ variants, transition }`, a capsule fill sweep (`scaleX` 0 to 1) for a schedule state change, e.g. `in_approval` flipping to `approved`. |
| reveal | `useReveal()` | `{ container, item }` Variants, 30ms cadence, items also shift in from the left, for AI schedule proposals populating left to right. |
| countUp | `useCountUp(target, durationMs?)` | Returns a tweened `number`, ~500ms ease-out. Pair with `font-mono tabular-nums` on the display element so digit width never shifts; wired into `StatBlock` as the optional `animated` prop. |

`MOTION_FAST` / `MOTION_BASE` (the raw `Transition` objects behind `useMotionPreset()`) are also
exported for the rare case a preset hook's default doesn't fit, e.g. `Sidebar`'s per-label stagger
delay (`{ ...MOTION_FAST, delay: index * 0.02 }`).

**Type**: `font-sans` (Geist Sans, body UI), `font-mono` (Geist Mono, every numeral/time/count,
always paired with Tailwind's `tabular-nums`), `font-display` (Space Grotesk Bold, loaded in
`src/app/layout.tsx`, page titles / hero stat numerals / uppercase card overline titles only).
Space Grotesk over Archivo Black: it ships 500/600/700 weights so the same family covers both a
huge display numeral and a small uppercase card title without switching back to Inter at smaller
sizes, and its geometric letterforms pair naturally with Geist Mono's tabular figures; Archivo
Black is a single 900-weight face, correct only at hero scale.

## Migration strategy

Five other agents were mid-flight on live feature surfaces when this redesign landed. A hard
rename/delete of every primitive and utility class would have broken their builds and left ~30
already-shipped files rendering unstyled with no compiler error to catch it (raw `bg-bg-surface`,
`text-danger`, `rounded-neu`, etc. are just strings; Tailwind silently drops unknown classes, it
does not fail the build). That is a worse outcome than the "renders unstyled until migrated"
precedent this repo used for the very first `hl-*` to neumorphic migration, because this time the
old classes belonged to actively-developed sibling work, not dead legacy code.

Instead:

1. **Every old Tailwind utility class name still resolves**, now pointing at the new tokens:
   `bg-bg-base`/`bg-bg-surface`/`bg-bg-sunken` -> `bg-app`/`bg-card`/`bg-elevated`; `purple-400`/
   `purple-500` -> `accent-go`; `text-danger`/`bg-danger`/`border-danger` and `text-warning`/
   `bg-warning`/`border-warning` -> `accent-warn`; `rounded-neu`/`rounded-neu-lg` -> `radius-card`;
   `rounded-neu-sm` -> `radius-pill` (small controls are pills now, not small-radius rectangles);
   `shadow-neu-focus` -> the same ring as `shadow-focus-ring`. Every other `shadow-neu-*` (raised,
   pressed, glow, floating) is genuinely gone, no alias: those encoded elevation, which has no
   equivalent in a flat system, so any leftover reference now correctly renders with no shadow.
2. **Every existing primitive export still exists under its old name**, restyled in place onto the
   new tokens, with the exact same props. `NeuCard`, `NeuButton`, `NeuInput`, `NeuTextarea`,
   `NeuSelect`, `NeuToggle`, `NeuCheckbox`, `NeuBadge`, `NeuTabs*`, `NeuWell`, `Avatar`,
   `AvatarStack`, `Dialog*`, `Popover*`, `Tooltip*`, `Toast*`, `Skeleton`, `Spinner`, `GridCell` all
   compile and render in the new look with zero call-site changes anywhere in the other five
   agents' territory.
3. **New canonical names are additive.** Where the redesign brief calls for a rename (`NeuCard` ->
   `Card`, `NeuButton` -> `PillButton`), the new name is a plain re-export alias of the same
   component (`export const PillButton = NeuButton`). Prefer the new name in new code; there is no
   deadline to migrate existing call sites off the old name.
4. **`GridCell` is not superseded automatically.** `ShiftCapsule` and `MatrixDot` are richer,
   purpose-built replacements for the coverage board and availability grid respectively, but
   `coverage-board.tsx` (Agent 3) and the availability grid (Agent 4) are not mine to edit.
   `GridCell` stays fully supported, restyled onto the flat language, for as long as those files
   use it. Adopting the two new hero primitives is each owning agent's call, on their own schedule;
   see the outreach note in `docs/contracts/requests.md`.

Net effect: the entire app repaints onto the new black/pill language the moment this commit lands,
with zero forced edits anywhere outside `src/components/ui/`, `src/styles/`, `tailwind.config.ts`,
and `src/components/layout/` (all mine). Verified: `npm run typecheck`, `npm run lint`, and
`npm run build` all clean across the whole repo as of this commit, including every other agent's
in-flight files.

## Contrast floor

Verified against the exact hex values above (WCAG relative-luminance contrast ratio):

- `text-primary` on `bg-card`/`bg-elevated`: ~17.1:1 / ~15.3:1. Always safe.
- `text-secondary` on `bg-card`/`bg-elevated`: ~6.6:1 / ~5.9:1. Safe for body text.
- `text-muted` on `bg-card`: ~2.9:1. On `bg-elevated`: ~2.6:1. **Fails AA for normal text on both
  surfaces** (needs 4.5:1). Restrict to decorative or genuinely non-essential text (a faint helper
  caption, a disabled icon), never a label someone must read to use the product. `StatBlock`'s
  small label under the huge numeral uses `text-secondary`, not `text-muted`, for exactly this
  reason, overriding the shared spec's prose ("tiny muted label") where it would fail the floor.
- `on-accent` (#0A0A0A) on `accent-go`: ~7.3:1. On `accent-warn`: ~9.7:1. On `pill-white`: ~19.8:1.
  All comfortably clear AA, several clear AAA. This is why every accent fill's text/icon color is
  `on-accent`, never white or `text-primary`.
- `accent-go` as text on `bg-card`: ~6.8:1. `accent-warn` as text on `bg-card`: ~9.1:1. Both safe
  for focus rings, accent labels, delta triangles.
- `text-secondary` on `bg-app` (pure black chrome, sidebar/topbar): ~7.5:1, even safer than on
  `bg-card`. `text-muted` on `bg-app`: ~3.2:1, still fails the normal-text floor, same restriction
  applies.

## Semantic fill rule

A shift is a capsule, and its color is its status. This is the whole product legible in one
glance; every schedule surface (coverage board, availability, my-schedule strip) obeys it.

- **`ShiftCapsule`** (a shift spanning a time range, with headcount and possibly assignees): empty
  is a hollow `bg-elevated` capsule with a dashed hairline border. Partially filled is solid
  `accent-warn` with the `filled`/`needed` count printed inside in mono. Fully staffed is solid
  `accent-go` with an `AvatarStack` of the assigned members inside. `selected` is a distinct solid
  `pill-white` fill (this is you, or this is the one you picked, never a headcount state). An
  understaffed capsule within 24h gets a slow `accent-warn` pulse; `prefers-reduced-motion` swaps
  that for a static thicker orange outline instead of removing the cue entirely, status must never
  become invisible just because motion is off.
- **`MatrixDot`** (a single availability cell): idle is a small dim `bg-elevated` dot. Painted
  snaps to a solid `accent-go` dot with a small scale pop. An AI-drafted, unconfirmed window
  renders as a hollow `accent-go` ring until the member confirms it.
- Every coverage state must also be legible without color: `ShiftCapsule` always carries its count
  or faces, `MatrixDot`'s painted state is also larger than idle, not tint alone.
- **`GridCell`** (legacy, see Migration strategy) approximates the same rule within its simpler
  single-cell API: empty/conflict are neutral with a dashed or double hairline border, partial is
  solid `accent-warn` with a count, full/selected are solid `accent-go`.

## Primitive reference

All in `src/components/ui/`, all `forwardRef`, all keyboard-operable with a visible
`focus-visible:shadow-focus-ring` on every real interactive control (floating-layer containers like
`PopoverContent`/`TooltipContent` are not themselves focusable, their trigger is).

| Component | File | Notes |
|---|---|---|
| `Card` (`NeuCard`) | `neu-card.tsx` | `interactive`, `padded`, `title` (uppercase overline row), `menuSlot` (trailing slot in that row). No shadow ever, hover is a background shift, not a lift. |
| `PillButton` (`NeuButton`) | `neu-button.tsx` | `variant`: `primary` (solid accent-go fill) \| `default` (bg-elevated) \| `ghost` \| `destructive` (outlined orange, no red). `size`: `sm` \| `md` \| `lg`. |
| `IconButton` | `icon-button.tsx` | Circular outlined icon button for secondary actions. `variant`: `neutral` \| `ghost`. `size`: `sm` \| `md`. `aria-label` is required (icon-only). |
| `NeuInput` / `NeuTextarea` | `neu-input.tsx` / `neu-textarea.tsx` | Flat `bg-elevated` pill/well. `invalid`, `errorMessage` props. Focus adds an `accent-go` border plus the ring. |
| `NeuSelect` | `neu-select.tsx` | Flat controlled API over Radix Select: `options`, `value`/`onValueChange`. |
| `FilterPill` | `filter-pill.tsx` | The "Label: Value" dropdown capsule pattern (e.g. "Date: Now"). `label`, `options`, `value`/`onValueChange`. |
| `NeuToggle` | `neu-toggle.tsx` | Wraps Radix Switch. Checked state fills the track solid `accent-go`; thumb is `pill-white` in both states. |
| `NeuCheckbox` | `neu-checkbox.tsx` | Wraps Radix Checkbox, supports `checked="indeterminate"`. Checked/indeterminate fill solid `accent-go` with an `on-accent` glyph. |
| `NeuWell` | `neu-well.tsx` | Static `bg-elevated` container. `size`: `sm` (pill) \| `md` (card radius). |
| `NeuBadge` | `neu-badge.tsx` | `variant`: `default` \| `purple` \| `warning` \| `danger` (`warning`/`danger` render identically now, see "Danger folds into warn"). Tinted outline chip. |
| `NeuTabs` | `neu-tabs.tsx` | `NeuTabs`/`NeuTabsList`/`NeuTabsTrigger`/`NeuTabsContent`. Active tab is a `pill-white` pill (selection semantics), inactive is `text-secondary`. |
| `GridCell` | `grid-cell.tsx` | Legacy per-cell grid primitive, see Migration strategy. `state`: `empty` \| `partial` \| `full` \| `selected` \| `conflict`. |
| `ShiftCapsule` | `shift-capsule.tsx` | New hero primitive, see Semantic fill rule. `state`: `empty` \| `partial` \| `full` \| `selected`. `filled`/`needed`, `members` (AvatarStack), `label`, `urgentPulse`. |
| `MatrixDot` | `matrix-dot.tsx` | New hero primitive, see Semantic fill rule. `state`: `idle` \| `painted` \| `draft`. Real `<button>` under the hood so drag-paint/touch-paint pointer handlers on the caller's grid pass through unmodified. |
| `StatBlock` | `stat-block.tsx` | Huge bold mono numeral, small `text-secondary` label (truncates, keep it under ~24 characters), optional `accent-go`/`accent-warn` triangle `delta`, optional `animated` (tweens a numeric `value` via the countUp preset, ignored for string values). |
| `StatusPill` | `status-pill.tsx` | v2. The three assignment states, fixed styling, not a variant prop: `state`: `approved` (solid `accent-go` fill) \| `in_approval` (`accent-warn` outline) \| `not_assigned` (neutral `bg-elevated`). `label` overrides the default text. Used identically everywhere so a member never has to relearn what a color means between surfaces. |
| `TimelineTrack` / `TimelinePill` | `timeline-track.tsx` | v2. Generic horizontal time axis: `rangeStart`/`rangeEnd`, optional `today` marker and mono `ticks`, `pxPerDay` controls the scrollable inner width. `TimelinePill` (`start`, optional `end`, `label`, `tone`: `go`\|`warn`\|`neutral`\|`white`) positions itself by percentage via context; must render inside a `TimelineTrack`. No "event" or "shift" concept baked in on purpose, both the semester events timeline and a personal schedule strip compose from the same primitive. Row/lane collision avoidance is the caller's job: nest each lane in its own `relative` wrapper. |
| `QuickchatButton` / `QuickchatAnswerCard` | `quickchat.tsx` | v2. A preset-query pill (`QuickchatButton`, plain `bg-elevated` pill) paired with a compact inline reveal (`QuickchatAnswerCard`, `bg-card`, `p-3`, `max-w-sm`). Times/numbers inside the answer card are the caller's job to wrap in `font-mono tabular-nums`. |
| `Skeleton` | `skeleton.tsx` | Flat `bg-elevated` placeholder, `animate-pulse`. Size via `className`. |
| `Spinner` | `spinner.tsx` | `size`: `sm` \| `md` \| `lg`. `label` prop (default "Loading"). |
| `Dialog` / `Popover` / `Tooltip` | `dialog.tsx` / `popover.tsx` / `tooltip.tsx` | Floating layers: `bg-card` on a `bg-app/80` black scrim (dialog only), hairline border, `rounded-card` (`rounded-pill` for the small Tooltip), no shadow. |
| `Toast` | `toast.tsx` + `use-toast.ts` | `<Toaster/>` mounted once in `src/app/layout.tsx`. `variant`: `default` \| `destructive` (orange, not red). |
| `Avatar` | `avatar.tsx` | `Avatar`/`AvatarImage`/`AvatarFallback`. `size`: `sm` \| `md` \| `lg`. New `tone`: `default` \| `self` (adds an `accent-go` ring, additive/optional). |
| `AvatarStack` | `avatar-stack.tsx` | `members`, `max` (default 4), `size`. Overlapping avatars plus a `+N` overflow chip, separated by a `bg-card`-colored ring. |

## Spacing and density

Compact rows (control height 40px / `h-10`, matching `PillButton` `md` and `NeuInput`), generous
section spacing (`gap-6`/`gap-8` between page sections, not between rows inside one), max two
levels of card nesting. Page container: `max-w-6xl` centered, set once in `src/app/(app)/layout.tsx`,
do not re-wrap it inside feature pages.

**v2 density pass.** `Card`'s `padded` default tightened from `p-5` to `p-4`, applies to every
existing `Card`/`NeuCard` call site automatically (visual only, no prop change). Title style is
singular and enforced inside the primitive itself, not left to each consumer: `Card`'s own `title`
prop (`text-xs font-semibold uppercase tracking-wide text-secondary`) is the one card-title
treatment in the app; a feature building its own uppercase overline label by hand instead of
passing `title` is drifting from the system, prefer the prop. `StatBlock`'s label truncates and
should stay under roughly 24 characters so it never wraps under the huge numeral.

## Do / don't

- Do use `ShiftCapsule`/`MatrixDot` for new schedule-grid surfaces. Don't hand-roll a new coverage
  cell; `GridCell` remains supported for existing call sites, see Migration strategy.
- Do keep at most two accents (`accent-go`, `accent-warn`) doing semantic work per rendered view.
  Don't add a third color or a gradient anywhere.
- Do pair `text-on-accent` with every `accent-go`/`accent-warn`/`pill-white` fill. Don't render
  white or `text-primary` on top of an accent fill, it fails the contrast floor.
- Do use `text-secondary` for anything a user needs to read. Don't use `text-muted` for it, see
  Contrast floor.
- Do rely on the `bg-app` -> `bg-card` -> `bg-elevated` tonal steps for depth. Don't add a
  box-shadow anywhere except `shadow-focus-ring`.
- Do request a new token in `docs/contracts/requests.md` if you need a color, radius, or shadow
  that isn't here. Don't define one locally, even "just this once".

## App shell

`src/app/(app)/layout.tsx` wraps every authenticated route: `Sidebar` (desktop,
`src/components/layout/sidebar.tsx`), `MobileTabBar` (mobile, `mobile-tab-bar.tsx`, unchanged pill
tabs, the rail treatment below is desktop-only), `TopBar` (`topbar.tsx`, `paletteSlot` for Agent
6's Cmd+K trigger, `notificationSlot` for Agent 2's notification center, sign-out is a circular
`IconButton`). Nav items and role gating live in `src/components/layout/nav-config.ts`
(`NAV_ITEMS`, `navItemsForRole`, `mobileTabItemsForRole`); routes match what Agents 3 and 4 shipped
(`/coverage`, `/events`, `/calendar`, `/shifts`). `NavItem` gained a required `icon: NavIconKey`
field for the collapsed rail (`src/components/layout/nav-icons.tsx`, hand-drawn inline SVGs, one
per nav item, no icon library dependency added). `ShellRole` still says `"organizer"`, not the v2
shared decision's `"director"`: that rename is Agent 2's schema migration to land first, this file
switches once it does, see `docs/contracts/requests.md`.

**v2: collapsible icon rail.** `Sidebar` takes a `defaultCollapsed?: boolean` prop, read
server-side in `src/app/(app)/layout.tsx` from a `sidebar-collapsed` cookie via `next/headers`'
`cookies()` so the first paint never flashes the wrong state. The toggle (top of the rail, an
`IconButton`) writes the same cookie client-side (`document.cookie`, no `Secure` flag so local
`http://` dev keeps working, 1 year `max-age`, no server round trip: this is a UI preference, not
account data, per-device persistence is the intended scope, not per-account/cross-device; that
would be a `profiles` column, an Agent 2 schema request, not built here). Width tweens between 72px
(collapsed, an icon-only rail with a `Tooltip` per item) and 240px (expanded, icons + labels) via
the `drawerSlide` preset (`MOTION_DRAWER`, 180ms); labels fade/slide in staggered 20ms apart using
`MOTION_FAST` plus a per-index `delay`. Content reflows for free: the rail sits in the same flex
row as the main content column, animating its `width` alone drives the reflow, no extra layout
code needed.

`src/components/layout/app-shell.tsx` and `app-nav.tsx` are the old per-page HackLanta shell,
superseded but left in place until the pages that still import them migrate; both were restyled
onto the flat tokens in the v1 redesign pass so pages still using them are not stuck on the
pre-redesign look, unchanged in v2.
