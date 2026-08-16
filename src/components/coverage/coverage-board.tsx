"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GridCell, type GridCellState } from "@/components/ui/grid-cell";
import { NeuCard } from "@/components/ui/neu-card";
import { NeuButton } from "@/components/ui/neu-button";
import { NeuSelect } from "@/components/ui/neu-select";
import { assignMember, unassignMember } from "@/lib/scheduling/actions";
import type { ShiftCell } from "@/lib/scheduling/types";
import type { RosterMember } from "@/lib/scheduling/data";

// TODO(agent-1): cells are click-to-select, not drag-to-assign yet. Real drag assignment needs
// @dnd-kit (not installed, request filed in docs/contracts/requests.md), next unit of work.

const CELL_STATE: Record<ShiftCell["status"], GridCellState> = {
  empty: "empty",
  partial: "partial",
  full: "full",
};

function formatTimeRange(startsAt: string, endsAt: string) {
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
  const date = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
  return `${date.format(new Date(startsAt))} · ${time.format(new Date(startsAt))} to ${time.format(new Date(endsAt))}`;
}

function AssignPanel({ cell, roster }: { cell: ShiftCell; roster: RosterMember[] }) {
  const router = useRouter();
  const assignedIds = useMemo(() => new Set(cell.assignees.map((assignee) => assignee.profileId)), [cell.assignees]);
  const candidates = roster.filter((member) => !assignedIds.has(member.profileId));
  const [selectedProfileId, setSelectedProfileId] = useState(candidates[0]?.profileId ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleAssign() {
    if (!selectedProfileId) {
      return;
    }
    setIsPending(true);
    setMessage(null);
    const result = await assignMember({ shiftId: cell.shiftId, profileId: selectedProfileId });
    setIsPending(false);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    if (result.data.check.status === "warning") {
      setMessage(`Assigned with warnings: ${result.data.check.reasons.join(" ")}`);
    }
    router.refresh();
  }

  async function handleUnassign(assignmentId: string) {
    setIsPending(true);
    setMessage(null);
    const result = await unassignMember({ assignmentId });
    setIsPending(false);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    router.refresh();
  }

  return (
    <NeuCard className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-text-primary">{cell.station?.name ?? "General coverage"}</p>
        <p className="font-mono text-xs text-text-secondary">{formatTimeRange(cell.startsAt, cell.endsAt)}</p>
        {cell.location ? <p className="text-xs text-text-secondary">{cell.location}</p> : null}
      </div>

      {cell.assignees.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {cell.assignees.map((assignee) => (
            <li
              className="flex items-center gap-2 rounded-full border border-hairline bg-bg-surface px-3 py-1 text-xs text-text-secondary"
              key={assignee.assignmentId}
            >
              {assignee.fullName}
              <button
                aria-label={`Unassign ${assignee.fullName}`}
                className="text-text-secondary hover:text-danger"
                disabled={isPending}
                onClick={() => handleUnassign(assignee.assignmentId)}
                type="button"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {cell.status !== "full" && candidates.length > 0 ? (
        <div className="flex items-center gap-2">
          <NeuSelect
            className="flex-1"
            onValueChange={setSelectedProfileId}
            options={candidates.map((member) => ({
              value: member.profileId,
              label: `${member.fullName} (${member.assignedHours}h${member.overMax ? ", over max" : ""})`,
            }))}
            placeholder="Choose a member"
            value={selectedProfileId}
          />
          <NeuButton disabled={isPending} onClick={handleAssign} variant="default">
            Assign
          </NeuButton>
        </div>
      ) : null}

      {cell.status !== "full" && candidates.length === 0 ? (
        <p className="text-xs text-text-secondary">No available members left to assign here.</p>
      ) : null}

      {message ? (
        <p className="text-xs text-warning" role="status">
          {message}
        </p>
      ) : null}
    </NeuCard>
  );
}

export function CoverageBoard({ cells, roster }: { cells: ShiftCell[]; roster: RosterMember[] }) {
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const byStation = new Map<string, { name: string; cells: ShiftCell[] }>();

    for (const cell of cells) {
      const key = cell.station?.id ?? "general";
      const group = byStation.get(key) ?? { name: cell.station?.name ?? "General coverage", cells: [] };
      group.cells.push(cell);
      byStation.set(key, group);
    }

    for (const group of byStation.values()) {
      group.cells.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    }

    return Array.from(byStation.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [cells]);

  const selectedCell = cells.find((cell) => cell.shiftId === selectedShiftId) ?? null;

  if (cells.length === 0) {
    return (
      <NeuCard className="p-8 text-center">
        <p className="text-sm text-text-secondary">No shifts yet. Generate them from the event page.</p>
      </NeuCard>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {grouped.map((group) => (
        <section key={group.name}>
          <h3 className="sticky left-0 text-sm font-semibold uppercase tracking-wide text-text-secondary">
            {group.name}
          </h3>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {group.cells.map((cell) => (
              <div className="relative shrink-0" key={cell.shiftId}>
                <GridCell
                  aria-label={`${group.name}, ${formatTimeRange(cell.startsAt, cell.endsAt)}, ${cell.headcountAssigned} of ${cell.headcountRequired} filled`}
                  coverage={cell.headcountRequired > 0 ? cell.headcountAssigned / cell.headcountRequired : 0}
                  filled={cell.headcountAssigned}
                  interactive
                  needed={cell.headcountRequired}
                  onClick={() => setSelectedShiftId(cell.shiftId === selectedShiftId ? null : cell.shiftId)}
                  size="lg"
                  state={cell.shiftId === selectedShiftId ? "selected" : CELL_STATE[cell.status]}
                />
                {cell.understaffedUrgent ? (
                  <span
                    aria-hidden
                    className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-danger motion-reduce:animate-none"
                  />
                ) : null}
                <p className="mt-1 text-center font-mono text-[10px] text-text-secondary">
                  {new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(cell.startsAt))}
                </p>
              </div>
            ))}
          </div>
        </section>
      ))}

      {selectedCell ? <AssignPanel cell={selectedCell} roster={roster} /> : null}
    </div>
  );
}
