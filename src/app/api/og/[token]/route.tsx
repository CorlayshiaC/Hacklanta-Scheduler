// OG image endpoint for public schedule share links.
//
// Contract: docs/contracts/public.md, section 3 ("OG image endpoint").
//
// A revoked or invalid share token intentionally returns the plain dark
// fallback card below at a 404 status, never the real event data. This
// mirrors the "don't reveal a token existed" rule the public page
// (`/s/[token]`) applies to its own 404, and is deliberate even though the
// 5 minute CDN cache on a *valid* token's image means a just-revoked token
// can still serve a stale (aggregate-only, name-free) image for up to that
// long, called out explicitly in the contract as an accepted tradeoff.

import { ImageResponse } from "next/og";
import { z } from "zod";

import { formatDateInTimeZone } from "@/lib/availability/time";
import { getPublicSchedule } from "@/lib/public/get-schedule";
import type { PublicSchedule } from "@/lib/public/types";

const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;
const CACHE_CONTROL = "public, max-age=300, s-maxage=300";

// Share tokens are 24 random bytes, base64url encoded, no padding: 32 chars.
// See docs/contracts/public.md section 1. A malformed token is treated
// identically to a not-found one below, no separate error path.
const tokenParamSchema = z.string().regex(/^[A-Za-z0-9_-]{32}$/);

const COLORS = {
  gradientFrom: "#0a0a0c",
  gradientTo: "#18181b",
  cardFill: "#111114",
  cardBorder: "rgba(255,255,255,0.06)",
  glow: "rgba(124,58,237,0.35)",
  glowTransparent: "rgba(124,58,237,0)",
  title: "#f4f4f5",
  dateRange: "#a1a1aa",
  slotsLabel: "#d4d4d8",
  slotsAccent: "#c4b5fd",
  wordmark: "#52525b",
  wordmarkMuted: "#71717a",
} as const;

function sumSlots(schedule: PublicSchedule): { filled: number; needed: number } {
  // Aggregate only: the public.md section 3 contract forbids per-shift or
  // per-person detail on this image, just the "X of Y slots filled" total
  // summed across every shift the token's schedule includes.
  return schedule.shifts.reduce(
    (totals, shift) => ({
      filled: totals.filled + shift.filled,
      needed: totals.needed + shift.needed,
    }),
    { filled: 0, needed: 0 },
  );
}

function renderFallback(status: number, cache: boolean) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: COLORS.gradientFrom,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 44,
            fontWeight: 600,
            letterSpacing: 4,
            color: COLORS.wordmarkMuted,
          }}
        >
          progsu
        </div>
      </div>
    ),
    {
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
      status,
      // The 5 minute contract cache applies to the documented "no such token"
      // 404. An unexpected server error (see the catch below) is not cached,
      // a transient failure should not stay pinned at the CDN edge.
      headers: cache ? { "Cache-Control": CACHE_CONTROL } : {},
    },
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const parsedToken = tokenParamSchema.safeParse(token);

  if (!parsedToken.success) {
    return renderFallback(404, true);
  }

  let schedule: PublicSchedule | null;

  try {
    schedule = await getPublicSchedule(parsedToken.data);
  } catch {
    // Unexpected failure reaching the schedule, distinct from "no such
    // token": still the plain fallback card, but a 500 so it isn't
    // confused with an intentionally revoked/invalid link.
    return renderFallback(500, false);
  }

  if (!schedule) {
    return renderFallback(404, true);
  }

  const { filled, needed } = sumSlots(schedule);
  const dateRange = `${formatDateInTimeZone(schedule.event.startsAt, schedule.event.timezone)} to ${formatDateInTimeZone(schedule.event.endsAt, schedule.event.timezone)}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: `linear-gradient(135deg, ${COLORS.gradientFrom} 0%, ${COLORS.gradientTo} 100%)`,
        }}
      >
        {/* Raised card illusion: no real box-shadow support in next/og, so a
            slightly lighter inset rectangle stands in for a neumorphic lift. */}
        <div
          style={{
            position: "absolute",
            top: 56,
            left: 56,
            right: 56,
            bottom: 56,
            display: "flex",
            borderRadius: 36,
            background: COLORS.cardFill,
            border: `1px solid ${COLORS.cardBorder}`,
          }}
        />

        {/* Soft glow behind the title: blurred, low-opacity purple radial
            gradient, positioned absolutely behind the title text. */}
        <div
          style={{
            position: "absolute",
            top: 110,
            left: "50%",
            transform: "translateX(-50%)",
            width: 640,
            height: 320,
            display: "flex",
            background: `radial-gradient(circle, ${COLORS.glow} 0%, ${COLORS.glowTransparent} 70%)`,
            filter: "blur(60px)",
          }}
        />

        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 120px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 64,
              fontWeight: 700,
              color: COLORS.title,
              textAlign: "center",
              lineHeight: 1.15,
            }}
          >
            {schedule.event.name}
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 20,
              fontFamily: "monospace",
              fontSize: 28,
              color: COLORS.dateRange,
            }}
          >
            {dateRange}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "baseline",
              gap: 12,
              marginTop: 32,
              fontSize: 32,
              color: COLORS.slotsLabel,
            }}
          >
            <div style={{ display: "flex", fontFamily: "monospace", fontWeight: 700, color: COLORS.slotsAccent }}>
              {filled}
            </div>
            <div style={{ display: "flex" }}>of</div>
            <div style={{ display: "flex", fontFamily: "monospace", fontWeight: 700, color: COLORS.slotsAccent }}>
              {needed}
            </div>
            <div style={{ display: "flex" }}>slots filled</div>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: 92,
            display: "flex",
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: 2,
            color: COLORS.wordmark,
          }}
        >
          progsu
        </div>
      </div>
    ),
    {
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
      status: 200,
      headers: { "Cache-Control": CACHE_CONTROL },
    },
  );
}
