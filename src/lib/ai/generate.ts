import "server-only";

import { cacheKeyFor, getCached, setCached } from "@/lib/ai/cache";
import { findBannedWord } from "@/lib/ai/banned-words";
import { callGemini, getGeminiClient, GeminiTimeoutError, isProviderRateLimitError } from "@/lib/ai/gemini-client";
import { KIND_REGISTRY } from "@/lib/ai/kinds/registry";
import { acquireSlot, reportProviderRateLimited } from "@/lib/ai/rate-limiter";
import { AI_CONFIG } from "@/lib/ai/config";
import type { AiFailureReason, AiKind, AiKindDefinition, AiResult } from "@/lib/ai/types";

export type { AiKind, AiResult, AiFailureReason } from "@/lib/ai/types";

/**
 * The one function that talks to Gemini. Every caller gets AiResult<unknown>: `ok:false` never
 * throws past this boundary, and `ok:true` never distinguishes "the model said this" from "the
 * fallback said this" beyond the `source` field, callers should render both the same way. See
 * docs/contracts/ai.md for the full per-kind contract and docs/contracts/ai.md#fallback-behavior
 * for what triggers a fallback.
 */
export async function generate(kind: AiKind, input: unknown, opts: { userId?: string } = {}): Promise<AiResult<unknown>> {
  const def = KIND_REGISTRY[kind] as AiKindDefinition<unknown, unknown>;
  return runKind(def, input, opts);
}

async function runKind<Input, Output>(
  def: AiKindDefinition<Input, Output>,
  input: Input,
  opts: { userId?: string },
): Promise<AiResult<Output>> {
  const cacheKey = def.cacheTtlSeconds !== null ? cacheKeyFor(def.kind, input) : null;

  if (cacheKey) {
    const cached = await getCached(cacheKey);
    if (cached !== null) {
      const parsed = def.outputSchema.safeParse(cached);
      if (parsed.success) {
        return { ok: true, data: parsed.data, source: "cache" };
      }
    }
  }

  const client = getGeminiClient();
  if (!client) {
    return fallbackOrFail(def, input, "no_api_key", "AI features are not configured for this deployment.");
  }

  const slot = await acquireSlot({ userId: opts.userId, timeoutMs: AI_CONFIG.queueTimeoutMs });
  if (!slot.ok) {
    return fallbackOrFail(def, input, "rate_limited", "AI is busy right now.");
  }

  try {
    const promptSpec = def.buildPrompt(input);
    const raw = await callGemini(client, promptSpec);
    const json = parseJson(raw);
    const parsed = def.outputSchema.safeParse(json);

    if (!parsed.success) {
      return fallbackOrFail(def, input, "invalid_response", "The model returned an unexpected response.");
    }

    const banned = findBannedWord(parsed.data);
    if (banned) {
      return fallbackOrFail(def, input, "invalid_response", `Model output used a disallowed phrase ("${banned}").`);
    }

    if (cacheKey && def.cacheTtlSeconds) {
      await setCached(cacheKey, def.kind, parsed.data, def.cacheTtlSeconds);
    }

    return { ok: true, data: parsed.data, source: "model" };
  } catch (error) {
    if (isProviderRateLimitError(error)) {
      reportProviderRateLimited();
      return fallbackOrFail(def, input, "rate_limited", "AI is busy right now.");
    }

    if (error instanceof GeminiTimeoutError) {
      return fallbackOrFail(def, input, "timeout", "The model took too long to respond.");
    }

    return fallbackOrFail(def, input, "provider_error", "The model is unavailable right now.");
  }
}

function fallbackOrFail<Input, Output>(
  def: AiKindDefinition<Input, Output>,
  input: Input,
  reason: AiFailureReason,
  message: string,
): AiResult<Output> {
  const fallback = def.fallback(input);
  if (fallback !== null) {
    return { ok: true, data: fallback, source: "fallback" };
  }
  return { ok: false, reason, message };
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
