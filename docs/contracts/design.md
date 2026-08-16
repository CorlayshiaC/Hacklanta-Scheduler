# Design contract

Published by Agent 1 (Foundation and Design System). Token names and primitive APIs here are
stable as of this commit; a breaking prop-API change after today gets posted in
`docs/contracts/requests.md` addressed to all agents. Live examples of every primitive in every
state: `/design` (dev-only route, under `src/app/(app)/design/`).

## Source of truth

- `src/styles/tokens.css`: every color, shadow component, radius, and motion value as CSS custom
  properties. Do not redefine these anywhere else.
- `tailwind.config.ts`: the Tailwind-facing mapping of those tokens to utility classes. Do not add
  colors or shadows here, request additions in `docs/contracts/requests.md`.
- `src/components/ui/`: the primitive library. Features import these, never hand-roll a shadow or
  color.
- `src/lib/utils/`: `cn` (class merging), `formatShiftTime` / `formatShiftDate` / `formatShiftRange`
  / `formatShiftDuration` / `getShiftDurationMinutes`, and `useMotionPreset` (reduced-motion-aware
  Framer Motion config).

## Tokens

| Token | Value | Tailwind utility |
|---|---|---|
| `--bg-base` | `#0c0c12` | `bg-bg-base`, `text-bg-base`, `border-bg-base`, opacity modifiers work (`bg-bg-base/50`) |
| `--bg-surface` | `#14141c` | `bg-bg-surface` (the default raised/floating surface color) |
| `--bg-sunken` | `#0a0a0f` | `bg-bg-sunken` (pressed wells) |
| `--purple-500` | `#8b5cf6` | `bg-purple-500`, `text-purple-500`, `border-purple-500` |
| `--purple-400` | `#a78bfa` | `bg-purple-400`, `text-purple-400`, `border-purple-400` (focus rings, accents) |
| `--purple-glow` | `rgba(139,92,246,.25)` | used inside the `shadow-neu-glow`/`shadow-neu-floating` utilities, not a standalone color utility |
| `--text-primary` | `#ededf2` | `text-text-primary` (15.7:1 on `bg-surface`, AAA) |
| `--text-secondary` | `#9b9bad` | `text-text-secondary` (6.7:1 on `bg-surface`, AA) |
| `--text-muted` | `#5e5e70` | `text-text-muted`, **decorative/non-essential only, see Contrast floor** |
| `--border-hairline` | `rgba(255,255,255,.05)` | `border-hairline` |
| `--warning` | `#fcd34d` | `text-warning`, `bg-warning`, `border-warning` (12.7:1 on `bg-surface`) |
| `--danger` | `#f87171` | `text-danger`, `bg-danger`, `border-danger` (6.6:1 on `bg-surface`) |
| `--coverage-0..4` | transparent through 42% purple | `bg-coverage-0` .. `bg-coverage-4`, used by `GridCell` |

Opacity modifiers (`bg-purple-500/10`, `border-danger/40`) work on every solid color above except
`purple-glow` and `coverage-*` (already alpha-bearing). This required a second `--x-rgb` CSS
variable per color (space-separated channels) so Tailwind could substitute `<alpha-value>`, plain
`var(--x)` colors silently produce no CSS for opacity-modified classes, verified empirically
against this exact Tailwind version. If you add a new solid color, add its `-rgb` sibling too.

