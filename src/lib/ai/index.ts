import "server-only";

import { generate } from "@/lib/ai/generate";
import type { AiResult } from "@/lib/ai/types";
import type { AvailabilityParseInput, AvailabilityParseOutput } from "@/lib/ai/kinds/availability-parse";
import type { AutofillRationaleInput, AutofillRationaleOutput } from "@/lib/ai/kinds/autofill";
import type { GapAnalysisInput, GapAnalysisOutput } from "@/lib/ai/kinds/gap-analysis";
import type { QuickchatRephraseInput, QuickchatRephraseOutput } from "@/lib/ai/kinds/quickchat-rephrase";
import type { ShiftGenerationInput, ShiftGenerationOutput } from "@/lib/ai/kinds/shift-generation";

/**
 * Server-only entry point (see docs/contracts/ai.md for the full contract). Typed wrappers around
 * the generic generate(kind, input) the shared brief specifies, so call sites get real Input and
 * Output types instead of unknown. Every export here resolves to AiResult<T>, never throws:
 * callers must handle { ok: false, reason } and render a manual path.
 */

export type { AiFailureReason, AiKind, AiResult } from "@/lib/ai/types";
export { rankAutofillCandidates, type RankedCandidate } from "@/lib/ai/kinds/autofill";
export { buildGapDescriptorFromCell, type GapDescriptor } from "@/lib/ai/kinds/gap-analysis";
export type { AvailabilityParseInput, AvailabilityParseOutput } from "@/lib/ai/kinds/availability-parse";
export type { AutofillRationaleInput, AutofillRationaleOutput } from "@/lib/ai/kinds/autofill";
export type { GapAnalysisInput, GapAnalysisOutput } from "@/lib/ai/kinds/gap-analysis";
export type { QuickchatRephraseInput, QuickchatRephraseOutput } from "@/lib/ai/kinds/quickchat-rephrase";
export { preservesFacts } from "@/lib/ai/kinds/quickchat-rephrase";
export type { ShiftGenerationInput, ShiftGenerationOutput } from "@/lib/ai/kinds/shift-generation";

export function generateShiftDraft(
  input: ShiftGenerationInput,
  opts?: { userId?: string },
): Promise<AiResult<ShiftGenerationOutput>> {
  return generate("shift_generation", input, opts) as Promise<AiResult<ShiftGenerationOutput>>;
}

export function generateAvailabilityDraft(
  input: AvailabilityParseInput,
  opts?: { userId?: string },
): Promise<AiResult<AvailabilityParseOutput>> {
  return generate("availability_parse", input, opts) as Promise<AiResult<AvailabilityParseOutput>>;
}

export function generateGapHeadlines(
  input: GapAnalysisInput,
  opts?: { userId?: string },
): Promise<AiResult<GapAnalysisOutput>> {
  return generate("gap_analysis", input, opts) as Promise<AiResult<GapAnalysisOutput>>;
}

export function generateAutofillRationales(
  input: AutofillRationaleInput,
  opts?: { userId?: string },
): Promise<AiResult<AutofillRationaleOutput>> {
  return generate("autofill_rationale", input, opts) as Promise<AiResult<AutofillRationaleOutput>>;
}

export function generateQuickchatRephrase(
  input: QuickchatRephraseInput,
  opts?: { userId?: string },
): Promise<AiResult<QuickchatRephraseOutput>> {
  return generate("quickchat_rephrase", input, opts) as Promise<AiResult<QuickchatRephraseOutput>>;
}
