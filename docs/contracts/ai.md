# AI contract (Agent 6: AI & Command Layer)

Published by Agent 6. `src/lib/ai/` is the only place in the repo allowed to import `@google/genai`
(enforced by `eslint.config.mjs`'s `no-restricted-imports` and by `server-only` on every file in
the module, which hard-fails at build/runtime if bundled client-side). Everyone else calls the
typed exports from `src/lib/ai/index.ts` (server code) or the two `/api/ai/*` routes (client code).

## The rule every caller must follow

`generate(kind, input)` (and every typed wrapper built on it) returns `AiResult<T>`, never throws:

```ts
type AiResult<T> =
  | { ok: true; data: T; source: "model" | "cache" | "fallback" }
  | { ok: false; reason: "no_api_key" | "rate_limited" | "timeout" | "invalid_response" | "provider_error"; message: string };
```

Handle `ok: false` by falling back to the feature's manual path (the bulk-generate form, the
availability grid, a plain greedy fill) with `message` shown as-is, it is already written for a
user, not a log. Do not distinguish `source: "model"` from `"fallback"` in the UI beyond the
brief's own convention (a small orange dot beside a low-confidence field where a kind has a
confidence value, see the pill/bento redesign note below, updated from the earlier purple-
underline treatment); both are a real answer the caller confirmed nothing further about.

## Wrapper behavior (`src/lib/ai/`)

- Server-side only, key in `GEMINI_API_KEY`. Unset key: every kind returns its `fallback` (or
  `ok: false` if the kind has none) with `reason: "no_api_key"`. Proven by unsetting the key
  locally and confirming every feature below still works via its manual path.
- Global and per-user token buckets in `rate-limiter.ts`, sized in `config.ts`. Defaults are the
  best cross-referenced free-tier numbers for `gemini-2.5-flash` as of 2026-08-16 (10 RPM /
  250,000 TPM / 500 RPD), Google's docs no longer publish a static table, see the sourcing comment
  in `config.ts` for where to re-check and the env vars that override them. This is a
  per-instance, best-effort proactive throttle, not the real backstop: a genuine 429 from Gemini
  triggers `reportProviderRateLimited()`, which halves the local rate and starts a 60s cooldown
  regardless of what the configured numbers say.
- `acquireSlot` polls for up to `GEMINI_QUEUE_TIMEOUT_MS` (default 3000ms), returns
  `reason: "rate_limited"` on timeout instead of blocking. `GEMINI_REQUEST_TIMEOUT_MS` (default
  12000ms) bounds the actual Gemini call the same way, `reason: "timeout"`.
- Response cache: STUB(agent-2), keyed by `sha256(kind + stable-stringified input)` in an
  `ai_cache` table that does not exist yet (requested in `schema-requests.md`). Reads and writes
  both fail open (any error, including a missing table, is a cache miss), so caching activates
  automatically once the migration lands, no code change needed here. TTL is per-kind, see below.
- Every output is Zod-validated against the kind's schema and scanned for the shared banned-word
  list, an em dash, any `!`, and the "Ready to X?" construction (`banned-words.ts`); either failure
  is treated exactly like a schema-validation failure, the kind falls back.

## Kinds

All four live in `src/lib/ai/kinds/`. Input/output types and Zod schemas are exported per file,
import from there, not from `generate.ts`'s internals.

### `shift_generation`

- Route: `POST /api/ai/shift-generation`, organizer/admin only (`getRoleAuthorization("organizer")`).
- Input: `{ phrase, nowIso, timezone }`. `nowIso` is caller-supplied so relative terms ("friday")
  resolve consistently and are testable.
- Output mirrors `bulkGenerationInputSchema` from `src/lib/scheduling/bulk-generation.ts` minus
  `stationId`: `{ windowStart, windowEnd, blockLengthMinutes, stations: { name, headcount }[],
  confidence: { windowStart?, windowEnd?, blockLengthMinutes?, stations? }, clarifications: string[] }`.
  Station names, not ids: this kind cannot know a real `shift_roles.id`, matching an existing
  station or creating a new one is the confirm UI's job. See "Open handoff" below.
- Cache: 600s. Fallback: none (`ok:false`), free text has no deterministic equivalent, the
  organizer uses the manual bulk-generate dialog instead.

### `availability_parse`

