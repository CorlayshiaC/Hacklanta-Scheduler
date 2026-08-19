"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useCountUp, useDrawIn, drawInDelay } from "@/lib/utils/motion";
import type { RankedCandidate } from "@/lib/ai/kinds/autofill";

/** motion-spec.md section 9, "AI fill reveal": cap the bar cascade at 24, remainder together (per
 * useDrawIn's own doc comment, clamp the index ourselves before passing it to drawInDelay). */
const BAR_CASCADE_CAP = 24;

/**
 * Presentational only, not wired to any route: `rankAutofillCandidates` (src/lib/ai/kinds/
 * autofill.ts) has no mounted UI anywhere in the app yet, coverage-board.tsx doesn't call it. This
 * is section 9's "single most choreographed moment in the product," ready for Agent 3 to mount on
 * the coverage board wherever a "Fill gaps" trigger lands; see the ready-to-mount note in
 * docs/contracts/requests.md. `rationales` is optional (the model-written sentence per candidate,
 * keyed by anonId); omit it to show the deterministic fallback reasoning only.
 *
 * Scoped deliberately: this renders one gap's ranked candidate list, not "bars onto the Gantt"
 * (that's Agent 3's coverage board) and candidates have no start time of their own to order by
 * (that ordering applies to the Gantt bars across multiple gaps, not within one gap's candidates),
 * so this keeps rank order and reproduces only the parts section 9 specifies that are actually
 * mine: orange stagger-bars capsules drawing in left to right, capped at 24, and the proposal-count
 * badge rolling up only once the last bar lands (not on mount).
 */
export function AutofillProposalReveal({
  gapLabel,
  candidates,
  rationales,
}: {
  gapLabel: string;
  candidates: RankedCandidate[];
  rationales?: Record<string, string>;
}) {
  const [landed, setLanded] = useState(false);
  const { variants: drawVariants, transition: drawTransition } = useDrawIn();
  const count = useCountUp(landed ? candidates.length : 0);
  const lastIndex = candidates.length - 1;

  return (
    <div className="flex flex-col gap-3 rounded-card border border-hairline bg-surface-card p-4 text-text-primary shadow-soft shadow-glow backdrop-blur-glass">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{gapLabel}</span>
        <span className="rounded-pill bg-accent-warn-fill px-2.5 py-0.5 font-mono text-xs tabular-nums text-on-accent">
          {count} proposed
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {candidates.map((candidate, index) => {
          const cascadeIndex = Math.min(index, BAR_CASCADE_CAP - 1);
          return (
            <motion.li
              key={candidate.anonId}
              initial="hidden"
              animate="visible"
              variants={drawVariants}
              transition={{ ...drawTransition, delay: drawInDelay(cascadeIndex) }}
              onAnimationComplete={index === lastIndex ? () => setLanded(true) : undefined}
              style={{ transformOrigin: "left" }}
              className="flex items-center justify-between gap-3 rounded-pill bg-accent-warn-fill px-3 py-2 text-on-accent"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 rounded-pill bg-black/15 px-2 py-0.5 font-mono text-[10px] tabular-nums">
                  {candidate.anonId}
                </span>
                <span className="truncate text-xs">{rationales?.[candidate.anonId] ?? fallbackText(candidate)}</span>
              </div>
              <span className="shrink-0 font-mono text-xs tabular-nums">{candidate.assignedHoursThisWeek}h</span>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

function fallbackText(candidate: RankedCandidate): string {
  if (candidate.conflict.status === "warning") {
    return candidate.conflict.reasons.join(" ");
  }
  return "Available, no conflicts.";
}
