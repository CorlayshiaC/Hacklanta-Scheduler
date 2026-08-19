import type { MetadataRoute } from "next";

// Next.js's native manifest.ts convention: auto-serves at /manifest.webmanifest and auto-injects
// the <link rel="manifest"> tag, no edit to src/app/layout.tsx (Agent 1's file) needed for this
// part. Icon routes are custom route handlers (src/app/icon-192.png, icon-512.png) rather than the
// icon.tsx convention, since that convention only generates one size by default and a PWA install
// prompt wants at least a 192 and a 512.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "prog scheduler",
    short_name: "progsu",
    description: "Shift scheduling for progsu events.",
    start_url: "/",
    display: "standalone",
    // V4: dark is the showcase/default theme (design(a1) "V4 precision instrument",
    // docs/contracts/design.md: "--surface-canvas #0B0A14 + radial purple --canvas-tint").
    // manifest.ts is static/build-time with no access to a live theme preference, so this can't
    // flip per-session even though a real useTheme() now exists (src/lib/theme/use-theme.ts,
    // Agent 1's, drives the app shell's ThemeToggle); a runtime <meta name="theme-color"> write is
    // app-shell territory (src/app/layout.tsx), not this file.
    background_color: "#0B0A14",
    theme_color: "#0B0A14",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
