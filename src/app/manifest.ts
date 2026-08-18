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
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
