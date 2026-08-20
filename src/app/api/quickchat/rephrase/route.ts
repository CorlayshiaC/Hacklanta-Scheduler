import "server-only";

import { NextResponse } from "next/server";
import { getRoleAuthorization } from "@/lib/auth/authorization";
import { generateQuickchatRephrase, preservesFacts } from "@/lib/ai";
import { isRephraseEligible } from "@/lib/quickchat/data";
import { quickchatRephraseRequestSchema } from "@/lib/quickchat/validation";

/**
 * Best-effort background upgrade over the already-rendered template answer, per docs/contracts/
 * quickchat.md. `kind` decides eligibility server-side (never a client-supplied flag): `coworkers`
 * answers name other members and never reach this path, no exceptions.
 */
export async function POST(request: Request) {
  const authorization = await getRoleAuthorization("member");

  if (!authorization.authorized) {
    const status = authorization.reason === "insufficient_role" ? 403 : 401;
    return NextResponse.json({ ok: false, reason: authorization.reason }, { status });
  }

  const body = await request.json().catch(() => null);
  const parsed = quickchatRephraseRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const { kind, template } = parsed.data;

  if (!isRephraseEligible(kind)) {
    return NextResponse.json({ ok: true, text: template, source: "template" });
  }

  const result = await generateQuickchatRephrase({ template }, { userId: authorization.userId });

  if (!result.ok || result.source === "fallback" || !preservesFacts(template, result.data.text)) {
    return NextResponse.json({ ok: true, text: template, source: "template" });
  }

  return NextResponse.json({ ok: true, text: result.data.text, source: "rephrased" });
}
