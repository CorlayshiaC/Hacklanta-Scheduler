# Public surfaces contract (Agent 5)

Published by Agent 5 (Shareable Surfaces & Settings). This is the interface other agents build against. Implementation lives entirely under paths Agent 5 owns; nobody else should need to touch those paths, only consume the shapes below.

Status: DRAFT. Blocked on `share_tokens`, `org_settings`, and the `organizer` role value, all requested in `schema-requests.md`. Until those land, the routes described here run against local stubs (see `pending.md`) and will not serve real data.

## 1. Share token format

- Generated server-side: 24 random bytes, base64url-encoded, no padding, 32 characters. `crypto.randomBytes(24).toString("base64url")`.
- Stored in `share_tokens.token`, unique, indexed. Opaque to clients: treat as a bearer credential, never as a lookup key a client could enumerate or guess.
- One event can have multiple active tokens (e.g. reissue without disrupting an old link, or separate tokens per audience). Revocation is per-token, not per-event.
- A token is valid if `revoked_at is null`. Revoking sets `revoked_at = now()`. No grace period: the public page and OG endpoint must both re-check validity per request (no caching that outlives revocation by more than the CDN's short OG cache, see section 3).

## 2. Public schedule page

- URL: `/s/[token]`
- No auth. No cookies set. No analytics scripts.
- Renders one event's published shifts and their filled/needed counts and assignee names, subject to the org's name display policy (`org_settings.public_name_display`: `full_name` | `first_name` | `initials`). Only `published` shift assignments are shown, never `draft`.
- Data returned to the client (via a server component fetch, not a client-exposed API) contains only: event name, date range, timezone, shift title/station/time/location, headcount needed/filled, and assignee display names per the policy above. No email, no profile id, no role, no availability data, no member-only fields ever cross this boundary.
- Invalid or revoked token: 404 (Next `notFound()`), not a 403 or an error page that reveals the token existed.
- "Find my shifts" filters client-side against the display names already present in the payload (first name or initials, whatever the policy sent). It does not perform a server round-trip and does not have access to full names when the policy withholds them, by design.
- Mobile: collapses to an agenda list grouped by station instead of a grid.

## 3. OG image endpoint

- URL: `/api/og/[token]`
- Same token validity rule as section 2: revoked or invalid token returns a 404 image response (a plain dark fallback card), not the event's data.
- Content: event name, date range (mono), "X of Y slots filled" aggregate (not per-shift detail), progsu wordmark. No assignee names.
- Cache: `Cache-Control: public, max-age=300, s-maxage=300` (5 minutes). This is the one place a revoked token can theoretically still render for up to 5 minutes at the CDN edge; acceptable for an aggregate-only image with no names, called out explicitly since "revoking dies within a minute" (section 2 promise) applies to the HTML page, not this cached image.
- Built with `ImageResponse` from `next/og` (built into Next.js on this version, zero new dependency), not the external `@vercel/og` package.

## 4. Embed widget

- Served at `GET /api/embed/widget.js` (`Content-Type: application/javascript`, `Access-Control-Allow-Origin: *`, long cache with a versioned query param for busting).
- Source authored in `public-embed/widget.js`, vanilla JS, no framework, renders into a Shadow DOM root so host-page CSS cannot leak in and the widget's CSS cannot leak out.
- Usage snippet (documented for real in Settings > Organization once built):
  ```html
  <div id="progsu-shifts"></div>
  <script src="https://<deployment-host>/api/embed/widget.js"
          data-target="progsu-shifts"
          data-count="5"
          data-event-id=""
          async></script>
  ```
  - `data-target`: id of the container element to render into.
  - `data-count`: max upcoming shifts to list. Default 5.
  - `data-event-id`: optional, filters to one event. Omit for org-wide upcoming shifts.
- Widget only reads a public, unauthenticated summary endpoint (no token required, no member data), lists upcoming published shifts with time/station/fill count, and links each item out to that event's public page if one exists.

## 5. Share-menu API (for Agent 3's coverage board)

Agent 3 mounts a "Share" action on the coverage board. Agent 5 owns the token lifecycle; Agent 3 only needs to call these and render the result, it does not touch `share_tokens` directly.

- `createShareToken(eventId: string, label?: string): Promise<{ token: string; url: string }>` — server action, exported from `src/lib/export/share.ts` (Agent 5 owned). Requires organizer/admin. Returns the full public URL (`${SITE_URL}/s/${token}`).
- `listShareTokens(eventId: string): Promise<{ token: string; label: string | null; createdAt: string; revokedAt: string | null }[]>` — same file.
- `revokeShareToken(token: string): Promise<void>` — same file.
- Agent 3's share menu: "Copy link" (calls create-or-reuse-active, copies URL), "Print" (opens `/s/[token]` with `?print=1` or a dedicated print route, see `lib/export/print.ts`), "Download CSV" (organizer-only, hits a server action in `lib/export/csv.ts`), "Manage links" (lists/revokes via the two calls above).

## 6. Print export

- `/s/[token]` renders a dedicated print stylesheet (`components/public/print.css`, loaded only on that route) that flattens neumorphism to hairline tables when `window.matchMedia('print')` / `@media print` applies. No shadows in print output (they waste toner and print muddy). Station x time grid, one page per day, mono header with event name and date range.
- This is the one sanctioned deviation from the neumorphic system for this whole product, scoped strictly to `@media print` on this one route.

## 7. CSV export

- Organizer-only, triggered from the coverage board share menu or an "Export CSV" action inside Settings.
- Columns: `station, start, end, location, assignees (semicolon-separated full names), filled, needed`.
- Uses full names (organizer-only surface, not the public page), server-side generation, `Content-Disposition: attachment`.

## Open items blocking full implementation

See `schema-requests.md` for `share_tokens`, `org_settings`, `notification_preferences`, and the `organizer` role value. See `pending.md` for what is stubbed in the meantime.
