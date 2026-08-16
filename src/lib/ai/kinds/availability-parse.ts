import "server-only";

import { z } from "zod";
import type { AiKindDefinition, AiPromptSpec, JsonSchema } from "@/lib/ai/types";

/**
 * STUB(agent-4): output shape assumed to match availability_windows' insert shape (concrete
 * startsAt/endsAt ISO instant pairs, see src/types/database.ts's availability_windows table and
 * src/lib/availability/validation.ts's AvailabilityWindowLike), expanded across the given range
 * rather than left as a recurring day-of-week pattern, since that is what the table persists
 * regardless of how the grid UI collects it. Agent 4 has not published a paintDraft contract yet;
 * adjust this shape once they do. Logged in docs/contracts/pending.md.
 */
export type AvailabilityParseInput = {
  phrase: string;
  /** Bounds the expansion, e.g. the relevant event's starts_at/ends_at. */
  rangeStart: string;
  rangeEnd: string;
  timezone: string;
};

/** API-boundary validation for POST /api/ai/availability-parse. */
export const availabilityParseInputSchema = z.object({
  phrase: z.string().trim().min(1).max(500),
  rangeStart: z.string().datetime(),
  rangeEnd: z.string().datetime(),
  timezone: z.string().min(1).max(64),
}) satisfies z.ZodType<AvailabilityParseInput>;

const windowSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

const availabilityParseOutputSchema = z.object({
  windows: z.array(windowSchema),
  confidence: z.number().min(0).max(1),
  clarifications: z.array(z.string()),
});

export type AvailabilityParseOutput = z.infer<typeof availabilityParseOutputSchema>;

const RESPONSE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    windows: {
      type: "array",
      description: "Concrete availability windows within the given range, one per contiguous block.",
      items: {
        type: "object",
        properties: {
          startsAt: { type: "string", description: "ISO 8601 instant in UTC" },
          endsAt: { type: "string", description: "ISO 8601 instant in UTC" },
        },
        required: ["startsAt", "endsAt"],
      },
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    clarifications: { type: "array", items: { type: "string" } },
  },
  required: ["windows", "confidence", "clarifications"],
};

function buildPrompt(input: AvailabilityParseInput): AiPromptSpec {
  return {
    systemInstruction:
      "You convert a short natural-language availability statement into concrete date-time " +
      "windows for a shift-scheduling tool. Expand recurring patterns (weekday evenings, except " +
      "a named day) into one window per matching occurrence inside the given range. If the phrase " +
      "is ambiguous, return your best reading and note the ambiguity in clarifications rather " +
      "than returning no windows.",
    prompt: [
      `Range: ${input.rangeStart} to ${input.rangeEnd}`,
      `Timezone: ${input.timezone}`,
      `Statement: "${input.phrase}"`,
      "",
      "Return every matching window inside the range as UTC ISO instant pairs.",
    ].join("\n"),
    responseSchema: RESPONSE_SCHEMA,
  };
}

export const availabilityParseKind: AiKindDefinition<AvailabilityParseInput, AvailabilityParseOutput> = {
  kind: "availability_parse",
  cacheTtlSeconds: 600,
  outputSchema: availabilityParseOutputSchema,
  buildPrompt,
  // No deterministic equivalent for free text. When unavailable, the member paints the grid by
  // hand, the manual path is already good, per the shared brief.
  fallback: () => null,
};
