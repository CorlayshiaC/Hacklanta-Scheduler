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

## Pill/bento redesign, 2026-08-16

Neumorphism is gone repo-wide (`_shared-context.md`). Agent 1 has not published the new
`tokens.css`/`components/ui/` yet as of this commit, so the palette shell and NL draft cards are
built against `src/components/command-palette/_stub-primitives.tsx` (`STUB(agent-1)`, literal hex
constants from the shared spec, e.g. `#131313` bg-card, `#1E1E1E` bg-elevated, `#A78BFA` purple,
`#FF9F2E` orange). Swap for Agent 1's real `Card`/`PillButton`/`FilterPill` once published,
tracking removal: grep `STUB(agent-1)` under `src/components/command-palette/`. Props are kept
close to what the eventual real primitives will need (`variant`, `active`, `className` passthrough)
so the swap should mostly be an import change, not a rewrite.
