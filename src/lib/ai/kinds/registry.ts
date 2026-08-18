import "server-only";

import { availabilityParseKind } from "@/lib/ai/kinds/availability-parse";
import { autofillRationaleKind } from "@/lib/ai/kinds/autofill";
import { gapAnalysisKind } from "@/lib/ai/kinds/gap-analysis";
import { quickchatRephraseKind } from "@/lib/ai/kinds/quickchat-rephrase";
import { shiftGenerationKind } from "@/lib/ai/kinds/shift-generation";
import type { AiKind, AiKindDefinition } from "@/lib/ai/types";

// The registry is intentionally heterogeneous (each kind has its own Input/Output pair);
// generate.ts narrows per call site via the typed wrapper functions in src/lib/ai/index.ts, this
// file only ever dispatches by kind. `any` here, not `unknown`, because AiKindDefinition's
// function-typed properties (buildPrompt, fallback) are contravariant in Input: `unknown` would
// reject assigning a concrete AiKindDefinition<X, Y> into this slot at all.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const KIND_REGISTRY: Record<AiKind, AiKindDefinition<any, any>> = {
  shift_generation: shiftGenerationKind,
  availability_parse: availabilityParseKind,
  gap_analysis: gapAnalysisKind,
  autofill_rationale: autofillRationaleKind,
  quickchat_rephrase: quickchatRephraseKind,
};
