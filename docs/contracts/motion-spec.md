# Motion spec (v4.1)

Published by Agent 1 (Foundation and Design System), part of the design system alongside
`docs/contracts/design.md`. Motion is the personality of this product, specified with the same
precision as color. The bar: "wow on first sight, invisible by the tenth." Every animation has a
job (orientation, causality, feedback, or one earned moment of delight), runs on transforms and
opacity only, never blocks input, and calms down with familiarity.

Agent 1 implements the preset layer (`src/lib/utils/motion.ts`, section 1 below, plus the generic,
reusable pieces of sections 2 and 5 through 8 that live in Agent-1-owned primitives). Agents 2
through 5 apply the per-surface choreography for their own screens (sections 3, 4, 8, 9) using
those presets, never a hand-rolled Framer Motion `Transition`/`Variants` literal. Agent 6 enforces
(section 11) and owns the palette/AI-reveal choreography specifically.

Every export referenced below lives in `src/lib/utils/motion.ts` unless noted otherwise.

## 0. Laws (override everything below when in conflict)

1. Animate only transform and opacity. Never width, height, top, left, margin, or box-shadow on a
   running animation; fake elevation change by crossfading a pre-rendered shadow layer if ever
   needed. (The sidebar rail's width tween is a deliberate, narrow exception, unchanged since V2:
   see "App-level motion" below.)
2. Entrances fire once per navigation, never on re-render, data refresh, tab return, or Realtime
   updates. Live data changes use the state-change patterns (section 7), not entrances. Discipline
   of usage: mount an entrance's root once per route with a stable key and a static
   `animate="visible"`, never toggle it back to `"hidden"` on a data refetch.
3. Everything is interruptible. A user acting mid-animation wins instantly; springs retarget, they
   do not restart. This is why every "moves" preset below is a Framer spring, not a duration-based
   tween: a spring naturally retargets from its current velocity when its target changes mid-flight,
   a tween restarts from 0.
4. Nothing waits on motion. Content is interactive the frame it exists; choreography is paint, not
   gating.
5. `prefers-reduced-motion` collapses every entry in this document to instant state changes plus
   opacity fades under 100ms. LiveDot pulses become static. Every hook in `motion.ts` branches on
   `useReducedMotion()` internally; `globals.css` has a blanket CSS-level backstop for anything
   driven by a plain CSS transition instead. Tested with the emulation flag per screen, not assumed.
6. Lists longer than 30 items do not stagger; the first 12 cascade, the rest appear with them.
   Implemented as `useCascadeItem()` (per-item, capped) alongside the simpler unbounded
   `useEntranceCascade()`/`useListStagger()`; use the capped version for any list that can plausibly
   exceed 30 rows.
7. One delight moment per flow, from the sanctioned list in section 10. No confetti, ever.

## 1. Timing tokens (Agent 1 exports; nobody invents values)

| Token | Export | Value |
|---|---|---|
| spring-snap | `SPRING_SNAP` | stiffness 480, damping 34 (button presses, toggles, small controls) |
| spring-standard | `SPRING_STANDARD` (= back-compat `SPRING_TRANSITION`/`MORPH_TRANSITION`/`MOTION_DRAWER`) | stiffness 300, damping 30 (cards, panels, morphs, drags) |
| spring-gentle | `SPRING_GENTLE` | stiffness 210, damping 28 (heroes, large surfaces, sheets) |
| spring-collapse | `SPRING_COLLAPSE` | stiffness 375, damping 34; the sidebar rail's collapse-only "0.8x the energy" variant of spring-standard |
| ease-out-fast | `EASE_OUT_FAST` (= back-compat `MOTION_FAST`) | cubic-bezier(0.22, 1, 0.36, 1), 140ms (opacity, color, underline) |
| ease-out-slow | `EASE_OUT_SLOW` (= back-compat `MOTION_BASE`) | same curve, 240ms (page-level fades, theme crossfade) |
| stagger-tight | `STAGGER_TIGHT` | 24ms (chips, table rows, checklist items) |
| stagger-standard | `STAGGER_STANDARD` | 40ms (cards, queue rows) |
| stagger-bars | `STAGGER_BARS` | 28ms (Gantt bars, sparkline series) |
| entrance-rise | via `useMotionPreset()` | 10px translateY plus opacity 0 to 1 on spring-standard |
| entrance-rise-large | via `useHeroEntrance()` | 16px on spring-gentle (heroes only) |

Mirrored as bare numbers in `src/styles/tokens.css` (`--spring-*-stiffness/damping`,
`--ease-out-*-ms`, `--stagger-*`) for any non-Framer consumer.

