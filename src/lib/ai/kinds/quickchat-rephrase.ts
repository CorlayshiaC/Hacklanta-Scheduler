import "server-only";

import { z } from "zod";
import type { AiKindDefinition, AiPromptSpec, JsonSchema } from "@/lib/ai/types";

/**
 * Quickchat's answers are deterministic sentences built from real data (docs/contracts/
 * quickchat.md): "Next shift: Sat 2:00 PM, Check-in Desk, Hacklanta II." This kind may only
 * rephrase that sentence for tone, never add or drop a fact. The template is both the input seed
 * and the fallback, per the shared brief's "the template IS the fallback, answers are instant and
 * never wrong": a rephrase is a pure enhancement applied in the background after the template
 * already rendered, see src/lib/quickchat/data.ts.
 *
 * Every digit run (a time, a count, an hours figure) in `template` must appear unchanged, in the
 * same order, in the rephrase. `assertPreservesFacts` is the one hard guard against a model
 * silently changing "2/3" to "3/3" while rephrasing; callers must run it and discard the rephrase
 * on failure, this kind's own schema validation cannot see the input to check it.
 */
export type QuickchatRephraseInput = {
  template: string;
};

const rephraseSchema = z.object({
  text: z.string().max(200),
});

export type QuickchatRephraseOutput = z.infer<typeof rephraseSchema>;

const RESPONSE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    text: { type: "string", maxLength: 200, description: "The rephrased sentence, same facts, same numbers." },
  },
  required: ["text"],
};

function buildPrompt(input: QuickchatRephraseInput): AiPromptSpec {
  return {
    systemInstruction:
      "You lightly rephrase one short factual sentence from a scheduling app for tone only. Keep " +
      "every number, time, name, and count exactly as given, in the same order. Never add a fact, " +
      "a greeting, or a call to action. Stay under 15 words. Calm, plain language.",
    prompt: `Sentence: "${input.template}"\n\nReturn the rephrased sentence.`,
    responseSchema: RESPONSE_SCHEMA,
  };
}

function digitGroups(text: string): string[] {
  return text.match(/\d+/g) ?? [];
}

/** True if `candidate` keeps every digit run from `template`, in order. The one hard guard on a
 * free-text rephrase: reject and fall back to the template rather than risk a wrong number. */
export function preservesFacts(template: string, candidate: string): boolean {
  const templateDigits = digitGroups(template);
  const candidateDigits = digitGroups(candidate);
  return templateDigits.length === candidateDigits.length && templateDigits.every((digits, index) => digits === candidateDigits[index]);
}

export const quickchatRephraseKind: AiKindDefinition<QuickchatRephraseInput, QuickchatRephraseOutput> = {
  kind: "quickchat_rephrase",
  // Not cached: quickchat answers are personalized (next shift time, this member's hours), a
  // per-user template is already close to unique, caching would rarely hit and risks staleness
  // the moment the underlying schedule changes.
  cacheTtlSeconds: null,
  outputSchema: rephraseSchema,
  buildPrompt,
  fallback: (input) => ({ text: input.template }),
};
