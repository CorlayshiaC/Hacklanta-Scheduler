import { ImageResponse } from "next/og";

// PWA install icon. Route path (not a static file) so the same drawing code backs both this and
// icon-512.png/route.tsx below. Purple pill on a full-bleed aurora-wash square: maskable-safe (the
// pill sits well inside the ~80% safe zone every platform's masking crops to), matching the "a
// shift is a capsule" brand mark rather than a wordmark, which would be illegible at 48px.
//
// Dark canvas is the showcase/default theme (icons are static/build-time, no per-session theme,
// see manifest.ts). Matches the REAL published V4 tokens exactly (design(a1) "V4 precision
// instrument", docs/contracts/design.md): --surface-canvas #0B0A14, --canvas-tint
// rgba(109,74,255,.1) (globals.css's body gradient, approximated here since satori can't read a
// CSS file). Mark in #A78BFA: computed contrast against #0B0A14 (WCAG relative luminance) is
// ~7.2:1 for #A78BFA vs. ~3.8:1 for #6D4AFF, matching design.md's accent-fill-vs-glow split.
const SIZE = 192;

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 50% 20%, rgba(109,74,255,0.22) 0%, rgba(109,74,255,0) 60%), #0B0A14",
        }}
      >
        <div
          style={{
            display: "flex",
            width: SIZE * 0.62,
            height: SIZE * 0.32,
            borderRadius: 999,
            background: "#A78BFA",
          }}
        />
      </div>
    ),
    { width: SIZE, height: SIZE },
  );
}
