import { ImageResponse } from "next/og";

// PWA install icon. Route path (not a static file) so the same drawing code backs both this and
// icon-512.png/route.tsx below. Flat purple pill on a full-bleed black square: maskable-safe (the
// pill sits well inside the ~80% safe zone every platform's masking crops to), matching the "a
// shift is a capsule" brand mark rather than a wordmark, which would be illegible at 48px.
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
          background: "#000000",
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
