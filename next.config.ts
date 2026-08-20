import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

/**
 * Deliberately NOT setting `experimental.staleTimes`.
 *
 * An earlier revision of this pass set `{ dynamic: 30, static: 180 }` to make navigation reuse
 * already-rendered payloads. Adversarial review killed it on three counts, all verified against
 * Next 16.3.1's own source:
 *
 * 1. `static: 180` was a regression. Next's default is 300 (server/config-shared.js), so the
 *    "optimization" cut static payload reuse by 40%.
 * 2. The stated justification for `dynamic: 30` was wrong. It claimed the setting was needed so
 *    prefetched payloads survive, but `staleTimes.dynamic` is consumed only when reusing pages the
 *    user has ALREADY visited, not prefetched ones. The prefetching works the same without it.
 * 3. `dynamic: 30` changed behavior under a zero-behavior-change contract. It opens a 30 second
 *    window where a client can render a stale page without contacting the server, which means
 *    (a) a director demoted by an admin keeps seeing director surfaces until it expires, because
 *    nothing that admin does can evict another browser's cache, and (b) the notification
 *    preference toggles, which write straight from the browser Supabase client with no server
 *    action and no `router.refresh()`, visibly revert when you navigate away and back.
 *
 * Reuse of already-visited routes is a real win, but it is a product decision about acceptable
 * staleness, not a free performance tweak, so it does not belong in a pass whose contract is that
 * nothing observable changes.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
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
