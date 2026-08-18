import "server-only";

import { NextResponse } from "next/server";
import { getRoleAuthorization } from "@/lib/auth/authorization";
import { getQuickchatAnswer } from "@/lib/quickchat/data";
import { quickchatRequestSchema } from "@/lib/quickchat/validation";

/**
 * Instant, deterministic answer, no Gemini call on this path at all (that is what makes quickchat
 * "instant and never wrong", see docs/contracts/quickchat.md). The optional rephrase upgrade is a
 * separate request the client fires afterward, POST /api/quickchat/rephrase.
 */
export async function POST(request: Request) {
  const authorization = await getRoleAuthorization("member");

  if (!authorization.authorized) {
    const status = authorization.reason === "insufficient_role" ? 403 : 401;
    return NextResponse.json({ ok: false, reason: authorization.reason }, { status });
  }

  const body = await request.json().catch(() => null);
  const parsed = quickchatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  try {
    const answer = await getQuickchatAnswer(parsed.data.kind);
    return NextResponse.json({ ok: true, answer, source: "template" });
  } catch {
    return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 500 });
  }
}