## 2. App-level motion

- **Page transitions.** Outgoing content fades over 90ms (a plain CSS opacity transition on
  unmount, no hook needed for a value with no state); incoming runs `useMotionPreset()`'s entrance
  choreography. No slide-overs between routes; lateral sliding is reserved for sheets and the rail.
- **Theme toggle.** `startThemeTransition()` drives a View Transitions crossfade at 240ms
  (`globals.css`'s `::view-transition-*` rules); the toggle icon itself rotates 180 degrees on
  spring-snap via its own `animate`/`transition` props. Fallback (no View Transitions support) is
  an instant swap plus the same icon rotation. Implemented: `src/components/ui/theme-toggle.tsx`.
- **Sidebar rail.** Width springs open on spring-standard, collapses on spring-collapse; labels
  fade-slide 6px with a per-index stagger via `EASE_OUT_FAST` plus `delay: index * 0.02`. The
  active-item tint slides between nav items as one continuous `layoutId="nav-active-tint"` element
  (a Framer shared-layout animation, not per-item background fades), so switching pages reads as
  one light moving. Implemented: `src/components/layout/sidebar.tsx`.
- **Command palette** (Agent 6): scrim fades 120ms; the panel scales 0.98 to 1 with a 6px rise on
  spring-standard; results cascade with stagger-tight capped at 8 (`useCascadeItem()`); the
  selection highlight slides between rows like the nav tint (same `layoutId` pattern as the
  sidebar); closing collapses at 0.85 scale-fade in 100ms. Mode tab underline slides on spring-snap.
- **Notification panel** (Agent 2): slides from the right edge 16px plus fade on spring-standard;
  rows cascade stagger-tight; the bell icon does a single 8-degree tilt-and-return on spring-snap
  when a new notification lands (once per batch, silent under reduced motion) — reuse
  `TILT_REFUSE_VARIANTS`/`TILT_REFUSE_TRANSITION` (same small tilt shape, different trigger).
- **Toasts.** Rise 12px plus fade at bottom-right on spring-standard (Radix-driven CSS transition
  inside `Toast`), auto-dismiss fades down 8px (the same base/closed class asymmetry already
  produces this, no extra code). Multiple toasts push each other with layout springs via a
  `motion.div layout` wrapper around each toast, never teleport. Implemented:
  `src/components/ui/toast.tsx`.

## 3. Dashboard choreography (Agent 4, the first impression; exact sequence)

On navigation, a single timeline, total under 700ms perceived:

- 0ms: page title and date fade in (`EASE_OUT_FAST`)
- 60ms: hero card `useHeroEntrance()` (entrance-rise-large)
- 140ms: gradient `GradientPanel` (Ask prog) `useMotionPreset()` entrance-rise, its chips cascading
  stagger-tight starting at 220ms (`useCascadeItem()`)
- 180ms to 260ms: the three stat cards entrance-rise with stagger-standard; each card's number
  begins its `useCountUp()` count-up the frame its card lands
- 320ms: timeline card entrance-rise; markers fade in left to right stagger-tight; the today line
  draws top to bottom 180ms `EASE_OUT_FAST`, last

Nothing else on the page moves after the sequence. Returning to the dashboard within the same
session replays nothing (law 2).

## 4. Schedule and Gantt choreography (Agent 3)

- First render: tracks and axis fade in first (120ms), then bars `useDrawIn()`: each bar scales
  from `scaleX(0)` at its start-time origin to full width on spring-standard, `drawInDelay()`
  ordered left to right by start time, capped at the first 24 bars (clamp the index passed to
  `drawInDelay` at 24, per its doc comment). The now-line draws last, top to bottom.
- View switching (person/station/day/list): shared elements FLIP via a shared `layoutId` per bar
  (Framer's `layout`/`layoutId` props do this natively once each bar has a stable id across views);
  bars that exist in both views spring to their new positions on spring-standard; entering bars
  fade-scale in at 0.96, exiting fade out 90ms.
- Drag: on grab, `whileDrag={{ scale: 1.02, rotate: <0.5 in drag direction> }}` plus crossfading a
  pre-rendered deeper shadow layer's opacity to 1 (never animate `box-shadow` itself, law 1); valid
  drop rows show their hairline at full opacity, the original slot keeps a dimmed ghost. On drop,
  settle with spring-standard overshoot (spring-standard's damping ratio already produces a slight
  overshoot at these values) and fade the ghost; on an invalid drop, spring back home and flash the
  target row's hairline champagne once via `glintTransition(240)`.
- Resize: the grabbed edge follows the pointer 1:1 with 15-minute snap ticks rendered as a
  one-frame opacity blink on the time label at each snap (a plain `animate={{ opacity: [1,0.3,1] }}`
  with a ~1-frame duration, triggered per snap).
- Unassigned tray: removing a chip animates the remaining chips closing the gap with `layout`
  springs; assigning morphs the chip into the bar's avatar via a shared `layoutId`
  (`MORPH_TRANSITION`), not a fade.
- Candidate panel: opens as a morph from the clicked bar (section 5); candidate rows cascade
  stagger-tight (`useCascadeItem()`); the availability dot on each row fades in 60ms after its row.

## 5. Shared-element morphs (the signature move)

Used at exactly these seams, with `layoutId` pairs; never generalize further:

- Shift bar to shift detail panel and back
- Event card to event page header and back
- Quickchat chip to its answer card inside the gradient panel and back
- Person chip to bar avatar on assignment

Rules: the morph runs on `MORPH_TRANSITION` (spring-standard); text inside crossfades at the
midpoint via `MORPH_TEXT_OUTGOING`/`MORPH_TEXT_INCOMING` (outgoing fades over the transition's
first 40%, incoming over the last 40%, starting at 60%); the scrim, if any, fades independently on
its own opacity transition; back-navigation reverses the same morph. If a morph would cross a route
boundary the client cannot animate, degrade to `useMotionPreset()`'s pageTransition, never to a
broken half-morph.

## 6. Numbers and data

- **Count-up**, `useCountUp(target, durationMs?)`: rolls from 0 (or the previous value) over 480ms
  on entrance, 320ms on a live update, ease-out, mono tabular digits so width never shifts. Values
  under 10 animate the decimal smoothly (one decimal place) rather than stepping to an integer.
  Re-renders with an unchanged target do not re-roll.
- **Countdown**, `useCountdown(targetEpochMs)`: ticks once per second with no per-tick animation (a
  ticking number IS the animation); pair `isFinalMinute` with a plain
  `transition-colors duration-1000` class swap to shift the value to `text-accent-warn` over the
  final 60 seconds.
- **Sparklines**: `SPARKLINE_DRAW_TRANSITION` (420ms ease-out) drives the path's
  `strokeDashoffset` from full length to 0 when the parent card enters; the area fill fades in
  during the last 150ms (`AREA_FILL_DELAY_MS`).
- **MeterBar**, `useMeterFill()`: fills from 0 to value on spring-gentle when it enters, springs
  between values on a live update (the spring retargets per law 3, it does not restart); crossing a
  threshold into the champagne (warn) variant crossfades color over 200ms via a plain
  `transition-colors duration-200` class swap.
- **Delta chips**: `DELTA_CHIP_POP_VARIANTS`/`DELTA_CHIP_POP_TRANSITION` (spring-snap, scale 0.9 to
  1) pop in 80ms after their number finishes rolling. Wired into `StatBlock`'s `delta` prop already.
- **Charts on insights**: same draw-in language as sparklines; hovering a point raises a 4px dot on
  spring-snap with the tooltip fading 100ms.

## 7. State changes (live data, statuses, approvals)

- **Status dot changes** (pending to approved): the atom of the approval experience.
  `StatusPill` (`src/components/ui/status-pill.tsx`) implements this directly: the dot crossfades
  color over 200ms (plain CSS), the text swaps via a 6px vertical slot-machine slide
  (`STATUS_TEXT_SLIDE_VARIANTS`/`STATUS_TEXT_SLIDE_TRANSITION`, old up-out new up-in, 180ms,
  overlapping via `AnimatePresence mode="popLayout"`).
- **A member watching their own shift get approved**: the row's hairline glints once
  (`glintTransition(500)`, a 1px purple opacity sweep) alongside the `StatusPill` change.
- **Approval batch** (Agent 3/4): rows check off top to bottom with stagger-tight
  (`useCascadeItem()`), each row's dot-and-text doing the status atom above, then approved rows
  compact out with `layout` springs after a 400ms hold. The floating action bar slides down and
  away last. This full sequence is the section 10 delight moment "approval batch completion sweep"
  and is owned by whichever agent builds the approval queue screen, using the primitives above.
- **Realtime changes from others** (a bar moves, a count changes): the element springs to its new
  state with spring-standard and a `glintTransition(300)` hairline glint marks what changed. No
  entrances, no cascades.
- **Swap lifecycle**: claiming morphs the Claim button into the claimed-state chip (`layoutId`,
  `MORPH_TRANSITION`); approval resolves both affected rows with the status atom simultaneously.

## 8. Availability, campaigns, classes (Agent 4)

- **Paint**: cells fill with a 90ms scale-from-0.6 of the inner fill square as the pointer crosses
  them; painting a drag run feels like a brush, each cell popping independently. Erasing reverses at
  60ms. No animation on programmatic bulk sets.
- **AI draft rows and cells**: fade in as dashed at 40%, then a gentle 1.2s single shimmer sweep
  invites confirmation; confirming solidifies all drafts with stagger-tight; clearing fades them
  120ms.
- **Class-block locked cells**: painting over one triggers `TILT_REFUSE_VARIANTS`/
  `TILT_REFUSE_TRANSITION` (2-degree tilt-and-return, spring-snap) on the little book icon; no red,
  no shake.
- **Campaign deadline line**: turning champagne inside 48h is a plain 300ms color fade on next load,
  not a live flip.
- **Submit availability**: the save tick draws its checkmark path over 240ms; if this is the
  member's first-ever submission, the sanctioned delight moment (section 10) plays instead.

## 9. Day-of, kiosk, tours, AI (Agent 3 and Agent 6)

- **Day-of columns**: rows move between On now / Up next / Gaps with FLIP `layout` springs; a
  no-show marking slides the row to Gaps with its dot crossfading to warn-hot mid-flight. New gaps
  glint warn-hot once (`glintTransition`). Blast confirm morphs the compose sheet into a sent tick.
- **LiveDot**: 2s opacity pulse between 55% and 100%, desynchronized per dot by a random phase
  (seed the phase from the dot's own id/index, not `Math.random()` in render, to stay stable across
  re-renders) so a wall of dots never strobes in unison.
- **Kiosk**: entrance cascade once at boot, then only state-change motion; every 45s the board
  performs a 1px position drift (burn-in safety) below perception. Auto-refresh changes use the
  Realtime glint pattern scaled up 1.5x for across-the-room legibility.
- **Tours**: the spotlight cutout morphs between anchor targets on spring-gentle (one moving hole);
  the coach card follows on spring-standard with a 60ms delay so the spotlight leads; step dots
  fill with the MeterBar spring.
- **Quickchat**: the tapped chip morphs into the answer card (section 5, `layoutId`,
  `MORPH_TRANSITION`); answer text fades in as one block in 120ms, never typewritten.
- **AI fill reveal** (Agent 6, the single most choreographed moment in the product): the Fill gaps
  button morphs into a slim progress line inside the `GradientPanel`; proposed bars then `useDrawIn`
  onto the Gantt in champagne, `drawInDelay()` (stagger-bars), ordered by start time; as the last bar
  lands, the approval queue badge count-ups (`useCountUp`) and the gradient panel's line morphs into
  a summary sentence with a Review pill. Total budget 1.4s for a typical fill; cap the bar cascade
  at 24 with the remainder appearing together (same cap as section 4's first render). If the model
  fell back, the deterministic fill uses the identical reveal; the choreography is the product's,
  not the model's.

## 10. The delight budget (complete list; nothing else qualifies)

1. First-ever availability submission: the checkmark draw expands into a brief 600ms radial
   hairline ripple from the tick. Once per account, ever. (Agent 4)
2. AI fill reveal, as specified above. (Agent 6)
3. Approval batch completion sweep, as specified above. (Agent 3/4)
4. The 404 easter egg (existing, unchanged). (Agent 1/6, already shipped)

These are the only earned-moment animations. Anything else proposed goes through
`docs/contracts/requests.md` with a reason.

## 11. Performance and enforcement

- **Budget**: every animated surface holds 60fps on a mid-range phone (throttled CPU 4x in devtools
  as the proxy). The Gantt drawIn and availability painting are the two mandatory profile targets.
- `will-change` is applied on interaction start and removed on rest; never left on standing
  elements. No animated filters, no animated blur anywhere (consistent with V4's blur being
  restricted to two static floating layers, dialogs and the palette, never an animated property).
- FLIP/`layout` animations are scoped to visible elements only; virtualized or offscreen rows never
  run them.
- **Agent 6 enforcement additions**: entrances replaying on re-render or Realtime updates; staggers
  on lists over 30 not using `useCascadeItem()`'s cap; any animation outside Agent 1's presets or
  this spec's named patterns; delight moments outside section 10; reduced-motion failures per
  screen; dropped frames on the two mandatory profile targets.
