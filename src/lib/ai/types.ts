/**
 * Pure types, no runtime code. Safe to import from client components (the NL command palette
 * mode needs AiKind and AiResult for typing) without pulling in the server-only Gemini wrapper.
 */

export type AiKind =
  | "shift_generation"
  | "autofill_rationale"
  | "availability_parse"
  | "gap_analysis";

export type AiFailureReason =
  | "no_api_key"
  | "rate_limited"
  | "timeout"
  | "invalid_response"
  | "provider_error";

export type AiResult<T> =
  | { ok: true; data: T; source: "model" | "cache" | "fallback" }
  | { ok: false; reason: AiFailureReason; message: string };

/** Plain JSON Schema, passed to Gemini as `responseJsonSchema`. Subset Gemini supports:
 * $id, $defs, $ref, $anchor, type, format, title, description, enum, items, prefixItems,
 * minItems, maxItems, minimum, maximum, anyOf, oneOf, properties, additionalProperties,
 * required, propertyOrdering. */
export type JsonSchema = Record<string, unknown>;

export type AiPromptSpec = {
  systemInstruction: string;
  prompt: string;
  responseSchema: JsonSchema;
};

export type AiKindDefinition<Input, Output> = {
  kind: AiKind;
  /** null means never cache this kind's output. */
  cacheTtlSeconds: number | null;
  outputSchema: import("zod").ZodType<Output>;
  buildPrompt: (input: Input) => AiPromptSpec;
  /** Pure-code answer used when the model is unavailable, rate limited, or returns garbage.
   * Return null if this kind has no manual path (the caller then gets ok:false). */
  fallback: (input: Input) => Output | null;
};
