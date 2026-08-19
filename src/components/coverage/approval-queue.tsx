"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NeuCheckbox } from "@/components/ui/neu-checkbox";
import { PillButton } from "@/components/ui/neu-button";
import { approveAssignments, declineAssignment } from "@/lib/scheduling/actions";
import type { ApprovalQueueRow } from "@/lib/scheduling/data";
import { formatShiftRange } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

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
  const [isApproving, startApproveTransition] = useTransition();
  const [isDeclining, startDeclineTransition] = useTransition();

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
    startApproveTransition(async () => {
      const result = await approveAssignments({ assignmentIds: Array.from(selected) });
      if (result.ok) {
        setSelected(new Set());
        router.refresh();
      } else {
        setErrorMessage(result.message);
      }
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
      {canApprove ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-3">
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
        </div>
      ) : null}

      {errorMessage ? (
        <p role="alert" className="text-sm text-accent-warn">
          {errorMessage}
        </p>
      ) : null}

      <ul className="flex flex-col divide-y divide-hairline">
        {rows.map((row) => {
          const stationOrTitle = row.station?.name ?? row.shiftTitle;
          const isChecked = selected.has(row.assignmentId);

          return (
            <li key={row.assignmentId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
              <div className={cn("flex flex-1 gap-3", canApprove && "items-start")}>
                {canApprove ? (
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
                <PillButton
                  variant="ghost"
                  size="sm"
                  disabled={isDeclining && decliningId === row.assignmentId}
                  onClick={() => handleDecline(row.assignmentId)}
                >
                  {isDeclining && decliningId === row.assignmentId ? "Declining..." : "Decline"}
                </PillButton>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