**Radii**: `rounded-neu` (16px, cards/panels/dialogs' larger sibling `rounded-neu-lg` at 20px),
`rounded-neu-sm` (10px, controls/inputs/badges/grid cells).

**Shadows**: `shadow-neu-raised` (resting raised surface), `shadow-neu-raised-sm` (subtler),
`shadow-neu-raised-lg` (hover-lifted), `shadow-neu-pressed` (inset well), `shadow-neu-glow`
(purple halo, one primary action per view), `shadow-neu-floating` (flat + ambient shadow + subtle
glow, dialogs/popovers/tooltips/toasts), `shadow-neu-focus` (the focus ring, every interactive
primitive uses `focus-visible:shadow-neu-focus`).

**Motion**: `duration-fast` (120ms), `duration-base` (200ms), `ease-neu-out`. `useMotionPreset()`
from `@/lib/utils/motion` for Framer Motion consumers, respects `prefers-reduced-motion`
automatically. Plain CSS transitions should add `motion-reduce:transition-none` /
`motion-reduce:animate-none` themselves (see `Skeleton`, `Spinner`, `NeuToggle`).

**Type**: `font-sans` (Geist Sans, loaded in `src/app/layout.tsx`), `font-mono` (Geist Mono).
Tailwind's built-in `tabular-nums` utility on every time, count, or code display.

## Contrast floor

Verified against the exact hex values above (WCAG relative-luminance contrast ratio):

- `text-primary` on `bg-surface`/`bg-sunken`: ~15.7:1. Always safe.
- `text-secondary` on `bg-surface`/`bg-sunken`: ~6.7:1. Safe for body text.
- `text-muted` on `bg-surface`: ~2.9:1. On `bg-base`: ~3.1:1. **Fails AA for normal text on both
  surfaces** (needs 4.5:1) and only just clears the large-text/non-text floor (3:1) on `bg-base`.
  Restrict to decorative or genuinely non-essential text (a faint helper caption, a disabled icon),
  never a label someone must read to use the product.
- `purple-400` on `bg-surface`: ~6.7:1. Safe for focus rings, accent text, active nav labels.
- A solid `purple-500` fill under `text-primary` measures ~3.6:1, under white it's ~4.2:1: **both
  fail AA for normal-size button text.** This is why `NeuButton`'s `primary` variant is a raised
  dark surface with a purple glow halo and a purple-400 border, not a solid purple-500 fill, see
  `src/components/ui/neu-button.tsx`. It is also why the shared spec's "never large flat purple
  fills" rule and the AA floor point at the same answer: **if a color choice and the contrast floor
  disagree, change the treatment, never the text token.**

## Semantic depth rule

Raised = present/complete. Pressed = empty/recessed, a hole you can feel. Floating = temporary,
layered above the page (dialogs, popovers, tooltips, toasts: flat surface + hairline + a soft
ambient shadow + a subtle glow, never the dual-shadow raised/pressed treatment, it reads muddy
stacked on top of page content).

This product's specific application, implemented in `GridCell` (`src/components/ui/grid-cell.tsx`,
the shared primitive behind every schedule grid): an empty shift cell is a pressed well. As it
fills toward its needed headcount it rises to a raised surface with a purple tint proportional to
coverage (`coverage-0` through `coverage-4`, capped at 42% alpha so a full cell stays calm rather
than becoming a flat purple block). A fully staffed cell adds a purple-400 hairline border, not a
solid fill. `conflict` state overrides the coverage tint with a `border-danger` hairline plus a
small warning dot. `selected` (availability painting) is its own axis, not headcount: a pressed
well that fills toward purple as a member paints it, still sunken since it represents a choice, not
a completed count. Every coverage state must also be legible without color: pass `filled`/`needed`
for a mono `2/3` count, depth (sunken vs. raised) carries meaning on its own for colorblind users.

## Primitive reference

All in `src/components/ui/`, all `forwardRef`, all keyboard-operable with a visible
`focus-visible:shadow-neu-focus` ring on every real interactive control (floating-layer containers
like `PopoverContent`/`TooltipContent` are not themselves focusable, their trigger is).

