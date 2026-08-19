# Design contract

Published by Agent 1 (Foundation and Design System). Token names and primitive APIs here are
stable as of this commit; a breaking prop-API change after today gets posted in
`docs/contracts/requests.md` addressed to all agents. Live examples of every primitive in every
state, both themes: `/design` (dev-only route, under `src/app/(app)/design/`).

**2026-08-19 V3: dual-theme aurora/midnight glass.** The flat true-black pill/bento system is
retired. Light is now the default theme ("aurora glass": off-white aurora-wash canvas, frosted
translucent cards, soft diffuse shadows, vivid purple accent, Bryzos/Truck&Co lineage); dark is
opt-in via a toggle ("midnight glass": near-black canvas, translucent dark cards, purple glow
accents, Stakent lineage). One semantic token layer drives both themes through a `[data-theme]`
attribute; motion gets a shared spring for movement plus new presets (`entranceCascade`, `drawIn`,
`hoverLift`, `morphTo`, `themeCrossfade`); an illustration system (`AuroraWash`, `FloatShapes`,
`Hero`) ships for hero moments. See "V3: dual-theme glass" below for the full token table, the
accent fill-vs-glow split (a contrast-floor fix, not a spec deviation for its own sake), and the
exact migration mechanics. Everything in "v1/v2" below that isn't superseded (primitive APIs,
spacing, the semantic fill rule, app shell structure) is unchanged; read this section first, then
skip to whichever v1/v2 section you need.

**2026-08-18: full UI redesign (superseded by V3 above, kept for history).** Neumorphism is
removed. The product became a flat, true-black pill/bento dashboard (Nixtio-style reference):
true-black canvas, flat charcoal bento cards, pills as the atomic shape, purple and orange as the
only two semantic accents, white pills for selection/self, no shadows, no gradients. See
"Migration strategy" for how existing feature code kept working through it; V3 uses the identical
strategy for this second transition.

**2026-08-18 v2: navigation, motion system, new primitives, density pass.** The sidebar is now a
collapsible icon rail (see "App shell"). Motion moves from one ad hoc `useMotionPreset()` hook to a
small named preset library that is now the *only* way feature code may animate anything, see
"Motion". Three new primitives ship for the v2 roles/approval-flow/horizontal-schedule work:
`StatusPill`, `TimelineTrack`/`TimelinePill`, `QuickchatButton`/`QuickchatAnswerCard`. `Card`'s
`padded` default tightens from `p-5` to `p-4`.

## V3: dual-theme glass

### Theme architecture

`src/lib/theme/use-theme.ts` (`useTheme()`) is the only theme API: `{ theme, setTheme, toggleTheme
}`. It sets `data-theme="dark"` (or removes it for light) on `<html>`, mirrors the choice to
`localStorage` (`ps-theme`, instant/offline/pre-hydration source), and fire-and-forgets a write to
Agent 2's `updateProfileThemeAction` (`src/lib/settings/theme-actions.ts`) so the choice follows a
signed-in member's account across devices. The root layout (`src/app/layout.tsx`) is `async` and
calls Agent 2's `getProfileTheme()` (`src/lib/settings/theme.server.ts`) to stamp `data-theme`
server-side before first paint for a signed-in member; `THEME_INIT_SCRIPT`, injected as the first
thing in `<head>`, is the client-side fallback for a signed-out visitor or a device the account
hasn't synced yet, and no-ops if the server already stamped an attribute. Net effect: no
flash-of-wrong-theme in either the signed-in or signed-out case. Light is the deliberate default
regardless of OS theme; nothing here reads `prefers-color-scheme`.

`ThemeToggle` (`src/components/ui/theme-toggle.tsx`) is the one toggle instance, a sun/moon pill
mounted in `TopBar`. It calls `toggleTheme()`, which routes the DOM mutation through
`startThemeTransition` (`lib/utils/motion.ts`): a View Transitions API crossfade where supported,
an instant swap otherwise.

### Tokens

Every solid color has a `-rgb` sibling for Tailwind opacity modifiers (`bg-accent-primary/10`), see
`tailwind.config.ts`'s `withOpacity` helper. Two surfaces break that pattern on purpose: their
alpha is baked into the CSS var itself as part of the glass effect (`--surface-card`,
`--surface-elevated` are already `rgba()`), same precedent `--border-hairline` already set.

