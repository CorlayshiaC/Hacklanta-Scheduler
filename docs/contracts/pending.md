# Pending: stubs standing in for unpublished contracts

## From Agent 5

1. **`STUB(agent-1)` design primitives.** `components/ui/` is empty, no tokens file exists yet
   (`tailwind.config.ts` still has the old green/purple/pink `hl-*` palette from the current shell,
   not the neumorphic dark-purple spec). Every component under `components/public/` and
   `components/settings/` uses a small local set of placeholder layout primitives
   (`components/public/_stub-primitives.tsx`, `components/settings/_stub-primitives.tsx`): plain
   bordered surfaces, no hand-rolled dual shadows, no invented color values beyond the literal hex
   constants given in the shared-context spec (used directly, not redefined, since there is nothing
   yet to import from). Swap these for `NeuCard` / `NeuButton` / `NeuToggle` / `NeuWell` /
   `GridCell` once Agent 1 publishes. Tracking removal: grep `STUB(agent-1)`.

2. **`STUB(agent-2)` tables.** `share_tokens`, `org_settings`, `notification_preferences`, and the
   `profiles.timezone` / `profiles.avatar_url` columns don't exist (requested in
   `schema-requests.md`). Until they land:
   - `/s/[token]` and `/api/og/[token]` read from `lib/public/stub-data.ts`, a fixture shaped
     exactly like the requested `get_public_schedule()` return value, seeded from the real
     `events`/`shifts`/`shift_assignments` tables so the shape is correct even though token
     validity isn't real yet (any token "works" against the single seeded event).
   - Settings > Organization renders `org_settings` fields as disabled inputs with seeded example
     values and a banner: "Organization settings require a schema change, tracked in
     docs/contracts/schema-requests.md."
   - Settings > Notifications renders the four known kinds from
     `src/lib/notifications/types.ts` as toggles that update local component state only (no
     persistence) with the same banner.
   - Settings > Profile's timezone/avatar fields are hidden (not rendered disabled, actually
     absent) until the columns exist, since there's nowhere to read or write them from. Max-hours
     field is real today, backed by the existing per-event `member_settings` table.

3. **`STUB(agent-2)` role vocabulary.** `app/(app)/settings/roles` renders three role options
   (`member`, `organizer`, `admin`) per the shared vocabulary, but the underlying mutation only
   accepts `admin | board_member` until the enum widens (see Agent 3's request 1 in
   `schema-requests.md`). Selecting "organizer" in the UI is disabled with a tooltip
   ("Organizer role ships once the schema update lands") rather than silently mapping it to
   something wrong.

4. **Reusing, not duplicating, `src/lib/admin/member-actions.ts`.** `updateMemberProfileAction`
   already implements role change with a last-active-admin guard and an audit log write. Rather
   than reimplement that guard, `app/(app)/settings/roles` imports and calls it directly. This is
   reading another agent's exported interface, not editing their file, allowed under the file-
   ownership rule. If its signature or the `applicationRoleSchema` enum changes (e.g. to add
   `organizer`), my settings page picks that up automatically with no changes needed on my side
   beyond removing the disabled state in item 3.

5. **No new dependencies added.** OG images use `next/og`'s built-in `ImageResponse`, not the
   external `@vercel/og` package (same API, zero bundle cost since it ships with Next). CSV export
   is hand-built string formatting, no CSV library. The embed widget is hand-authored vanilla JS
   with no build step, since its whole point is to stay tiny and dependency-free. `package.json` is
   not touched by any of Agent 5's work.
