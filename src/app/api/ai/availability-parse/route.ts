import "server-only";

import { NextResponse } from "next/server";
import { generateAvailabilityDraft } from "@/lib/ai";
import { availabilityParseInputSchema } from "@/lib/ai/kinds/availability-parse";
import { getActiveUserAuthorization } from "@/lib/auth/authorization";

export async function POST(request: Request) {
  const authorization = await getActiveUserAuthorization();

  if (!authorization.authorized) {
    return NextResponse.json({ ok: false, reason: "unauthenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = availabilityParseInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const result = await generateAvailabilityDraft(parsed.data, { userId: authorization.userId });
  return NextResponse.json(result);
}
