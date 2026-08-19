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
