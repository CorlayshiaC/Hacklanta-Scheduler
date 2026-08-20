import { ImageResponse } from "next/og";

// Next's native apple-icon.tsx convention: auto-injects <link rel="apple-touch-icon"> with no
// edit to src/app/layout.tsx needed. Same mark as icon-192.png/icon-512.png (see that file's
// rationale), iOS wants an opaque background (no transparency), already satisfied here.
//
// Dark canvas is the showcase/default theme (icons are static/build-time, no per-session theme, so
// this is fixed to the dark default, see manifest.ts). Now matches the REAL published V4 tokens
// (design(a1) "V4 precision instrument", docs/contracts/design.md) exactly, not an approximation:
// --surface-canvas #0B0A14 and --canvas-tint rgba(109,74,255,.1) (globals.css's body background
// gradient, same shape approximated here since satori can't read a CSS file). Mark in #A78BFA
// rather than the fill-only #6D4AFF: computed contrast against #0B0A14 (WCAG relative luminance)
// is ~7.2:1 for #A78BFA vs. ~3.8:1 for #6D4AFF, matching design.md's own accent-fill-vs-glow split.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
            width: size.width * 0.62,
            height: size.width * 0.32,
            borderRadius: 999,
            background: "#A78BFA",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
