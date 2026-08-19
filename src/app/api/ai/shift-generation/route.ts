import "server-only";

import { NextResponse } from "next/server";
import { generateShiftDraft } from "@/lib/ai";
import { shiftGenerationInputSchema } from "@/lib/ai/kinds/shift-generation";
import { getRoleAuthorization } from "@/lib/auth/authorization";

export async function POST(request: Request) {
  const authorization = await getRoleAuthorization("director");

  if (!authorization.authorized) {
    const status = authorization.reason === "insufficient_role" ? 403 : 401;
    return NextResponse.json({ ok: false, reason: authorization.reason }, { status });
  }

  const body = await request.json().catch(() => null);
  const parsed = shiftGenerationInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const result = await generateShiftDraft(parsed.data, { userId: authorization.userId });
  return NextResponse.json(result);
}
