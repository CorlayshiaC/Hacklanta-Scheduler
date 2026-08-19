import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

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
