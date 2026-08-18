# Command palette contract (Agent 6)

`src/components/command-palette/`. Cmd/Ctrl+K opens it from anywhere; `/` opens it in search mode
(unless typing in an input/textarea/contentEditable, or the palette is already open, both suppress
every shortcut except Cmd+K itself). Three modes: Commands (fuzzy filter over every registered
`Command`, role-filtered), Search (delegates to a registered `SearchProvider`, empty until one is
registered), Describe (the NL mode: shift generation for organizer/admin, availability parsing for
member, see `docs/contracts/ai.md`).

## Mounting it

Mounted by Agent 1: `CommandPaletteProvider` + `<TopBar paletteSlot={<PaletteTriggerButton />} />`
in `src/app/(app)/layout.tsx`, `SoundManagerProvider` + `EasterEggListener` in
`src/app/layout.tsx`. See the resolution note under Agent 6's section in `requests.md` for the
exact commit.

`role` is `ShellRole` (`"member" | "organizer" | "admin"`, from `components/layout/nav-config.ts`,
the palette re-exports it as `Role` rather than defining a second copy), the same value already
computed in `get-shell-session.ts`.

## Registering a command: self-registration, not "Agent 6 wires it"

The shared brief says "Agents 3, 4, 5 export plain action functions, you [Agent 6] wire them." In
practice that would mean this module importing code that doesn't exist yet in three other agents'
still-scaffolding territory, a real coordination bottleneck for no benefit. Instead, register from
inside your own component, wherever it mounts:

```tsx
"use client";
import { useEffect } from "react";
import { registerCommand } from "@/components/command-palette";

useEffect(() => registerCommand({
  id: "shifts.create",
  label: "Create shift",
  section: "action",
  shortcut: ["n"],
  roles: ["organizer", "admin"],
  perform: (ctx) => ctx.navigate("/events/new"),
}), []);
```

`registerCommand` returns an unregister function; the effect's cleanup (implicit above, since
`useEffect`'s return value IS that unregister function) removes the command on unmount. Import
`registerCommand` and the `Command`/`CommandContext`/`Role` types from
`@/components/command-palette`, nothing else in this directory is meant to be imported directly.

Reserved shortcuts from the shared brief, currently unbound (no default commands ship from this
module, since none of them are Agent 6's own routes): `g` then `c` (coverage), `g` then `s` (my
schedule), `g` then `a` (availability), `n` (new shift, organizer/admin), `t` (today). Register
under these exact key sequences so the product matches the brief; two commands cannot share a
shortcut, whichever registers last wins the binding silently, coordinate in `requests.md` if that
becomes a real collision.

`roles` omitted means every role. A role-gated command is hidden from the list entirely, not
rendered disabled, per the shared brief.

## Registering a search provider

```ts
import { registerSearchProvider } from "@/components/command-palette";

registerSearchProvider(async (query, { role }) => {
  // return SearchResult[]: { id, label, sublabel?, perform }
});
```

Only one provider at a time (last registration wins); combine sources inside your own provider
function if more than one agent wants to contribute results.

## What ships today vs. what's stubbed

Registry, hotkey engine (global Cmd+K/`/`, per-command single-key and two-key chords with a 900ms
window), palette shell (commands/search/NL tabs as pill tabs, keyboard-navigable results with a
white selected-row pill, role filtering, floating-layer treatment: `bg-card` panel on a black
scrim, hairline border, 24px card radius, no shadow), and the NL mode's round-trip to a confirm
card all work today with zero registered commands. Nothing here is a STUB in the functional sense.
What's not wired yet, because it depends on other agents' surfaces: no commands are registered by
anyone (self-registration pattern above, not blocked on this module), and the NL confirm card's
"create it for real" step (see `docs/contracts/ai.md`, "Open handoff").

## Pill/bento redesign, 2026-08-16 through 2026-08-19

Neumorphism is gone repo-wide (`_shared-context.md`). The palette shell and NL draft cards shipped
first (2026-08-16) against a local `_stub-primitives.tsx` (`STUB(agent-1)`, literal hex constants)
since Agent 1 hadn't published the new primitive library yet. Once they did, this module migrated
onto the real primitives directly: `Card`, `PillButton`, `NeuTabs`/`NeuTabsList`/`NeuTabsTrigger`
(the mode switcher), `NeuBadge` (shortcut hints, parsed time chips), `ShiftCapsule` (hollow station
preview in the shift-generation draft card). `_stub-primitives.tsx` is deleted, `STUB(agent-1)` no
longer appears anywhere under this directory.

## V2, 2026-08-19

- **Motion**: the results list (`command-palette.tsx`) uses `useListStagger()` from
  `@/lib/utils/motion` for its entrance; each new match also gets a small individual fade-in as the
  query narrows, since Framer Motion animates a freshly-mounted list item's own hidden→visible
  transition even when the parent container has already settled. No other motion added here, the
  palette's other interactions (tab switch, row hover) are plain CSS transitions already covered by
  the primitives themselves.
- **`StatusPill` deliberately not used** in the NL confirm cards. Its three states (`approved` /
  `in_approval` / `not_assigned`) all describe a real assignment row; a parsed shift-generation or
  availability draft here isn't an assignment yet in any state; see `docs/contracts/quickchat.md`
  under "Primitives and motion" for the full reasoning. Kept the existing hollow-`ShiftCapsule` +
  orange confidence-dot treatment, both already accurate about "not created yet."
- **Role vocabulary**: `Role` still re-exports the pre-rename `ShellRole` (`"member" | "organizer" |
  "admin"`) as of this commit. Zero code changes needed here once Agent 1 lands the V2 rename
  (`admin | director | member`), this module has always passed `role` through opaquely.
- New this pass, not part of the palette itself: quickchat (`docs/contracts/quickchat.md`), a
  separate five-question preset answer feature under `src/lib/quickchat/` and
  `src/components/quickchat/`, sharing this module's AI-wrapper infrastructure but mounted on the
  member dashboard, not in the palette.
