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

```tsx
const { members, count } = usePresence(`coverage-board:${eventId}`, currentUser);

<span className="text-xs text-text-muted">{count} {count === 1 ? "organizer" : "organizers"} viewing</span>
```

Agent 3's coverage board header and Agent 5's availability-poll footer are the two documented
consumers in the shared brief; both are free to add more.