| Token | Light | Dark | Tailwind utility | Notes |
|---|---|---|---|---|
| `--surface-canvas` | `#F4F4F7` | `#0B0B12` | `bg-surface-canvas` (back-compat: `bg-app`) | Page canvas, paired with the aurora wash gradient in `globals.css` |
| `--surface-card` | `rgba(255,255,255,.66)` | `rgba(22,22,32,.62)` | `bg-surface-card` (back-compat: `bg-card`) | Glass cards. Pair with `backdrop-blur-glass`. No opacity-modifier support (alpha baked in) |
| `--surface-card-solid` | `#FFFFFF` | `#16161F` | `bg-surface-card-solid` | No-backdrop-filter fallback, see globals.css `@supports` block |
| `--surface-elevated` | `rgba(255,255,255,.9)` | `rgba(38,38,52,.9)` | `bg-surface-elevated` (back-compat: `bg-elevated`) | Pills, inputs, wells |
| `--accent-primary` | `#6D4AFF` | `#6D4AFF` | `bg-accent-primary` (back-compat: `bg-accent-go`, `bg-pill-white`) | Solid fill, safe under `on-accent` white text in both themes, see "Accent fill vs glow" |
| `--accent-primary-glow` | `#6D4AFF` | `#A78BFA` | `text-accent-primary-glow`, `border-accent-primary-glow` | Text/border/line/ring only, never a fill under white text |
| `--accent-warn` | `#E8730C` | `#FF9F2E` | `text-accent-warn`, `border-accent-warn` | Text/border/outline pills (`in_approval`), matches the spec's literal value |
| `--accent-warn-fill` | `#B35A00` | `#B35A00` | `bg-accent-warn-fill` (back-compat: `bg-danger`, `bg-warning`) | Solid fill, safe under white text in both themes |
| `--accent-delta` | `#7DD11F` | `#BFF345` | `bg-accent-delta` | Positive-delta glyph/tint fill only, never a status, never paired with `on-accent` white text |
| `--accent-delta-text` | `#3D7A08` | `#BFF345` | `text-delta` | Readable delta-numeral text color (light theme darkens it, dark theme reuses the bright value) |
| `--text-primary` | `#17171C` | `#F5F5F7` | `text-text-primary` | |
| `--text-secondary` | `#5F5F6B` | `#9A9AA8` | `text-text-secondary` (back-compat: `text-text-muted`) | |
| `--border-hairline` | `rgba(23,23,28,.08)` | `rgba(255,255,255,.08)` | `border-hairline` | |
| `--on-accent` | `#FFFFFF` | `#FFFFFF` | `text-on-accent` | Text/icon on `accent-primary` and `accent-warn-fill` solid fills only |
| `--radius-card` | `24px` | same | `rounded-card` | |
| `--radius-pill` | `999px` | same | `rounded-pill` | |
| `--blur-glass` | `20px` | same | `backdrop-blur-glass` | Pair with every `surface-card`/`surface-elevated` usage |
| `--shadow-soft` | diffuse, low-opacity | purple-tinted glow | `shadow-soft` | Card/dialog/popover elevation |
| `--shadow-glow` | tighter purple-tinted lift | brighter glow | `shadow-glow` | `hoverLift`'s hover state |

### Accent fill vs glow: the contrast fix

The shared spec pins dark-mode `accent-primary` to `#A78BFA` and `on-accent` to `#FFFFFF` in both
themes. White text on `#A78BFA` measures **~2.7:1**, below the 3:1 floor even for large text/UI
components, let alone the 4.5:1 normal-text floor. The spec's light-theme `accent-warn` (`#E8730C`)
under white text measures **~3.05:1**, also short of 4.5:1. Rather than silently ship an
inaccessible dark mode or ignore the spec's literal values, every token that can be used as a
**solid fill under `on-accent` white text** (`accent-primary`, `accent-warn-fill`) is pinned to a
darker, AA-safe shade in both themes (`#6D4AFF` measures ~5.3:1 with white; `#B35A00` measures
~4.8:1). The spec's literal, brighter/lighter values live on in the `-glow` variant
(`accent-primary-glow`, plain `accent-warn`), used only where nothing is layered on top expecting
`on-accent` contrast: text, borders, focus rings, thin chart/timeline lines, box-shadow glows. This
is where the dark theme's "Stakent-style luminous glow" intent actually comes from. Same logic for
lime: `#7DD11F`/`#BFF345` are both very high-luminance colors (lime is inherently bright), so
`accent-delta-text` darkens the light-theme numeral shade to `#3D7A08` (~5.3:1 on a light card)
while the dark theme's card is dark enough that the literal bright value already clears ~13:1 and
needs no adjustment. Full derivation: `src/styles/tokens.css` header comment.