- Route: `POST /api/ai/availability-parse`, any authenticated active member.
- Input: `{ phrase, rangeStart, rangeEnd, timezone }`. Output: `{ windows: { startsAt, endsAt }[],
  confidence, clarifications }`, concrete instants expanded across the range (matches
  `availability_windows`' insert shape), not a recurring pattern left unexpanded.
- STUB(agent-4): shape assumed, not confirmed against a published `paintDraft` contract, Agent 4
  has not published one yet. Adjust once they do, logged in `pending.md`.
- Cache: 600s. Fallback: none, the member uses the manual grid, which the brief calls "already good".

### `gap_analysis`

- No route: called server-side directly (`generateGapHeadlines`), the coverage board that needs it
  is already server-rendered, an HTTP round trip for data it already computed would be pure
  overhead.
- The gap list is entirely code, not model output: `buildGapDescriptorFromCell(cell: ShiftCell,
  availableUnassigned: number)` in `kinds/gap-analysis.ts` turns one of Agent 3's `ShiftCell`s
  (`src/lib/scheduling/types.ts`) into `{ label, shortBy, availableUnassigned }` once the caller
  supplies the availability-match count (that part needs both coverage and availability data,
  stays in Agent 3's territory per `conflict-engine.ts`'s own doc comment). Gemini only writes one
  `text` headline per gap, batched in one call. Cache: 300s.
- Fallback: `templateHeadline()`, produces exactly `"${label} is ${shortBy} short. ${n} available
  members are unassigned."`, the example string from the brief itself. No alarmist styling either
  way: render in `text-secondary` with a small leading orange dot (updated by the pill/bento
  redesign from the earlier purple dot, orange is now the gap/attention accent, see
  `docs/contracts/requests.md`'s note to Agent 3), never a filled warning background.

### `autofill_rationale`

- No route: called server-side directly (`generateAutofillRationales`) from the coverage board's
  gap-fill action.
- Ranking and eligibility are deterministic code, never model output, per this brief's constraints
  section (which overrides deliverable 3's looser "Gemini ranks" phrasing, see the doc comment in
  `kinds/autofill.ts` for why). `rankAutofillCandidates` reuses `checkAssignmentConflicts` from
  `src/lib/scheduling/conflict-engine.ts` exactly as that file's own doc comment names this module
  as a consumer, sorts `ok` before `warning` then by fewest hours assigned, and anonymizes to
  `candidate_1, candidate_2, ...` before anything reaches the model. No real name, id, or email is
  ever in a prompt. **V2 update**: no longer filters anything out. Agent 3's conflict-engine
  downgrade (hard limits are gone, V2 shared decision) removed the `blocked` variant from
  `ConflictCheckResult` entirely, so every candidate is now rankable; `warning.reasons` is exactly
  what a future write path should store in the assignment's `warnings` column.
- Gemini gets `{ gapLabel, candidates: { anonId, conflict, assignedHoursThisWeek }[] }` and returns
  one `text` rationale per `anonId`, map back to `profileId` locally to render. Not cached
  (contextual to one gap at one moment). Fallback: a deterministic one-line sentence built from the
  same facts, this is the "pure greedy fill, no model" path, greedy fill and ranking are the same
  code path with or without the model, only the sentence differs.

### `quickchat_rephrase` (V2)

- No route of its own inside `src/app/api/ai/`: called from `POST /api/quickchat/rephrase`, see
  `docs/contracts/quickchat.md` for the full quickchat contract. Input `{ template: string }`,
  output `{ text: string }`, fallback echoes the template unchanged.
- The one kind whose fallback and "the model declined to help" are supposed to look identical:
  quickchat's instant template answer already fully answers the question, this kind only exists to
  optionally reword it. Callers must additionally run `preservesFacts(template, output.text)`
  (exported from this file) before trusting a rephrase: every digit run in the template must
  survive unchanged, in order, or the rephrase is discarded. This check is outside `generate()`'s
  generic pipeline (schema validation and the banned-word scan can't see the input to compare
  against), it is quickchat's own responsibility every time it calls this kind.
- Never called for an answer that names another member (`docs/contracts/quickchat.md`'s
  `coworkers` query): the shared rule against sending member personal data to any AI model has no
  "just rephrasing" exception.

## AI auto-schedule, V2 status

The V2 shared decisions retarget every assignment write (admin, director, AI, swap-resulting) to
land as `in_approval` with a `proposed_by` column (Agent 2's approval-flow migration). As of this
commit nothing in the app actually calls `autofill_rationale` or `gap_analysis` from a UI yet
(verified: no import of either outside `src/lib/`), so there is no existing draft layer to
"rewire," the V1 brief's assumption that one existed was ahead of what had actually been built.
What's ready for whoever builds the write path (most likely Agent 3, the coverage board's gap-fill
action): `rankAutofillCandidates`'s `RankedCandidate[]` already carries `profileId` and
`conflict.reasons`, everything needed to write `proposed_by: 'ai'` and a `warnings` column per
assignment. Filed as a request in `requests.md`.

## Pill/bento redesign, 2026-08-16

Neumorphism is gone repo-wide, replaced by the flat black pill/bento language (`_shared-context.md`).
Agent 1 has not published the new `tokens.css`/`components/ui/` yet as of this commit, so
`src/components/command-palette/_stub-primitives.tsx` (STUB(agent-1)) implements the command
palette and NL draft cards against the shared spec's literal hex constants directly. Swap once
Agent 1 publishes, tracking removal: grep `STUB(agent-1)` under `src/components/command-palette/`.

The AI-affordance conventions that changed, for whoever renders these next (mostly Agent 3, since
`gap_analysis` and `autofill_rationale` render inside the coverage board, not a file Agent 6 owns):

- **Low confidence**: a small orange dot leading the value, not a purple underline. Implemented in
  the palette's draft cards as `ConfidenceDot`; the same convention should carry into
  `autofill_rationale`'s eligible-candidate list wherever Agent 3 renders it.
- **Gap headlines**: text-secondary body text with a small leading orange dot (previously purple,
  see the note above, orange is now the gap/attention accent in the two-accent system). Still no
  filled warning background, still calm, not alarmist.
- **NL shift-generation draft**: stations render as hollow dashed capsules (`HollowCapsule`),
  echoing Agent 1's forthcoming `ShiftCapsule` empty state, with a disabled purple "Create these
  shifts" pill until the Agent 3 handoff below exists.
- **Presence**: unchanged data contract (`docs/contracts/presence.md`), its example render updated
  to the new "avatar stack in a neutral pill, purple dot for live" convention. No consumer has
  wired it into any surface yet (verified: no `usePresence` import outside `src/lib/presence/` as
  of this commit), so there is nothing rendered today to reskin.

## Open handoff (logged in `requests.md` and `pending.md`)

`shift_generation`'s confirm card (in the command palette's NL mode) round-trips the parse but
does not create anything: creation needs `createStation`/`generateShifts` from
`src/lib/scheduling/actions.ts` plus an `eventId` and a station-name-to-id resolution this module
has no data for. Filed a request asking Agent 3 for a documented prefill mechanism into the real
bulk-generate dialog.
