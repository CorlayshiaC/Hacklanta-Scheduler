import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  experimental: {
    /**
     * Client router cache lifetimes. Without this, `dynamic` defaults to 0, meaning a prefetched
     * dynamic route's payload is thrown away immediately and every navigation re-fetches from the
     * server: the prefetching in src/lib/navigation/use-route-prefetch.ts would warm a cache that
     * does not exist. Every page in this app is dynamic, so 0 meant nothing was ever reused.
     *
     * 30s is the window the performance brief asks for on schedule data. It only ever serves a
     * payload the server already rendered for this user, and mutations do not go stale behind it:
     * every write path calls `revalidatePath` (server actions) or `router.refresh()` (coverage
     * board, approval queue), both of which evict the entry. The visible effect is that navigating
     * back to a page you just left renders instantly from memory instead of showing a skeleton.
     *
     * This does not weaken authorization: the router cache is per-browser-session, in-memory, and
     * holds only payloads rendered for the signed-in user under RLS. Nothing is shared or persisted.
     */
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

/**
 * Opt-in bundle analysis: `ANALYZE=true npm run build` (or `npm run analyze`) emits per-chunk
 * treemaps plus a machine-readable stats file under .next/analyze/. Off by default so ordinary
 * builds and CI are unaffected; @next/bundle-analyzer is a devDependency with zero runtime cost.
 * See docs/perf-baseline.md for the recorded numbers.
 */
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
});

export default withBundleAnalyzer(nextConfig);
