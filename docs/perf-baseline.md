# Performance baseline

Measured on the `revamp` branch at commit `54def97` (the first green build of the branch), before any
optimization. Every later phase reports against these numbers.

Re-measure with:

```
npm run build          # route list + build timing
npm run analyze        # ANALYZE=true, writes .next/analyze/{client,nodejs,edge}.html
```

## What was and was not measured

Measured directly and reproducibly: production build output, per-chunk and per-package client bundle
composition (via `@next/bundle-analyzer`, added this pass as a devDependency), route render strategy,
and a full static audit of render architecture, data waterfalls, re-render behavior, query shape, and
the motion inventory.

**Not measured: Lighthouse LCP/INP/CLS/TTFB.** Those require a running instance with live Supabase
credentials and seeded data. This environment has neither, so quoting numbers for them would be
fabrication. The build-level and static numbers below are the honest, reproducible baseline; the
field metrics need a deployed preview to capture and are called out as an open item rather than
guessed at.

## Build

| Metric | Baseline |
|---|---|
| Compile | 3.9s |
| TypeScript | 2.4s |
| Static pages generated | 15 |
| Routes rendered `ƒ` (dynamic, server-rendered on demand) | **44 of 46** |
| Routes rendered `○` (static) | 2 (`/apple-icon`, `/manifest.webmanifest`) |

Every real page route, including the fully public `/s/[token]` share page, is dynamic. Nothing is
statically prerendered or ISR-cached.

## Client bundle

### Shared baseline paid by every route

| Chunk | Gzip |
|---|---|
| `3794-*.js` (React) | 64.0 KB |
| `4bd1b696-*.js` (React DOM) | 61.7 KB |
| `polyfills-*.js` | 38.5 KB |
| `webpack-*.js` | 1.6 KB |
| `main-app-*.js` | 0.2 KB |
| **Total** | **166.5 KB gz** (546.0 KB raw) |

### By package, across all client chunks (parsed size)

| Package | Parsed |
|---|---|
| `next` | 602.1 KB |
| (app code) | 335.8 KB |
| `react-dom` | 174.1 KB |
| **`framer-motion` + `motion-dom`** | **163.9 KB** |
| **`@supabase/ssr` + `@supabase/auth-js`** | **219.7 KB** |
| **`zod`** | **55.8 KB** |
| `@dnd-kit/core` | 36.5 KB |
| `tailwind-merge` | 26.2 KB |
| all `@radix-ui/*` combined | ~160 KB |

### Largest per-route chunks (gzip, on top of the shared baseline)

| Route | Gzip |
|---|---|
| `/design` | 10.8 KB |
| `/coverage/[eventId]` | 10.0 KB |
| `/events/[id]` | 8.5 KB |
| `/my-schedule` | 7.4 KB |
| `(app)/layout` | 7.3 KB |
| `/shifts` | 5.8 KB |
| `/s/[token]` | 5.1 KB |

## The dominant findings

Ranked by measured impact. Full evidence is in the Phase 0 audit; the load-bearing ones:

1. **The notification bell puts the entire Supabase browser SDK on every authenticated route.**
   `(app)/layout.tsx` mounts `NotificationBell`, which imports `createSupabaseBrowserClient` at
   module scope, which imports `@/lib/env`, which imports `zod`. Net: **~307 KB parsed / ~79 KB
   gzip** of `@supabase/ssr` + `@supabase/auth-js` + `zod` in the client graph of every authenticated
   page, to render an unread-count badge. Routes like `/calendar` and `/coverage` whose own page
   chunk is 3.8 KB pay all of it.

2. **`middleware.ts` runs two serial Supabase round trips before checking whether the route is even
   protected.** `auth.getUser()` (a real HTTP call to GoTrue, not a local JWT decode) then a
   `profiles` select, both ahead of the `isProtectedRoute` guard. The matcher excludes only static
   assets, so this 2-hop prefix runs on the public share page, sign-in, every API route, every RSC
   navigation, and every server-action POST.

3. **Zero `Suspense` and zero React `cache()` in `src/`.** Every route is one long serial await
   chain. `/my-schedule` is ~8 serial network hops, `/swaps` ~10. Auth alone is re-resolved 2-4x per
   render.

