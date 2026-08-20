import { ImageResponse } from "next/og";

// See icon-192.png/route.tsx for the design rationale (matches design(a1)'s real V4 tokens
// exactly), identical mark at the larger size the PWA install prompt and app-switcher tiles pull
// from.
const SIZE = 512;

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
