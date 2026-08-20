// Serves public-embed/widget.js verbatim at GET /api/embed/widget.js, so third-party
// pages can point a <script src="…/api/embed/widget.js"> tag at this deployment without
// this app needing a public/ static asset for it. Source of truth lives at
// public-embed/widget.js, read fresh from disk on every request (see Cache-Control below
// for how long a caller/CDN is expected to hold onto the response instead).

import { readFileSync } from "node:fs";
import path from "node:path";

export async function GET() {
  try {
    const widgetPath = path.join(process.cwd(), "public-embed", "widget.js");
    const source = readFileSync(widgetPath, "utf-8");

    return new Response(source, {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    // Fail quietly: a broken embed script tag should not drop an HTML error page into
    // someone else's page as if it were JavaScript.
    return new Response("// widget temporarily unavailable\n", {
      status: 500,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
}