| Component | File | Notes |
|---|---|---|
| `NeuCard` | `neu-card.tsx` | `interactive`, `padded` props. Interactive adds hover lift, Enter/Space activation, `role="button"`. |
| `NeuButton` | `neu-button.tsx` | `variant`: `primary` (glow, not a fill) \| `default` \| `ghost` \| `destructive`. `size`: `sm` \| `md` \| `lg`. |
| `NeuInput` | `neu-input.tsx` | Pressed well. `invalid`, `errorMessage` props, wires `aria-invalid`/`aria-describedby` when `id` is set. |
| `NeuTextarea` | `neu-textarea.tsx` | Same pattern as `NeuInput`, `rows` defaults to 3. |
| `NeuSelect` | `neu-select.tsx` | Flat controlled API over Radix Select: `options`, `value`/`onValueChange`, not the compound Root/Trigger/Item API. |
| `NeuToggle` | `neu-toggle.tsx` | Wraps Radix Switch, props = `SwitchPrimitive.SwitchProps` directly. |
| `NeuCheckbox` | `neu-checkbox.tsx` | Wraps Radix Checkbox, supports `checked="indeterminate"`. |
| `NeuWell` | `neu-well.tsx` | Static pressed container. `size`: `sm` \| `md`. Group form fields or show a quiet summary block. |
| `NeuBadge` | `neu-badge.tsx` | `variant`: `default` \| `purple` \| `warning` \| `danger`. Outline treatment, no solid fills. |
| `NeuTabs` | `neu-tabs.tsx` | `NeuTabs`/`NeuTabsList`/`NeuTabsTrigger`/`NeuTabsContent`, thin wrap of Radix Tabs. |
| `GridCell` | `grid-cell.tsx` | The shared schedule-grid primitive. `state`: `empty` \| `partial` \| `full` \| `selected` \| `conflict`. `coverage` (0-1), `filled`/`needed`, `interactive`, `size`. See Semantic depth rule above. |
| `Skeleton` | `skeleton.tsx` | Pressed placeholder, `animate-pulse`. Size via `className`. |
| `Spinner` | `spinner.tsx` | `size`: `sm` \| `md` \| `lg`. `label` prop (default "Loading") for the sr-only accessible name. |
| `Dialog` | `dialog.tsx` | `Dialog`/`DialogTrigger`/`DialogContent`/`DialogHeader`/`DialogFooter`/`DialogTitle`/`DialogDescription`/`DialogClose`, wraps Radix Dialog. Floating layer. |
| `Popover` | `popover.tsx` | `Popover`/`PopoverTrigger`/`PopoverContent`, wraps Radix Popover. Floating layer. |
| `Tooltip` | `tooltip.tsx` | `TooltipProvider` (mounted once in `src/app/layout.tsx`, do not remount), `Tooltip`/`TooltipTrigger`/`TooltipContent`. |
| `Toast` | `toast.tsx` + `use-toast.ts` | `<Toaster/>` mounted once in `src/app/layout.tsx`. Trigger from anywhere with `toast({ title, description, variant, action })` from `use-toast.ts`. `variant`: `default` \| `destructive`. |
| `Avatar` | `avatar.tsx` | `Avatar`/`AvatarImage`/`AvatarFallback`, wraps Radix Avatar. `size`: `sm` \| `md` \| `lg` (pass to both `Avatar` and `AvatarFallback`). |
| `AvatarStack` | `avatar-stack.tsx` | `members`, `max` (default 4), `size`. Renders overlapping avatars plus a `+N` overflow chip. |

## Spacing and density

Linear-style density: compact rows (control height 40px / `h-10`, matching `NeuButton` `md` and
`NeuInput`), generous section spacing (`gap-6`/`gap-8` between page sections, not between rows
inside one), max two levels of card nesting (a `NeuCard` inside a `NeuCard` is the ceiling, don't
nest a third). Page container: `max-w-6xl` centered, set once in `src/app/(app)/layout.tsx`, do not
re-wrap it inside feature pages.

## Do / don't

- Do use `GridCell` for every schedule grid (coverage board, availability grid, my-schedule week
  view). Don't hand-roll a grid cell, even a "simple" one, the semantic depth rule needs to be
  consistent across all three surfaces for the product to read as one system.
- Do use the glow treatment for the one primary action per view. Don't add a second glowing
  element on the same screen, and don't reach for a solid purple fill as a shortcut to "make it
  pop", it fails the contrast floor and the shared spec bans it.
- Do use `text-secondary` for anything a user needs to read. Don't use `text-muted` for it, see
  Contrast floor.
- Do use `shadow-neu-floating` for anything that layers over page content. Don't use
  `shadow-neu-raised`/`shadow-neu-pressed` there, stacked dual-shadow neumorphism on a floating
  layer reads muddy.
- Do request a new token in `docs/contracts/requests.md` if you need a color or shadow that isn't
  here. Don't define one locally, even "just this once".

## App shell

`src/app/(app)/layout.tsx` (route group `(app)`, not `(shell)` as originally briefed, see
`docs/contracts/requests.md` for why) wraps every authenticated route: `Sidebar` (desktop,
`src/components/layout/sidebar.tsx`), `MobileTabBar` (mobile, `mobile-tab-bar.tsx`), `TopBar`
(`topbar.tsx`, with `paletteSlot` for Agent 6's Cmd+K trigger and `notificationSlot` for Agent 2's
notification center). Nav items and role gating live in `src/components/layout/nav-config.ts`
(`NAV_ITEMS`, `navItemsForRole`, `mobileTabItemsForRole`). Role is resolved by
`src/app/(app)/get-shell-session.ts`, currently a `STUB(agent-2)`, see `docs/contracts/pending.md`.
`src/components/layout/app-shell.tsx` and `app-nav.tsx` are the old per-page HackLanta shell,
superseded but left in place until the pages that still import them migrate, see
`docs/contracts/requests.md`.
