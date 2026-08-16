import "server-only";

import { z } from "zod";
import type { AiKindDefinition, AiPromptSpec, JsonSchema } from "@/lib/ai/types";
import { checkAssignmentConflicts, type ConflictCheckInput } from "@/lib/scheduling/conflict-engine";
import { isBlocked, type ConflictCheckResult } from "@/lib/scheduling/types";

/**
 * Ranking and eligibility are deterministic code, never model output, per the shared brief's
 * constraints section (this takes precedence over deliverable 3's looser "Gemini ranks among
 * valid candidates" phrasing). rankAutofillCandidates reuses checkAssignmentConflicts from
 * src/lib/scheduling/conflict-engine.ts, per that file's own doc comment naming this module as a
 * consumer, rather than reimplementing eligibility here. The model only writes a rationale
 * sentence per already-ranked, already-anonymized candidate; it never sees a real name or id.
 */
export type RankedCandidate = {
  profileId: string;
  anonId: string;
  conflict: ConflictCheckResult;
  assignedHoursThisWeek: number;
};

export function rankAutofillCandidates(
  candidates: { profileId: string; input: ConflictCheckInput }[],
): RankedCandidate[] {
  const statusRank = (result: ConflictCheckResult) => (result.status === "ok" ? 0 : 1);

  return candidates
    .map((candidate) => ({
      profileId: candidate.profileId,
      conflict: checkAssignmentConflicts(candidate.input),
      assignedHoursThisWeek: candidate.input.assignedHoursThisWeek,
    }))
    .filter((candidate) => !isBlocked(candidate.conflict))
    .sort((a, b) => {
      const rankDiff = statusRank(a.conflict) - statusRank(b.conflict);
      return rankDiff !== 0 ? rankDiff : a.assignedHoursThisWeek - b.assignedHoursThisWeek;
    })
    .map((candidate, index) => ({ ...candidate, anonId: `candidate_${index + 1}` }));
}

function fallbackRationale(candidate: RankedCandidate): string {
  if (candidate.conflict.status === "warning") {
    return candidate.conflict.reasons.join(" ");
  }
  // "blocked" never reaches here, rankAutofillCandidates already filters it out (isBlocked), kept
  // exhaustive so a future change to ConflictCheckResult can't silently produce a blank rationale.
  return `Available, ${candidate.assignedHoursThisWeek}h assigned this week.`;
}

export type AutofillRationaleInput = {
  gapLabel: string;
  candidates: RankedCandidate[];
};

const rationaleSchema = z.object({
  anonId: z.string(),
  text: z.string().max(160),
});

const autofillRationaleOutputSchema = z.object({
  rationales: z.array(rationaleSchema),
});

export type AutofillRationaleOutput = z.infer<typeof autofillRationaleOutputSchema>;

const RESPONSE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    rationales: {
      type: "array",
      items: {
        type: "object",
        properties: {
          anonId: { type: "string" },
          text: { type: "string", maxLength: 160 },
        },
        required: ["anonId", "text"],
      },
    },
  },
  required: ["rationales"],
};

function buildPrompt(input: AutofillRationaleInput): AiPromptSpec {
  return {
    systemInstruction:
      "You write one short rationale sentence per candidate for filling a scheduling gap. Use " +
      "only the facts given for that candidate (their status and reasons, their hours assigned " +
      "this week). Never invent a name, a preference, or a fact not provided. Candidates are " +
      "anonymized ids, refer to them only by that id.",
    prompt: [
      `Gap: ${input.gapLabel}`,
      "Candidates:",
      ...input.candidates.map(
        (candidate) =>
          `- ${candidate.anonId}: status=${candidate.conflict.status}` +
          (candidate.conflict.status === "warning" ? `, reasons=${candidate.conflict.reasons.join("; ")}` : "") +
          `, hoursThisWeek=${candidate.assignedHoursThisWeek}`,
      ),
      "",
      "Return one rationale per candidate, same anonId, each under 160 characters.",
    ].join("\n"),
    responseSchema: RESPONSE_SCHEMA,
  };
}

export const autofillRationaleKind: AiKindDefinition<AutofillRationaleInput, AutofillRationaleOutput> = {
  kind: "autofill_rationale",
  // Not cached: candidate lists and hours are contextual to one gap at one moment, caching risks
  // a stale rationale text after the underlying schedule changes.
  cacheTtlSeconds: null,
  outputSchema: autofillRationaleOutputSchema,
  buildPrompt,
  fallback: (input) => ({
    rationales: input.candidates.map((candidate) => ({
      anonId: candidate.anonId,
      text: fallbackRationale(candidate),
    })),
  }),
};
