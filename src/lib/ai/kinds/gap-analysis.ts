import "server-only";

import { z } from "zod";
import type { AiKindDefinition, AiPromptSpec, JsonSchema } from "@/lib/ai/types";
import type { ShiftCell } from "@/lib/scheduling/types";

/**
 * The gap list is computed entirely in code from Agent 3's ShiftCell (coverage) plus the
 * caller's availability match count; Gemini only phrases each headline. buildGapDescriptorFromCell
 * is the one piece of that computation this module owns (it needs no data Agent 3 doesn't already
 * have on the coverage board), the rest, matching available members against a shift, stays in
 * Agent 3's conflict-engine.ts per its own doc comment.
 */
export type GapDescriptor = {
  label: string;
  shortBy: number;
  availableUnassigned: number;
};

export function buildGapDescriptorFromCell(cell: ShiftCell, availableUnassigned: number): GapDescriptor | null {
  const shortBy = cell.headcountRequired - cell.headcountAssigned;
  if (shortBy <= 0) {
    return null;
  }

  return {
    label: `${cell.title}${cell.station ? ` (${cell.station.name})` : ""}`,
    shortBy,
    availableUnassigned,
  };
}

export function templateHeadline(gap: GapDescriptor): string {
  const isSingular = gap.availableUnassigned === 1;
  const people = isSingular ? "member" : "members";
  const verb = isSingular ? "is" : "are";
  return `${gap.label} is ${gap.shortBy} short. ${gap.availableUnassigned} available ${people} ${verb} unassigned.`;
}

export type GapAnalysisInput = {
  gaps: GapDescriptor[];
};

const headlineSchema = z.object({
  label: z.string(),
  text: z.string().max(160),
});

const gapAnalysisOutputSchema = z.object({
  headlines: z.array(headlineSchema),
});

export type GapAnalysisOutput = z.infer<typeof gapAnalysisOutputSchema>;

const RESPONSE_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    headlines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "Echo the gap's label exactly." },
          text: { type: "string", maxLength: 160 },
        },
        required: ["label", "text"],
      },
    },
  },
  required: ["headlines"],
};

function buildPrompt(input: GapAnalysisInput): AiPromptSpec {
  return {
    systemInstruction:
      "You write one short, factual sentence per coverage gap for a shift-scheduling dashboard. " +
      "State only the numbers given, never invent a cause, urgency, or call to action beyond what " +
      "the numbers imply. Calm, plain language, no alarmist tone.",
    prompt: [
      "Gaps:",
      ...input.gaps.map((gap) => `- ${gap.label}: short by ${gap.shortBy}, ${gap.availableUnassigned} available unassigned`),
      "",
      "Return one headline per gap, in the same order, each under 160 characters.",
    ].join("\n"),
    responseSchema: RESPONSE_SCHEMA,
  };
}

export const gapAnalysisKind: AiKindDefinition<GapAnalysisInput, GapAnalysisOutput> = {
  kind: "gap_analysis",
  cacheTtlSeconds: 300,
  outputSchema: gapAnalysisOutputSchema,
  buildPrompt,
  fallback: (input) => ({
    headlines: input.gaps.map((gap) => ({ label: gap.label, text: templateHeadline(gap) })),
  }),
};
