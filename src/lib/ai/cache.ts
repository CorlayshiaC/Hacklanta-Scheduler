import "server-only";

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { getServerEnv } from "@/lib/env.server";
import type { AiKind } from "@/lib/ai/types";

/**
 * STUB(agent-2): ai_cache is not in supabase/migrations or src/types/database.ts yet (requested
 * in docs/contracts/schema-requests.md: cache_key text primary key, kind text, output jsonb,
 * created_at timestamptz default now(), expires_at timestamptz null). This client deliberately
 * skips the generated Database type for this one table so the rest of the app's typed Supabase
 * usage is unaffected. Swap to the typed admin client (src/lib/supabase/admin.ts) once ai_cache
 * lands. Reads and writes both fail open (treat any error, including "relation does not exist",
 * as a cache miss) so AI features work identically before and after the migration ships, just
 * without caching until then.
 */
function getCacheClient() {
  const env = getServerEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`);

  return `{${entries.join(",")}}`;
}

export function cacheKeyFor(kind: AiKind, input: unknown): string {
  return createHash("sha256").update(`${kind}:${stableStringify(input)}`).digest("hex");
}

export async function getCached(cacheKey: string): Promise<unknown | null> {
  try {
    const supabase = getCacheClient();
    const { data, error } = await supabase
      .from("ai_cache")
      .select("output,expires_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    if (data.expires_at && new Date(data.expires_at as string).getTime() < Date.now()) {
      return null;
    }

    return data.output;
  } catch {
    return null;
  }
}

export async function setCached(
  cacheKey: string,
  kind: AiKind,
  output: unknown,
  ttlSeconds: number,
): Promise<void> {
  try {
    const supabase = getCacheClient();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    await supabase.from("ai_cache").upsert({
      cache_key: cacheKey,
      kind,
      output,
      expires_at: expiresAt,
    });
  } catch {
    // Best-effort. A missing table or a transient failure must never block returning the
    // model's answer to the caller, only skip persisting it for next time.
  }
}
