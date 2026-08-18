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
//
// STUB(agent-1): the event name below renders in a fetched Space Grotesk
// Bold ("chunky uppercase display heading", see _shared-context.md's design
// system section) rather than whatever display face Agent 1 eventually
// settles on for the app shell (src/app/layout.tsx item 4 of their
// redesign brief). next/og's ImageResponse (satori) cannot see that
// decision anyway, it only reads fonts explicitly passed via the `fonts`
// option, so this endpoint makes its own independent, self-contained
// choice. Flagged in docs/contracts/requests.md in case Agent 1 lands on a
// different face and wants this endpoint to match exactly.

import { ImageResponse } from "next/og";
import { z } from "zod";

import { formatDateInTimeZone } from "@/lib/availability/time";
import { getPublicSchedule } from "@/lib/public/get-schedule";
import type { PublicSchedule } from "@/lib/public/types";

// Token-driven, just like /s/[token]: must re-check validity per request (section 1's revocation
// rule), and caching is meant to happen exactly once, via the Cache-Control header below, at the
// CDN edge. Without this, Next's Route Handler full-route cache is free to serve a stale response
// (wrong event data, or a since-revoked token's image) indefinitely, which is a stricter and
// unintended cache on top of the documented 5 minute one. Caught by hand-testing this route with a
// real token during the 2026-08-18 redesign pass: identical output bytes across two requests after
// an unrelated code change, traced to this missing opt-out, not a caching bug in the code change
// itself.
export const dynamic = "force-dynamic";

const IMAGE_WIDTH = 1200;
const IMAGE_HEIGHT = 630;
const CACHE_CONTROL = "public, max-age=300, s-maxage=300";
const DISPLAY_FONT_FAMILY = "Space Grotesk";

// Share tokens are 24 random bytes, base64url encoded, no padding: 32 chars.
// See docs/contracts/public.md section 1. A malformed token is treated
// identically to a not-found one below, no separate error path.
const tokenParamSchema = z.string().regex(/^[A-Za-z0-9_-]{32}$/);

// Literal hex values from the shared spec's design system section, used directly since there is
// no token layer to import from in this route (next/og cannot read CSS variables anyway).
const COLORS = {
  canvas: "#000000",
  card: "#131313",
  elevated: "#1E1E1E",
  title: "#F5F5F5",
  dateRange: "#9A9A9A",
  slotsAccent: "#A78BFA",
  wordmark: "#5E5E5E",
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

// Fetches only the glyph subset the event name actually uses (Google's `text=` param), keeping
// the request small. Collects every @font-face block Google's css2 API returns, not just the
// first: it can split a response into multiple blocks (observed for some inputs, though not for
// plain ASCII), and taking only the first silently drops glyphs outside that one subset. Fails
// open: any network or parse error returns an empty array and the caller falls back to satori's
// default font entirely rather than rendering a partially-loaded, mixed-font heading.
//
// The caller must pass the text as it will actually be PAINTED, not the raw source string: the
// heading below applies `textTransform: "uppercase"`, a paint-time transform satori applies after
// glyph selection, so requesting glyphs for the literal mixed-case event name (e.g. "HackGSU")
// only fetches lowercase "ack" glyphs, and satori has no uppercase "ACK" glyphs to paint with,
// falling back to its default font letter-by-letter. Caught by hand-testing this route with a
// real event name during the 2026-08-18 redesign pass: "HackGSU Fall 2026" rendered as
// "H[ACK]G[SU] F[ALL] [2026]" with the bracketed letters in a visibly different font, exactly the
// uppercased forms of the source string's lowercase letters.
async function loadDisplayFontSubsets(paintedText: string): Promise<ArrayBuffer[]> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&text=${encodeURIComponent(paintedText)}`;
    const cssResponse = await fetch(cssUrl, { cache: "no-store" });

    if (!cssResponse.ok) {
      return [];
    }

    const css = await cssResponse.text();
    const matches = [...css.matchAll(/src: url\(([^)]+)\) format\('(?:opentype|truetype)'\)/g)];

    if (matches.length === 0) {
      return [];
    }

    const buffers = await Promise.all(
      matches.map(async (match) => {
        const fontResponse = await fetch(match[1], { cache: "no-store" });
        return fontResponse.ok ? await fontResponse.arrayBuffer() : null;
      }),
    );

    return buffers.filter((buffer): buffer is ArrayBuffer => buffer !== null);
  } catch {
    return [];
  }
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
          background: COLORS.canvas,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: 4,
            color: COLORS.wordmark,
          }}
        >
          PROGSU
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
  const displayFontSubsets = await loadDisplayFontSubsets(schedule.event.name.toUpperCase());
  const hasDisplayFont = displayFontSubsets.length > 0;

  // Decorative row of capsules echoing each shift's own coverage state, matching the product's
  // shift-is-a-capsule convention (empty = elevated gray, partial = orange, full = purple). Purely
  // decorative on this static image, not a real timeline, so capped to a legible count.
  const decorativeShifts = [...schedule.shifts]
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 12);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: COLORS.canvas,
          padding: 48,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 48,
            background: COLORS.card,
            padding: "0 100px",
          }}
        >
          {decorativeShifts.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "row", gap: 8, marginBottom: 36 }}>
              {decorativeShifts.map((shift) => {
                const fillColor =
                  shift.filled <= 0
                    ? COLORS.elevated
                    : shift.filled < shift.needed
                      ? "#FF9F2E"
                      : "#A78BFA";

                return (
                  <div
                    key={shift.id}
                    style={{
                      display: "flex",
                      width: 36,
                      height: 14,
                      borderRadius: 999,
                      background: fillColor,
                    }}
                  />
                );
              })}
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              fontSize: 64,
              fontWeight: 700,
              fontFamily: hasDisplayFont ? DISPLAY_FONT_FAMILY : undefined,
              textTransform: "uppercase",
              letterSpacing: -1,
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
              fontSize: 26,
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
              marginTop: 36,
              fontSize: 32,
              color: COLORS.title,
            }}
          >
            <div style={{ display: "flex", fontWeight: 700, color: COLORS.slotsAccent }}>{filled}</div>
            <div style={{ display: "flex" }}>of</div>
            <div style={{ display: "flex", fontWeight: 700, color: COLORS.slotsAccent }}>{needed}</div>
            <div style={{ display: "flex" }}>slots filled</div>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: 92,
            display: "flex",
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 3,
            color: COLORS.wordmark,
          }}
        >
          PROGSU
        </div>
      </div>
    ),
    {
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
      status: 200,
      headers: { "Cache-Control": CACHE_CONTROL },
      fonts: hasDisplayFont
        ? displayFontSubsets.map((data) => ({
            name: DISPLAY_FONT_FAMILY,
            data,
            weight: 700,
            style: "normal",
          }))
        : undefined,
    },
  );
}