4. **Server actions block the click-to-animation path on a Resend HTTPS email send.** `assignMember`
   and `unassignMember` await an audit-log insert, an extra `events` select, and a live
   `resend.emails.send()` before returning. The action's response is what unblocks the UI, so a
   capsule flip waits on an email API. All three are fire-and-forget in intent (failures are only
   `console.warn`'d).

5. **No `React.memo` anywhere in `src/components`.** The availability grid re-renders all ~336 cells
   on every drag-paint step, reallocating ~1000 closures and detaching/reattaching 336 refs per step.
   The coverage board rebuilds 3 `Intl.DateTimeFormat` objects per capsule per click (~600 per click
   on a 200-shift board), because `formatShiftTime` constructs a formatter on every call.

6. **`listUpcomingShifts()` has no time filter and no limit** — it fetches the entire `shifts` table
   plus every assignment, forever. `listEvents()` fetches every shift, station, assignment and
   assignee profile across every event to compute two integers per event.

7. **Framer Motion is loaded eagerly on every route.** All 30 consumers import the `motion` proxy
   directly, which resolves the full `domMax` feature bundle.

## Deliberately not pursued (recorded here so the reasoning survives)

- **LazyMotion.** The obvious framer-motion diet is `LazyMotion features={domAnimation}`, which would
  cut most of the 163.9 KB. It is not available to this app: 11 surfaces depend on Framer's **layout
  projection** (`layout` / `layoutId`) — the sidebar nav active-tint slide, the command-palette mode
  underline and selection highlight, the approval-queue row compaction, the toast queue reflow, the
  coverage assign-panel morph. `domAnimation` does not include layout projection; only `domMax` does,
  and `domMax` is the bundle Framer already ships by default. The migration would touch 30 files and
  buy approximately nothing.
- **Virtualizing long lists.** Two families of entrance animation derive their delay from an item's
  render index (`useCascadeItem(index, total)`, `drawInDelay(index)`). A windowed list renumbers
  indices on scroll, so rows would re-cascade on every scroll — a direct violation of motion-spec law
  2 ("entrances fire once per navigation, never on re-render"). Motion spec §11 separately forbids
  running layout animations on virtualized rows, and `approval-queue` and `horizontal-schedule` both
  put `layout` on every row. Virtualization here requires a motion-spec change, which is out of scope
  for a pass that is explicitly zero-motion-change.
- **Adding React Query.** The optimization plan assumes a React Query cache to warm. This app has no
  client data-fetching library and fetches on the server; introducing one would move data fetching
  client-side, adding a dependency *and* a client waterfall to make navigation slower. The
  Next-native equivalent — prefetching the RSC payload into the router cache — achieves the same
  "renders instantly from cache" goal with no new dependency and no architectural change.

## Open item

Lighthouse field metrics (LCP, INP, CLS, TTFB) against a deployed preview with seeded data. The
build and bundle numbers above bound what those can be, but they are not a substitute.

---

# Results

Measured the same way as the baseline: both numbers come from a real `npm run build` of the
respective commit, with per-route client JS summed from each route's client-reference manifest.
Baseline commit `75bb2ed`, result commit `1d9d6fa`.

## Client JS per route (gzip)

| Route | Before | After | Delta |
|---|---|---|---|
| `/design` | 221.3 | 144.0 | **-77.3 KB (-35%)** |
| `/coverage/[eventId]` | 215.4 | 138.1 | **-77.3 KB (-36%)** |
| `/my-schedule` | 209.5 | 196.8 | **-12.7 KB (-6%)** |
| `/events/[id]` | 206.5 | 141.9 | **-64.6 KB (-31%)** |
| `/settings/organization` | 205.7 | 128.4 | **-77.3 KB (-38%)** |
| `/settings/invites` | 204.3 | 127.0 | **-77.3 KB (-38%)** |
| `/shifts` | 201.3 | 124.0 | **-77.3 KB (-38%)** |
| `/events/new` | 199.3 | 122.0 | **-77.3 KB (-39%)** |
| `/settings/roles` | 198.5 | 121.2 | **-77.3 KB (-39%)** |
| `/settings/notifications` | 197.8 | 120.5 | **-77.3 KB (-39%)** |
| `/approval` | 197.3 | 120.0 | **-77.3 KB (-39%)** |
| `/swaps` | 196.1 | 118.8 | **-77.3 KB (-39%)** |
| `/events` | 195.9 | 118.6 | **-77.3 KB (-39%)** |
| `/availability` | 195.2 | 118.1 | **-77.1 KB (-39%)** |
| `/settings` | 194.2 | 116.9 | **-77.3 KB (-40%)** |
| `/calendar` | 194.0 | 116.7 | **-77.3 KB (-40%)** |
| `/coverage` | 194.0 | 116.7 | **-77.3 KB (-40%)** |
| `/sign-in` | 192.7 | 115.3 | **-77.4 KB (-40%)** |
| `/my-events/[id]` | 190.9 | 113.6 | **-77.3 KB (-40%)** |
| `/my-events` | 190.9 | 113.6 | **-77.3 KB (-40%)** |
| `/sign-up` | 190.4 | 125.8 | **-64.6 KB (-34%)** |
| `/admin/*` (5 routes) | 189.3 | 112.0 | **-77.3 KB (-41%)** |
| `/join/[token]` | 189.1 | 111.8 | **-77.3 KB (-41%)** |
| `/` | 189.1 | 111.8 | **-77.3 KB (-41%)** |
| `/s/[token]` (public) | 189.1 | 111.8 | **-77.3 KB (-41%)** |

**Mean across all 31 routes: 196.2 KB -> 121.8 KB gzip, -74.4 KB (-38%).**

`/my-schedule` is the one small mover, and correctly so: it opens a Supabase Realtime channel, so it
is the only route that legitimately needs the browser SDK. It still drops zod.

## What moved which number

| Change | Effect |
|---|---|
| Deferred the Supabase browser SDK out of the app shell | -64.3 KB gz on every route except `/my-schedule` |
| Dropped zod from the browser-reachable env module | -13.0 KB gz on every route |
| Narrowed the middleware matcher | Removes one live GoTrue `GET /auth/v1/user` round trip per request on the public share page, all token-authenticated feeds and OG images, the embed widget, generated icons and the service worker |
| React `cache()` on auth | Auth resolved once per render instead of 2-4x; each resolution was a GoTrue HTTP call plus a `profiles` select |
| React `cache()` on `getPublicSchedule` | The public page's security-definer RPC runs once per request instead of twice (`.rpc()` is a POST, which Next's request memoization does not cover) |
| `after()` for audit log and notification email | Takes an audit insert, an extra `events` select and a live `resend.emails.send()` HTTPS call off the click-to-animation path in `assignMember`/`unassignMember` |
| Cached `Intl.DateTimeFormat` instances | ~600 formatter constructions per coverage-board click, and one per keystroke in the assign panel, become zero |
| Memoized the availability grid cells | A paint step re-renders only the cells that changed instead of all ~336, and stops ~1000 closure allocations and 672 ref detach/reattach cycles per step |
| Memoized the dashboard grouping | `groupMemberAssignmentsByDay` went from O(days x assignments) with a formatter built inside the filter predicate to a single bucketing pass with one formatter, and no longer recomputes on every reveal/realtime/glint render |
| Collapsed `getEventRosterForSwap` | 3 serial queries to 2, with the state filter pushed into Postgres |
| Route prefetching | Warms route chunks, layout segments and the loading shell during idle time and on hover intent |

