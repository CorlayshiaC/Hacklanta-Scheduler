import "server-only";

import { z } from "zod";
import type { AiKindDefinition, AiPromptSpec, JsonSchema } from "@/lib/ai/types";

/**
 * Output intentionally mirrors src/lib/scheduling/bulk-generation.ts's bulkGenerationInputSchema
 * (windowStart, windowEnd, blockLengthMinutes) so the confirm card can feed this straight into
 * Agent 3's generateShiftGrid() once each station name is resolved to a real stationId. Station
 * resolution (match an existing coverage role or offer to create one) happens in the confirm UI,
 * this kind only ever proposes names, never a uuid it cannot know.
 */
export type ShiftGenerationInput = {
  phrase: string;
  /** Caller-supplied "now", ISO instant, so relative terms ("friday", "next week") resolve
   * consistently and are testable without mocking the clock. */
  nowIso: string;
  /** IANA timezone the phrase's clock times should be read in, e.g. "America/New_York". */
  timezone: string;
};

/** API-boundary validation for POST /api/ai/shift-generation. */
export const shiftGenerationInputSchema = z.object({
  phrase: z.string().trim().min(1).max(500),
  nowIso: z.string().datetime(),
  timezone: z.string().min(1).max(64),
}) satisfies z.ZodType<ShiftGenerationInput>;

const stationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  headcount: z.number().int().min(1).max(99),
});

const confidenceSchema = z.object({
  windowStart: z.number().min(0).max(1).optional(),
  windowEnd: z.number().min(0).max(1).optional(),
  blockLengthMinutes: z.number().min(0).max(1).optional(),
  stations: z.number().min(0).max(1).optional(),
});

const shiftGenerationOutputSchema = z.object({
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
  blockLengthMinutes: z.number().int().min(15).max(24 * 60),
  stations: z.array(stationSchema).min(1),
  confidence: confidenceSchema,
  clarifications: z.array(z.string()),
});

export type ShiftGenerationOutput = z.infer<typeof shiftGenerationOutputSchema>;

const RESPONSE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    windowStart: { type: "string", description: "ISO 8601 instant in UTC" },
    windowEnd: { type: "string", description: "ISO 8601 instant in UTC" },
    blockLengthMinutes: {
      type: "integer",
      minimum: 15,
      maximum: 1440,
      description: "Full window length in minutes if the request implies one continuous block.",
    },
    stations: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          headcount: { type: "integer", minimum: 1, maximum: 99 },
        },
        required: ["name", "headcount"],
      },
    },
    confidence: {
      type: "object",
      description: "0 to 1 per field, 1 means the request stated it explicitly and unambiguously.",
      properties: {
        windowStart: { type: "number", minimum: 0, maximum: 1 },
        windowEnd: { type: "number", minimum: 0, maximum: 1 },
        blockLengthMinutes: { type: "number", minimum: 0, maximum: 1 },
        stations: { type: "number", minimum: 0, maximum: 1 },
      },
    },
    clarifications: {
      type: "array",
      items: { type: "string" },
      description: "Plain-language questions for anything guessed rather than stated.",
    },
  },
  required: ["windowStart", "windowEnd", "blockLengthMinutes", "stations", "confidence", "clarifications"],
};

function buildPrompt(input: ShiftGenerationInput): AiPromptSpec {
  return {
    systemInstruction:
      "You convert a short natural-language shift request into a structured shift-generation " +
      "draft for a student organization's shift scheduling tool. Never invent a time, headcount, " +
      "or station name the request does not support: put anything guessed rather than stated into " +
      "clarifications and give it a low confidence value instead of a confident-looking default.",
    prompt: [
      `Current instant: ${input.nowIso}`,
      `Timezone: ${input.timezone}`,
      `Request: "${input.phrase}"`,
      "",
      "Return the shift window as UTC ISO instants, the block length in minutes each station is",
      "split into (the full window length if the request implies one continuous block, not",
      "sub-divided), and the stations with their per-block headcount.",
    ].join("\n"),
    responseSchema: RESPONSE_SCHEMA,
  };
}

export const shiftGenerationKind: AiKindDefinition<ShiftGenerationInput, ShiftGenerationOutput> = {
  kind: "shift_generation",
  cacheTtlSeconds: 600,
  outputSchema: shiftGenerationOutputSchema,
  buildPrompt,
  // Free-text parsing has no deterministic equivalent: when the model is unavailable the
  // organizer uses Agent 3's manual bulk-generate form instead of this kind's confirm card.
  fallback: () => null,
};