### V3 migration strategy

Same non-negotiable rule as the prior redesign: **every existing Tailwind utility class name and
every existing primitive export still resolves**, repainted onto the new glass tokens, so the
~30+ files across the other five agents that already reference `bg-card`, `bg-elevated`,
`accent-go`, `pill-white`, `text-muted`, etc. repaint automatically with zero required edits. See
`tailwind.config.ts`'s color block for the full alias table. Three behavior changes worth knowing
even though nothing breaks:

1. **`pill-white` now resolves to `accent-primary`, not literal white.** The old "white selection
   pill" concept (self/claimed, distinct from "primary") is retired: the shared V3 spec doesn't
   call for a third neutral accent, and "at most two accents per view" already covers
   purple/orange. What used to render as a white chip (the active sidebar item, `PillButton`'s
   `white` variant, the active mobile tab) now renders as a purple one, which is exactly the
   "primary/selected" semantic in the new system. The one place this needed an explicit fix:
   `NeuToggle`'s thumb, a literal switch knob rather than a semantic pill, is now `bg-white`
   directly so it doesn't disappear into a purple track.
2. **`accent-go` now resolves to the fill-safe `accent-primary` value, not the spec's literal
   dark-mode `#A78BFA`.** See "Accent fill vs glow" above; every old solid-fill usage of `accent-go`
   (StatusPill's `approved` state, `PillButton`'s `primary` variant, the sidebar's active pill)
   stays AA-compliant automatically. New code wanting the luminous dark-mode look for a non-fill
   use (text, border, glow) should reach for `accent-primary-glow` instead of `accent-go`.
3. **`text-muted` now resolves to `text-secondary`.** The old `text-muted` token failed the
   contrast floor in the prior system and had no correct body-text use; V3 doesn't ship a
   replacement decorative-only token, so any lingering `text-muted` usage now reads at the safe
   `text-secondary` contrast instead of silently staying illegible.

**Known gap, not mine to fix:** `npm run check:colors` (new, `scripts/check-hardcoded-colors.mjs`,
see "Enforcement" below) finds ~130 raw hex literals outside the design system, all in Agent 2's
(`components/notifications/`) and Agent 5's (`components/public/`, `components/settings/`,
`app/api/og/`, `app/manifest.ts`, `app/icon-*`, `app/apple-icon.tsx`) territory, hand-rolled
against the *old* flat-black system before this token layer existed (see the git history on
`docs/contracts/pending.md`'s original `STUB(agent-1)` note). Both agents' own V3 directives
already call for restyling those surfaces (notification center, public schedule, settings, OG
images, PWA icons); flagged in `docs/contracts/requests.md` rather than edited here, per file
ownership.

### Enforcement

`npm run check:colors` (`scripts/check-hardcoded-colors.mjs`) fails if a raw hex or `rgb()`/`hsla()`
literal appears anywhere under `src/app` or `src/components` outside the directories Agent 1 owns.
**Not yet wired into `npm run lint`**, deliberately: doing so today would fail the shared branch's
lint for everyone over the pre-existing violations above, before Agents 2 and 5 have had their pass
at the restyle their own V3 directives already call for. Once those land, flip it on by adding
`&& npm run check:colors` to the `lint` script; tracked in `docs/contracts/requests.md`.

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

**The preset library in `@/lib/utils/motion` is the only motion vocabulary in the app.** Feature
code may not write its own Framer Motion `Transition`/`Variants` literal or a new
`animate:pulse`-style custom keyframe; animate only through these exports, all reduced-motion-aware
internally so callers never write their own `useReducedMotion()` check:

| Preset | Export | Shape |
|---|---|---|
| pageTransition | `useMotionPreset()` | `{ transition, fast, variants }`, fade + 8px rise. The original hook, unchanged. |
| entranceCascade | `useEntranceCascade(staggerMs?)` | `{ container, item }` Variants, 40ms default cadence. V3 name for `useListStagger` (kept as an alias); mount once per view with a stable key and a static `animate="visible"`, never retrigger it on a data refetch. |
| pillPress | `pillPress` (alias of `PILL_TAP`) | `{ scale: 0.97 }`, a `whileTap` target for a Framer Motion button/capsule (CSS `active:scale-[0.97]` remains correct for anything not already a `motion.*` element). |
| drawerSlide | `MOTION_DRAWER` | `Transition`, 180ms, the sidebar rail's width tween; reusable for any other expand/collapse. |
| fillIn | `useFillIn()` | `{ variants, transition }`, a capsule fill sweep (`scaleX` 0 to 1) for a schedule state change, e.g. `in_approval` flipping to `approved`. |
| reveal | `useReveal()` | `{ container, item }` Variants, 30ms cadence, items also shift in from the left, for AI schedule proposals populating left to right. |
| countUp | `useCountUp(target, durationMs?)` | Returns a tweened `number`, ~500ms ease-out. Pair with `font-mono tabular-nums` on the display element so digit width never shifts; wired into `StatBlock` as the optional `animated` prop. |
| drawIn | `useDrawIn()` + `drawInDelay(index, staggerMs?)` | `{ variants, transition }`, a spring-driven `scaleX` sweep for schedule bars sweeping in left to right, 60ms default stagger via `drawInDelay`. |
| hoverLift | `HOVER_LIFT_CLASSES` | Plain class string (CSS, not a hook): 2px rise + `shadow-soft` to `shadow-glow` on hover. Already baked into `Card`'s `interactive` prop. |
| morphTo | `MORPH_TRANSITION` | A spring `Transition` for shared-element morphs: give the source and destination the same Framer Motion `layoutId`. Used for a shift capsule or event card morphing into its detail panel. Falls back to `pageTransition` where routing prevents a true `layoutId` morph. |
| themeCrossfade | `startThemeTransition(applyTheme)` | Wraps a DOM mutation in `document.startViewTransition` where supported, instant swap otherwise. The only caller is `useTheme`. |

**V3 spring.** `SPRING_TRANSITION` (`{ type: "spring", stiffness: 420, damping: 32, mass: 1 }`,
mirrored in `tokens.css` as `--motion-spring-*`) is the one shared spring for anything that
*moves* (position, scale, width): `drawIn`, `hoverLift`, `morphTo`, the theme toggle's tap. The
existing `MOTION_FAST`/`MOTION_BASE` cubic-bezier easing stays correct for *opacity* fades
(`pageTransition`, `entranceCascade`, `reveal`), per the shared spec: "springs, not linear tweens,
for movement; gentle ease-out for opacity."

`MOTION_FAST` / `MOTION_BASE` (the raw `Transition` objects behind `useMotionPreset()`) are also
exported for the rare case a preset hook's default doesn't fit, e.g. `Sidebar`'s per-label stagger
delay (`{ ...MOTION_FAST, delay: index * 0.02 }`).

**Type**: `font-sans` (Geist Sans, body UI), `font-mono` (Geist Mono, every numeral/time/count,
always paired with Tailwind's `tabular-nums`), `font-display` (Space Grotesk, loaded in
`src/app/layout.tsx`, page titles / hero stat numerals / uppercase card overline titles). Space
Grotesk over General Sans: it was already the display face going into V3 (chosen in the prior
redesign for the same reason V3's "friendly geometric display face" call asks for: it ships
500/600/700 weights so one family covers both a huge display numeral and a small uppercase card
title without switching back to Inter, and its geometric letterforms pair naturally with Geist
Mono's tabular figures), so V3 keeps it rather than swapping fonts for their own sake. Normal case
for page titles and hero moments, small uppercase tracking for card overline labels, matching the
shared spec's type rules exactly.

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

WCAG AA verified in both themes, against `surface-card-solid` (the opaque fallback tone, a
conservative stand-in for the translucent glass card over the aurora wash, which only ever raises
effective contrast since the wash sits behind more opaque content, never in front):

- `text-primary` on `surface-card-solid`: light ~15.2:1, dark ~14.4:1. Always safe.
- `text-secondary` on `surface-card-solid`: light ~6.1:1, dark ~5.8:1. Safe for body text.
- `on-accent` (white) on `accent-primary` (the fill-safe `#6D4AFF`, both themes): ~5.3:1. Pass AA.
- `on-accent` (white) on `accent-primary-glow` (dark theme's `#A78BFA`): ~2.7:1. **Fails**, which
  is exactly why `accent-primary-glow` is never used as a fill under `on-accent` text, see "Accent
  fill vs glow" above.
- `on-accent` (white) on `accent-warn-fill` (`#B35A00`, both themes): ~4.8:1. Pass AA.
- `accent-warn` (the brighter/spec-literal shade) as text on `surface-card-solid`: light ~3.05:1
  fails 4.5:1 (used for `in_approval`'s outline label at a size/weight that still needs the floor,
  so it stays intentionally close to the line and any future tightening should re-check it), dark
  ~7.8:1 passes comfortably.
- `accent-delta-text` on `surface-card-solid`: light ~5.3:1 (the darkened leaf-green), dark ~13:1
  (the literal bright lime, already safe there). The raw `accent-delta` bright value is never used
  as text on a light surface, only as a glyph/tint fill, see "Accent fill vs glow".
- `text-secondary` on `surface-canvas` (chrome: sidebar/topbar, both translucent over canvas):
  light ~5.7:1, dark ~6.9:1. Both safe.

`text-muted` has no token in V3 (see "V3 migration strategy": it now resolves to `text-secondary`,
its old contrast failure retired along with it, not carried forward).

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
| `Card` (`NeuCard`) | `neu-card.tsx` | `interactive`, `padded`, `title` (uppercase overline row), `menuSlot` (trailing slot in that row). V3: glass (`surface-card` + `backdrop-blur-glass`), `shadow-soft` always, `interactive` adds `hoverLift` (2px rise, shadow deepens to `shadow-glow`) instead of the old flat background-shift hover. |
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
| `Dialog` / `Popover` / `Tooltip` | `dialog.tsx` / `popover.tsx` / `tooltip.tsx` | Floating layers: V3 glass (`surface-card`/`surface-elevated` + `backdrop-blur-glass` + `shadow-soft`) on a blurred `surface-canvas/60` scrim (dialog only), hairline border, `rounded-card` (`rounded-pill` for the small Tooltip). |
| `Toast` | `toast.tsx` + `use-toast.ts` | `<Toaster/>` mounted once in `src/app/layout.tsx`. `variant`: `default` \| `destructive` (orange, not red). |
| `Avatar` | `avatar.tsx` | `Avatar`/`AvatarImage`/`AvatarFallback`. `size`: `sm` \| `md` \| `lg`. New `tone`: `default` \| `self` (adds an `accent-go` ring, additive/optional). |
| `AvatarStack` | `avatar-stack.tsx` | `members`, `max` (default 4), `size`. Overlapping avatars plus a `+N` overflow chip, separated by a `bg-card`-colored ring. |
| `ThemeToggle` | `theme-toggle.tsx` | V3. Sun/moon pill, the one toggle instance (mounted in `TopBar`). No props beyond `className`; reads/writes theme via `useTheme()`. |
| `AuroraWash` | `illustration/aurora-wash.tsx` | V3. Layered gradient background, both themes via the same `--aurora-stop-*` tokens the ambient body wash uses. Absolutely positioned, fills its nearest positioned ancestor. |
| `FloatShapes` | `illustration/float-shapes.tsx` | V3. 3 to 5 soft blob shapes (CSS, no asset dependency), 8 to 12s float loops, mild pointer parallax. `count`: `3 \| 4 \| 5`. Fully static (no listeners, no animation) under reduced motion. |
| `Hero` | `illustration/hero.tsx` | V3. `AuroraWash` + `FloatShapes` + a content slot in a glass panel. `shapes`/`shapeCount` props. One per page, never behind a dense data surface, see "Restraint rules" in the shared spec. |

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
6's Cmd+K trigger, `notificationSlot` for Agent 2's notification center, `ThemeToggle` (V3), then
sign-out as a circular `IconButton`). V3: `Sidebar`, `TopBar`, and `MobileTabBar` are all glass
chrome now (`surface-canvas` at partial opacity + `backdrop-blur-glass`, `sticky`/`fixed` so
content scrolls underneath), letting the aurora wash read faintly through them even though the
main content column sits on the fully opaque `surface-canvas` (dense data surfaces intentionally
don't show the wash, see the shared spec's "never behind dense data surfaces"). Nav items and role
gating live in `src/components/layout/nav-config.ts`
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
