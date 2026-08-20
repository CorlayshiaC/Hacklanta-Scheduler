"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { NeuCheckbox } from "@/components/ui/neu-checkbox";
import { PillButton } from "@/components/ui/neu-button";
import { StatusPill } from "@/components/ui/status-pill";
import { approveAssignments, declineAssignment } from "@/lib/scheduling/actions";
import type { ApprovalQueueRow } from "@/lib/scheduling/data";
import { formatShiftRange } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { EASE_OUT_SLOW, SPRING_STANDARD, STAGGER_TIGHT, useCascadeItem } from "@/lib/utils/motion";

/**
 * motion-spec.md section 7 / section 10 delight #3, "approval batch completion sweep": rows check
 * off top to bottom with stagger-tight, each row's StatusPill flips via its own built-in atom (the
 * dot-crossfade-plus-text-slide is StatusPill's own internal animation, this component only decides
 * *when* each row's state flips), then the approved rows compact out with layout springs after a
 * 400ms hold so the admin sees what happened before the list shrinks. The floating action bar
 * slides away as soon as a sweep starts.
 */
const APPROVE_HOLD_MS = 400;

export type ApprovalQueueProps = {
  rows: ApprovalQueueRow[];
  eventTimezone: string;
  /** False for a director (read-only view of their own events' queue), true for an admin. */
  canApprove: boolean;
};

/**
 * One event's pending-approval rows. Lives inside a parent Card (src/app/(app)/approval/page.tsx
 * renders one Card per event), so this stays a plain stacked list, no nested Card.
 */
export function ApprovalQueue({ rows, eventTimezone, canApprove }: ApprovalQueueProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [justApproved, setJustApproved] = useState<Set<string>>(new Set());
  const [isSweeping, setIsSweeping] = useState(false);
  const [isApproving, startApproveTransition] = useTransition();
  const [isDeclining, startDeclineTransition] = useTransition();
  // motion-spec.md law 6: a busy event's pending queue can exceed 30 rows, so entrance uses the
  // capped per-item cascade rather than an unbounded staggerChildren.
  const cascade = useCascadeItem();

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && selected.size < rows.length;

  function toggleRow(assignmentId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(assignmentId);
      } else {
        next.delete(assignmentId);
      }
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(rows.map((row) => row.assignmentId)) : new Set());
  }

  function handleApproveSelected() {
    setErrorMessage(null);
    // Top-to-bottom row order, not selection order, so the check-off sweep always reads
    // top-to-bottom regardless of the order rows were clicked in.
    const approvedIds = rows.map((row) => row.assignmentId).filter((id) => selected.has(id));
    setSelected(new Set());
    setIsSweeping(true);

    startApproveTransition(async () => {
      const result = await approveAssignments({ assignmentIds: approvedIds });
      if (!result.ok) {
        setErrorMessage(result.message);
        setIsSweeping(false);
        return;
      }

      // Stagger-tight check-off, top to bottom: each row's StatusPill flips to "approved" on its
      // own schedule, driving that primitive's own dot-crossfade-plus-text-slide atom.
      approvedIds.forEach((id, index) => {
        setTimeout(() => {
          setJustApproved((prev) => new Set([...prev, id]));
        }, index * STAGGER_TIGHT * 1000);
      });

      const sweepDurationMs = approvedIds.length * STAGGER_TIGHT * 1000;
      setTimeout(() => {
        router.refresh();
        setIsSweeping(false);
      }, sweepDurationMs + APPROVE_HOLD_MS);
    });
  }

  function handleDecline(assignmentId: string) {
    setErrorMessage(null);
    setDecliningId(assignmentId);
    startDeclineTransition(async () => {
      const result = await declineAssignment({ assignmentId });
      if (result.ok) {
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(assignmentId);
          return next;
        });
        router.refresh();
      } else {
        setErrorMessage(result.message);
      }
      setDecliningId(null);
    });
  }

  if (rows.length === 0) {
    return <p className="text-sm text-text-secondary">Nothing waiting on approval.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence initial={false}>
        {canApprove && !isSweeping ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-3"
            exit={{ opacity: 0, y: 8 }}
            initial={{ opacity: 0, y: 8 }}
            transition={EASE_OUT_SLOW}
          >
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <NeuCheckbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={(checked) => toggleAll(checked === true)}
                aria-label="Select all pending assignments"
              />
              Select all
            </label>
            <PillButton
              variant="primary"
              size="sm"
              disabled={selected.size === 0 || isApproving}
              onClick={handleApproveSelected}
            >
              {isApproving ? "Approving..." : "Approve selected"}
            </PillButton>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {errorMessage ? (
        <p role="alert" className="text-sm text-accent-warn">
          {errorMessage}
        </p>
      ) : null}

      <AnimatePresence mode="popLayout">
        <ul className="flex flex-col divide-y divide-hairline">
          {rows.map((row, index) => {
            const stationOrTitle = row.station?.name ?? row.shiftTitle;
            const isChecked = selected.has(row.assignmentId);
            const isApprovedSweep = justApproved.has(row.assignmentId);
            const entrance = cascade.item(index, rows.length);

            return (
              <motion.li
                animate="visible"
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between"
                exit={{ opacity: 0 }}
                initial="hidden"
                key={row.assignmentId}
                layout
                transition={{ ...entrance.transition, layout: SPRING_STANDARD }}
                variants={entrance.variants}
              >
                <div className={cn("flex flex-1 gap-3", canApprove && "items-start")}>
                  {canApprove && !isApprovedSweep ? (
                    <NeuCheckbox
                      className="mt-1"
                      checked={isChecked}
                      onCheckedChange={(checked) => toggleRow(row.assignmentId, checked === true)}
                      aria-label={`Select ${row.personName} for ${stationOrTitle}`}
                    />
                  ) : null}
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold text-text-primary">{row.personName}</p>
                    <p className="text-sm text-text-secondary">
                      {stationOrTitle}
                      {row.station ? ` · ${row.shiftTitle}` : ""}
                    </p>
                    <p className="font-mono text-sm tabular-nums text-text-secondary">
                      {formatShiftRange(row.startsAt, row.endsAt, eventTimezone)}
                    </p>
                    <p className="text-xs text-text-secondary">Proposed by {row.proposedBy}</p>
                    {row.warnings.length > 0 ? (
                      <div className="flex flex-col">
                        {row.warnings.map((warning, index) => (
                          <p key={`${row.assignmentId}-warning-${index}`} className="text-xs text-accent-warn">
                            {warning.message}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                {canApprove ? (
                  isApprovedSweep ? (
                    <StatusPill state="approved" />
                  ) : (
                    <PillButton
                      variant="ghost"
                      size="sm"
                      disabled={isDeclining && decliningId === row.assignmentId}
                      onClick={() => handleDecline(row.assignmentId)}
                    >
                      {isDeclining && decliningId === row.assignmentId ? "Declining..." : "Decline"}
                    </PillButton>
                  )
                ) : null}
              </motion.li>
            );
          })}
        </ul>
      </AnimatePresence>
    </div>
  );
}
