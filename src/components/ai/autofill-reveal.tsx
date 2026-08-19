"use client";

import { motion } from "framer-motion";
import { useDrawIn, drawInDelay, useCountUp } from "@/lib/utils/motion";
import type { RankedCandidate } from "@/lib/ai/kinds/autofill";

/**
 * Presentational only, not wired to any route: `rankAutofillCandidates` (src/lib/ai/kinds/
 * autofill.ts) has no mounted UI anywhere in the app yet, coverage-board.tsx doesn't call it. This
 * is the "single most demo-able moment" surface from the V3 brief, ready for Agent 3 to mount on
 * the coverage board or approval queue wherever autofill gets triggered; see the ready-to-mount
 * note in docs/contracts/requests.md. `rationales` is optional (the model-written sentence per
 * candidate, keyed by anonId); omit it to show the deterministic fallback reasoning only.
 *
 * Each candidate row is an orange in-approval capsule using `useDrawIn` (a spring `scaleX` sweep)
 * with `drawInDelay`'s 60ms per-index stagger, matching the brief's "drawIn preset plus a 60ms
 * stagger" literally; the proposal count badge count-ups via `useCountUp`.
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
  const { variants: drawVariants, transition: drawTransition } = useDrawIn();
  const count = useCountUp(candidates.length);

  return (
    <div className="flex flex-col gap-3 rounded-card border border-hairline bg-surface-card p-4 text-text-primary shadow-soft backdrop-blur-glass">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{gapLabel}</span>
        <span className="rounded-pill bg-accent-warn-fill px-2.5 py-0.5 font-mono text-xs tabular-nums text-on-accent">
          {count} proposed
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {candidates.map((candidate, index) => (
          <motion.li
            key={candidate.anonId}
            initial="hidden"
            animate="visible"
            variants={drawVariants}
            transition={{ ...drawTransition, delay: drawInDelay(index) }}
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
        ))}
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
