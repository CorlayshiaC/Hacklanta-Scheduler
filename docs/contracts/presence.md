# Presence contract (Agent 6)

`src/lib/presence/` wraps Supabase Realtime presence. Data only, no rendering: whoever consumes it
owns the avatar-stack visual treatment against Agent 1's primitives, this module does not export a
`components/presence/` UI (not a directory Agent 6 owns).

## `usePresence(scope, self)`

```ts
import { usePresence, type PresenceMember } from "@/lib/presence";

const { members, count } = usePresence(`coverage-board:${eventId}`, self);
```

- `scope: string` — one Realtime channel per distinct scope string. Suggested convention:
  `"<surface>:<id>"`, e.g. `"coverage-board:{eventId}"`, `"availability-poll:{eventId}"`. Pick your
  own scope strings, nothing here reserves a namespace.
- `self: PresenceMember | null` — `{ id, name, avatarUrl? }`. Pass `null` while the current user
  isn't known yet (still loading), the hook no-ops until it is real. `id` doubles as the presence
  key, one entry per id even across that user's multiple tabs.
- Returns `{ members: PresenceMember[], count: number }`, live-updated. `members` already
  deduplicates multiple tabs from the same person.
- Joins on mount, leaves on unmount or when `scope`/`self.id` changes. Non-private channel by
  default (no RLS gate): reasonable for "who's viewing this page" since it only runs behind app
  auth already, ask in `requests.md` if a surface needs presence gated by Realtime RLS instead
  (requires Agent 2 to enable `private: true` + a `presence.read` policy for that channel).

## Example render (not code in this repo, just the pattern)

Updated for the pill/bento redesign (`_shared-context.md`, 2026-08-16): presence renders as an
avatar stack inside a neutral pill, with a small purple dot for "live", not the plain muted text
this contract originally showed. No consumer has wired this in yet as of this commit (verified: no
`usePresence` import outside `src/lib/presence/`), so whoever builds it first against Agent 1's
real `AvatarStack` primitive sets the pattern:

```tsx
const { members, count } = usePresence(`coverage-board:${eventId}`, currentUser);

<div className="flex items-center gap-1.5 rounded-full bg-bg-elevated px-2 py-1">
  <AvatarStack members={members} max={3} size="sm" />
  <span className="h-1.5 w-1.5 rounded-full bg-accent-go" aria-hidden="true" />
  <span className="text-xs text-text-secondary">
    {count} {count === 1 ? "organizer" : "organizers"}
  </span>
</div>
```

(`bg-bg-elevated`, `bg-accent-go`, and the real `AvatarStack` are Agent 1's forthcoming tokens and
primitive, not published yet, hence not directly runnable code above, just the target shape.)

Agent 3's coverage board header and Agent 5's availability-poll footer are the two documented
consumers in the shared brief; both are free to add more.
