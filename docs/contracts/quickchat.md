# Quickchat contract (Agent 6: AI & Command Layer)

V2's "new hero feature" (`_shared-context.md`'s V2 iteration prompts). Five preset member
questions, answered instantly from real data, never free text, never a wrong number. Full pipeline
lives under Agent 6's territory: `src/lib/quickchat/`, `src/app/api/quickchat/`,
`src/components/quickchat/`.

## Mounting it

```tsx
import { QuickchatRow } from "@/components/quickchat";

<QuickchatRow />
```

Self-contained: fetches its own answers via `POST /api/quickchat`, no props, no data to pass in.
Drop it wherever the dashboard layout wants the quickchat row (the brief calls for it directly
under the four-region dashboard, full width). It renders its own loading (`Skeleton`), error, and
empty states.

## The five queries and how honest each answer is today

| Query | Label | Real today? | Source |
|---|---|---|---|
| `schedule` | "When am I scheduled" | Real, scoped to the current/default event | `getMemberSchedulePageData()` (Agent 4) |
| `next_event` | "What event is next" | Real | Direct query, nearest future `starts_at` among published events |
| `hours` | "How many hours do I have" | Real, both figures | `hours_per_event()` / `hours_semester()` RPCs (Agent 2, `20260817000400_v2_announcements_and_hours.sql`), `approved`-state assignments only, per the V2 "scheduled hours only" decision |
| `coworkers` | "Who is working with me" | Real | `getMemberSchedulePageData()` + `getOpenShiftsPageData()` (both Agent 4), composed, self filtered out |
| `open_shifts` | "Open shifts I can take" | Real | `getOpenShiftsPageData()` (Agent 4), `!isFull && !isMine` |

Every answer above is computed from real, already-published data (reading another agent's
exported interface, not editing their file, per the file-ownership rule). Nothing here is
`STUB(agent-N)`. The one caveat: `schedule`/`hours`/`coworkers`/`open_shifts` inherit the "current/
default event" scoping that `getAvailabilityEventById`'s own doc comment calls an interim
heuristic pending Agent 3's real event-context contract, so a member with shifts across multiple
concurrent published events would only see the default one's data. Not blocking, just honest about
today's scope; revisit once Agent 3 publishes multi-event context.

## Architecture: deterministic template, optional rephrase, never a free-text box

1. `src/lib/quickchat/build-answers.ts`: pure, deterministic sentence builders, one per query kind,
   no I/O, unit-testable. This is the complete, correct v1 of quickchat on its own.
2. `src/lib/quickchat/data.ts`: fetches real data, calls the builders. `getQuickchatAnswer(kind)`.
3. `POST /api/quickchat` (`{ kind }`): returns the template answer, instantly, no Gemini call on
   this path at all.
4. `POST /api/quickchat/rephrase` (`{ kind, template }`): a strictly-later, optional background
   upgrade the client fires after the template already rendered. Server decides eligibility by
   `kind`, not a client-supplied flag: `coworkers` answers name other members and are never sent to
   Gemini, no exceptions, per the shared rule against sending member personal data to any AI model.
   The other four kinds are name-free (times, counts, event names) and are eligible.
   `preservesFacts()` (`src/lib/ai/kinds/quickchat-rephrase.ts`) rejects any rephrase that changes a
   digit run from the template (a time, an hours figure, a count): on rejection, or on any
   `AiResult` failure, the endpoint just echoes the template back. The client only swaps the
   displayed text in if `source: "rephrased"` comes back, never blocking the first render on it.

This is why the brief's "instant and never wrong" holds structurally, not just by convention: the
first response a member ever sees is the deterministic template, and the only thing that can ever
replace it is a fact-preserving rephrase or nothing.

## `quickchat_rephrase`, the 5th AI kind

Registered like the other four in `src/lib/ai/kinds/registry.ts` / `AiKind` (`docs/contracts/
ai.md`). Input `{ template: string }`, output `{ text: string }`, fallback `{ text: input.template
}` (so a missing API key, rate limit, or timeout is indistinguishable from "no rephrase happened,"
by design). Not cached: answers are personalized (this member's next shift, this member's hours),
a per-user template is already close to unique, caching would rarely hit.

## Primitives and motion

`QuickchatRow` was first built against `PillButton`/`Card` (published in the V1 redesign) since
Agent 1's V2 primitive pass hadn't landed yet when this started; once `QuickchatButton`/
`QuickchatAnswerCard` (`src/components/ui/quickchat.tsx`) published mid-pass, `quickchat-row.tsx`
was updated to the real primitives directly rather than shipping the interim version, since the
swap cost one file and landed inside the same commit. The active/selected button state (`bg-pill-
white text-on-accent`, no dedicated prop on `QuickchatButton`) is a `className` override at the
call site, matching the same "white pill = selection" convention `NeuTabsTrigger`'s active state
uses. The answer card's entrance uses `useMotionPreset()` (the `pageTransition` preset, fade + 8px
rise) from `src/lib/utils/motion.ts`; the results-style button row itself is not stagger-animated
(would re-trigger on every keystroke elsewhere in the palette, not here, but kept consistent:
quickchat's five buttons are static, only the answer card is new content worth announcing).

**Not using `StatusPill` here, deliberately.** Agent 1's V2 brief marks NL confirmation cards
(`src/components/command-palette/modes/nl-mode.tsx`) as a spot to restyle onto `StatusPill`
conventions, but `StatusPill`'s three states (`approved` / `in_approval` / `not_assigned`) all
describe a real assignment row. An NL-parsed shift or availability draft in the palette is not an
assignment yet, in any state, it is a preview that has not been submitted anywhere (see the "Open
handoff" section below): labeling it `not_assigned` would misrepresent it as an assignment that
exists and lacks a person, which is not what "hasn't been created yet" means. Kept the existing
hollow-`ShiftCapsule` / orange-confidence-dot treatment there instead, both already accurate.
`quickchat`'s own answer text has no per-item status to show either (a sentence, not a list of
assignment rows), so there was no natural `StatusPill` slot to add on this side either.

## Not built this pass

- **AI auto-schedule rewiring** (V2 Agent 6 item 2): as of this commit, nothing in the app calls
  `autofill_rationale` or `gap_analysis` from any UI yet (verified: no import outside `src/lib/`,
  same as the V1 finding in `pending.md`), so there is no existing "separate draft layer" to
  rewire. `rankAutofillCandidates`' output shape already carries everything a future write path
  needs (`profileId`, `conflict.reasons` for the `warnings` column, ready for `proposed_by: 'ai'`)
  and needed one real fix this pass: it referenced a removed `isBlocked` helper after Agent 3's
  conflict-engine downgrade (V2 shared decision: hard limits are gone), fixed by deleting the now-
  meaningless filter, see `pending.md`. Filed the target contract for whoever builds the write path
  in `requests.md`, addressed to Agent 3.
- **Palette role-gating changes**: `CommandContext.role` re-exports Agent 1's `ShellRole`
  (`components/layout/nav-config.ts`), still `"member" | "organizer" | "admin"` as of this commit
  (not yet renamed to the V2 `admin | director | member` vocabulary). No code change needed on
  this module's side once it renames, per the same pass-through design from V1. Agent 6 registers
  no commands itself (self-registration pattern, `command-palette.md`), so there is nothing to
  "retire" here either; the palette-updates item is really about what Agents 3/4/5 register.