## Correction: a misattributed commit

Commit `935d458` ("perf: stop the availability grid re-rendering all 336 cells per paint step")
says "Nothing visual changes". **That is wrong, and the commit is not purely mine.**

When this session started, `src/components/availability/availability-grid.tsx` had uncommitted
working-tree changes from earlier design work that transposed the grid: day-columns/time-rows became
time-columns/day-rows, per-row time labels became sparse 2-hourly column ticks, and the arrow-key
axes swapped to match. Staging that path swept all of it into a `perf:` commit under a message
claiming no visual change. The memoization in that commit is mine; the transposition is not.

Not reverted, because it is deliberate design work (the code comment in it says "flipped from the
old vertical-time layout") and reverting would destroy someone else's in-progress change. Not
rewritten out of history either, because this is a shared branch. Recorded here instead.

**Follow-up for whoever owns that grid, found while verifying the above:** with the transposed
layout, `buildEventGridSpec` defaults to a full 24h day at 30-minute granularity, so the track is
`72px + 48 x 28px + gaps` which is about **1608px wide**. It sits in a container that is
`overflow-x-auto` but also carries `style={{ touchAction: "none" }}`, and every cell carries
`touch-none`. Touch panning is therefore suppressed across the whole scroller, so on a phone a
member can see roughly the first five hours of the day and has no gesture to reach the rest: a
horizontal drag paints instead of scrolling. This was dormant before the transposition, because the
old layout used `minmax(40px, 1fr)` columns and never overflowed horizontally. It needs a design
decision (a narrower default day window, or `touch-action: pan-x` with paint gated on a longer
press), not a performance change, so it is flagged rather than fixed here.

## Reverted during this pass

`experimental.staleTimes` was set to `{ dynamic: 30, static: 180 }` and then removed after review,
because all three of its premises were wrong:

- `static: 180` is **below** Next 16's default of 300, so it cut static payload reuse by 40% inside
  a performance pass.
- The justification for `dynamic: 30` claimed it was required for prefetched payloads to survive.
  It is not: `staleTimes.dynamic` governs reuse of routes the user has already visited. Prefetching
  behaves identically without it.
- `dynamic: 30` changed observable behavior, which this pass was not allowed to do. It opens a 30
  second window in which a client renders without contacting the server, so a director demoted by an
  admin keeps seeing director surfaces (nothing that admin does can evict another browser's cache),
  and the notification preference toggles visibly revert on navigation because they write straight
  from the browser Supabase client with no server action and no `router.refresh()` to invalidate
  anything.

Reusing already-visited routes is a genuine win, but it is a product decision about acceptable
staleness rather than a free tweak.

## What the prefetching actually does

Stated precisely, because it is easy to overclaim. `router.prefetch()` issues an "auto" prefetch,
and for a non-PPR dynamic route Next stops that at the nearest `loading.tsx` boundary rather than
rendering the page. `src/app/(app)/loading.tsx` sits above every prefetch target, so what is warmed
is the route's JS chunks, its shared layout segments and the loading shell, **not the page's data**.
That is still a real navigation win (the click no longer waits on a chunk fetch), but it is not "the
page is already rendered". Getting the full payload would need `prefetch={true}` on the links, which
means eagerly server-rendering nine dynamic routes per session; that trade has not been made.

## Deliberately not done

Beyond the three recorded in the baseline section (LazyMotion, virtualization, React Query):

- **Suspense/streaming boundaries.** Phase 1 asked for them, but adding a streaming boundary means a
  skeleton now appears where the page previously blocked, which is a visible change under a contract
  that says the app must look identical. Worth doing as its own reviewed change.
- **Making `/s/[token]` static or ISR.** The public page is the best ISR candidate in the app, but
  its content is per-token and publish/approval-driven, so it needs on-demand revalidation wiring
  that is a behavior change, not a config flip.
- **Bounding `listUpcomingShifts()` and `listEvents()`.** Both fetch unbounded history (the former
  has no date filter at all despite its name). Adding a filter changes which rows render, which is a
  behavior change.
- **Collapsing `getEventRosterForSwap` to a single query.** The last hop needs an embedded
  `profiles!shift_assignments_profile_id_fkey!inner(...)`, and that FK name is inferred from
  Postgres' auto-naming convention rather than proven by an existing call site. It cannot be verified
  without a live database, and one hop is not worth risking a runtime failure on `/swaps`.
- **Narrowing `notifications.select("*")`.** `payload` (jsonb) is fetched and never read, but
  `NotificationRow` is `Tables<"notifications">` and narrowing it ripples through the notification
  components and their tests for a small win.

## Verification

- `npm run typecheck`, `npm run lint`, `npm run build`: clean.
- `npm run test`: 264 passing, up from 252. The 12 new tests cover the middleware matcher (including
  a guard that the `s/` exclusion cannot swallow `/settings`) and availability-grid painting (drag
  accumulation across renders, erase, no-repaint-within-a-drag, pointer-up, space toggle, shift
  range-select, the eraser toggle, arrow-key roving focus, and the disabled guard).
- The whole pass was re-reviewed adversarially against the motion inventory, the correctness
  contract, and RLS/caching safety. That review is what produced the `staleTimes` revert, the NUL-byte
  fix, the prefetch re-arming fix, the `/my-schedule` redirect-race fix, and the correction above.
- Animations were verified structurally against `docs/contracts/motion-spec.md`: the sidebar
  `layoutId` tint, the availability paint pop, the notification bell tilt and panel slide, and the
  dashboard entrance timeline are all unchanged. No animation was added or removed. Confirmed that
  the router cache stores RSC payloads rather than component instances, so navigating still unmounts
  the page subtree and entrance animations still fire exactly once per navigation (motion-spec law 2).
- **Not verified by running the app.** There is no seeded Supabase instance here, so this is static
  and build-level verification plus unit tests. A manual sweep of every route in both themes at
  mobile width, with the reduced-motion emulation flag, is still required before merge.
