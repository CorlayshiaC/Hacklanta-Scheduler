import { ImageResponse } from "next/og";

// Next's native apple-icon.tsx convention: auto-injects <link rel="apple-touch-icon"> with no
// edit to src/app/layout.tsx needed. Same mark as icon-192.png/icon-512.png (see that file's
// rationale), iOS wants an opaque background (no transparency), already satisfied here.
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
          background: "#000000",
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
