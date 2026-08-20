"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Card } from "@/components/ui/neu-card";
import { PillButton } from "@/components/ui/neu-button";
import { NeuSelect } from "@/components/ui/neu-select";
import { NeuTextarea } from "@/components/ui/neu-textarea";
import { ShiftCapsule, type ShiftCapsuleState } from "@/components/ui/shift-capsule";
import { StatBlock } from "@/components/ui/stat-block";
import { FilterPill } from "@/components/ui/filter-pill";
import { cn } from "@/lib/utils/cn";
import { formatShiftTime, getShiftDurationMinutes } from "@/lib/utils/format";
import { assignMember, unassignMember, updateShiftNotes } from "@/lib/scheduling/actions";
import {
  drawInDelay,
  MORPH_TEXT_INCOMING,
  MORPH_TEXT_OUTGOING,
  MORPH_TRANSITION,
  SPRING_STANDARD,
  useDrawIn,
} from "@/lib/utils/motion";
import type { ShiftCell } from "@/lib/scheduling/types";
import type { RosterMember } from "@/lib/scheduling/data";

/** motion-spec.md section 4: "capped at the first 24 bars." */
const DRAW_IN_CAP = 24;

const CAPSULE_STATE: Record<ShiftCell["status"], ShiftCapsuleState> = {
  empty: "empty",
  partial: "partial",
  full: "full",
};

function dayKey(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).format(
    new Date(iso),
  );
}

function dayLabel(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone }).format(
    new Date(iso),
  );
}

function AssignPanel({
  cell,
  roster,
  timeZone,
}: {
  cell: ShiftCell;
  roster: RosterMember[];
  timeZone: string;
}) {
  const router = useRouter();
  const assignedIds = useMemo(() => new Set(cell.assignees.map((assignee) => assignee.profileId)), [cell.assignees]);
  const candidates = roster.filter((member) => !assignedIds.has(member.profileId));
  const [selectedProfileId, setSelectedProfileId] = useState(candidates[0]?.profileId ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [notesValue, setNotesValue] = useState(cell.notes ?? "");
  const [notesMessage, setNotesMessage] = useState<string | null>(null);
  const [notesPending, setNotesPending] = useState(false);

  async function handleSaveNote() {
    setNotesPending(true);
    setNotesMessage(null);
    const result = await updateShiftNotes({ shiftId: cell.shiftId, notes: notesValue });
    setNotesPending(false);

    if (!result.ok) {
      setNotesMessage(result.message);
      return;
    }
    router.refresh();
  }

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
    <motion.div layoutId="assign-panel" transition={MORPH_TRANSITION}>
      <Card>
      {/* Content crossfades in over the morph's last 40% (motion-spec.md section 5), while the
          shared bounds spring from the placeholder card's shape to this one. */}
      <motion.div animate="visible" className="flex flex-col gap-3" initial="hidden" variants={MORPH_TEXT_INCOMING}>
      <div>
        <p className="text-sm font-semibold text-text-primary">{cell.station?.name ?? "General coverage"}</p>
        <p className="font-mono text-xs tabular-nums text-text-secondary">
          {formatShiftTime(cell.startsAt, timeZone)}–{formatShiftTime(cell.endsAt, timeZone)}
        </p>
        {cell.location ? <p className="text-xs text-text-secondary">{cell.location}</p> : null}
        {cell.notes ? <p className="mt-1 text-xs text-text-secondary">Note: {cell.notes}</p> : null}
      </div>

      {cell.assignees.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {cell.assignees.map((assignee) => (
            <li
              className="flex items-center gap-2 rounded-pill bg-elevated px-3 py-1 text-xs text-text-secondary"
              key={assignee.assignmentId}
            >
              {assignee.fullName}
              <button
                aria-label={`Unassign ${assignee.fullName}`}
                className="text-text-secondary hover:text-accent-warn"
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
          <PillButton disabled={isPending} onClick={handleAssign} variant="primary">
            Assign
          </PillButton>
        </div>
      ) : null}

      {cell.status !== "full" && candidates.length === 0 ? (
        <p className="text-xs text-text-secondary">No available members left to assign here.</p>
      ) : null}

      {message ? (
        <p className="text-xs text-accent-warn" role="status">
          {message}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 border-t border-hairline pt-3">
        <NeuTextarea
          onChange={(event) => setNotesValue(event.target.value)}
          placeholder="Note for other directors"
          rows={2}
          value={notesValue}
        />
        {notesMessage ? (
          <p className="text-xs text-accent-warn" role="status">
            {notesMessage}
          </p>
        ) : null}
        <div className="flex justify-end">
          <PillButton disabled={notesPending} onClick={handleSaveNote} size="sm" variant="default">
            Save note
          </PillButton>
        </div>
      </div>
      </motion.div>
      </Card>
    </motion.div>
  );
}

function RosterChip({ member }: { member: RosterMember }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: member.profileId });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "flex cursor-grab touch-none items-center justify-between gap-2 rounded-pill bg-elevated px-3 py-2 text-sm outline-none",
        "focus-visible:shadow-focus-ring active:cursor-grabbing",
        isDragging && "opacity-50",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", member.overMax ? "bg-accent-warn" : "bg-accent-go")}
        />
        <span className="truncate text-text-primary">{member.fullName}</span>
      </span>
      <span className={cn("shrink-0 font-mono text-xs tabular-nums", member.overMax ? "text-accent-warn" : "text-text-secondary")}>
        {member.assignedHours}h{member.maxHours !== null ? `/${member.maxHours}h` : ""}
      </span>
    </div>
  );
}

function DroppableShiftCapsule({
  cell,
  selected,
  timeZone,
  drawInIndex,
  onSelect,
}: {
  cell: ShiftCell;
  selected: boolean;
  timeZone: string;
  drawInIndex: number;
  onSelect: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: cell.shiftId });
  const canAcceptDrop = cell.status !== "full";
  const drawIn = useDrawIn();

  return (
    <motion.div
      animate="visible"
      className="flex w-24 shrink-0 flex-col items-center gap-1"
      initial="hidden"
      style={{ transformOrigin: "left" }}
      transition={{ ...drawIn.transition, delay: drawInDelay(Math.min(drawInIndex, DRAW_IN_CAP)) }}
      variants={drawIn.variants}
    >
      <ShiftCapsule
        ref={setNodeRef}
        aria-label={`${cell.station?.name ?? "General coverage"}, ${formatShiftTime(cell.startsAt, timeZone)} to ${formatShiftTime(cell.endsAt, timeZone)}, ${cell.headcountAssigned} of ${cell.headcountRequired} filled`}
        className={cn("w-fit", isOver && canAcceptDrop && "shadow-focus-ring")}
        filled={cell.headcountAssigned}
        interactive
        label={selected ? `${cell.headcountAssigned}/${cell.headcountRequired}` : undefined}
        members={cell.assignees.map((assignee) => ({ id: assignee.profileId, name: assignee.fullName }))}
        needed={cell.headcountRequired}
        onClick={onSelect}
        size="lg"
        state={selected ? "selected" : CAPSULE_STATE[cell.status]}
        urgentPulse={cell.understaffedUrgent}
      />
      <p className="text-center font-mono text-[10px] tabular-nums text-text-secondary">{formatShiftTime(cell.startsAt, timeZone)}</p>
    </motion.div>
  );
}

export function CoverageBoard({
  eventName,
  eventTimezone,
  cells,
  roster,
  summary,
}: {
  eventName: string;
  eventTimezone: string;
  cells: ShiftCell[];
  roster: RosterMember[];
  summary: { filled: number; required: number };
}) {
  const router = useRouter();
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [dayFilter, setDayFilter] = useState("all");
  const [stationFilter, setStationFilter] = useState("all");
  const [assignError, setAssignError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const dayOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const cell of cells) {
      const key = dayKey(cell.startsAt, eventTimezone);
      if (!seen.has(key)) {
        seen.set(key, dayLabel(cell.startsAt, eventTimezone));
      }
    }
    return Array.from(seen.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, label]) => ({ value, label }));
  }, [cells, eventTimezone]);

  const stationOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const cell of cells) {
      const key = cell.station?.id ?? "general";
      if (!seen.has(key)) {
        seen.set(key, cell.station?.name ?? "General coverage");
      }
    }
    return Array.from(seen.entries())
      .sort(([, a], [, b]) => a.localeCompare(b))
      .map(([value, label]) => ({ value, label }));
  }, [cells]);

  const filteredCells = useMemo(
    () =>
      cells.filter((cell) => {
        const matchesDay = dayFilter === "all" || dayKey(cell.startsAt, eventTimezone) === dayFilter;
        const matchesStation = stationFilter === "all" || (cell.station?.id ?? "general") === stationFilter;
        return matchesDay && matchesStation;
      }),
    [cells, dayFilter, stationFilter, eventTimezone],
  );

  const grouped = useMemo(() => {
    const byStation = new Map<string, { name: string; cells: ShiftCell[] }>();
    for (const cell of filteredCells) {
      const key = cell.station?.id ?? "general";
      const group = byStation.get(key) ?? { name: cell.station?.name ?? "General coverage", cells: [] };
      group.cells.push(cell);
      byStation.set(key, group);
    }
    for (const group of byStation.values()) {
      group.cells.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    }
    return Array.from(byStation.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredCells]);

  const fillPercent = summary.required > 0 ? Math.round((summary.filled / summary.required) * 100) : 100;
  const openGaps = cells.filter((cell) => cell.status !== "full").length;
  const hoursScheduled = useMemo(() => {
    const totalMinutes = cells.reduce((total, cell) => total + getShiftDurationMinutes(cell.startsAt, cell.endsAt), 0);
    return Math.round((totalMinutes / 60) * 10) / 10;
  }, [cells]);

  const selectedCell = cells.find((cell) => cell.shiftId === selectedShiftId) ?? null;

  // Left-to-right drawIn order across the whole board, by start time, independent of station
  // grouping, so the initial sweep reads as one continuous motion.
  const drawInIndexByShiftId = useMemo(() => {
    const ordered = [...filteredCells].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return new Map(ordered.map((cell, index) => [cell.shiftId, index]));
  }, [filteredCells]);

  async function handleDragEnd(event: DragEndEvent) {
    const shiftId = event.over?.id;
    const profileId = event.active.id;

    if (typeof shiftId !== "string" || typeof profileId !== "string") {
      return;
    }

    const cell = cells.find((candidate) => candidate.shiftId === shiftId);

    if (!cell || cell.status === "full" || cell.assignees.some((assignee) => assignee.profileId === profileId)) {
      return;
    }

    setAssignError(null);
    const result = await assignMember({ shiftId, profileId });

    if (!result.ok) {
      setAssignError(result.message);
      return;
    }

    router.refresh();
  }

  if (cells.length === 0) {
    return (
      <Card className="text-center">
        <p className="text-sm text-text-secondary">No shifts yet. Generate them from the event page.</p>
      </Card>
    );
  }

  return (
    <DndContext onDragEnd={handleDragEnd} sensors={sensors}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <FilterPill
            label="Day"
            onValueChange={setDayFilter}
            options={[{ value: "all", label: "All" }, ...dayOptions]}
            value={dayFilter}
          />
          <FilterPill
            label="Station"
            onValueChange={setStationFilter}
            options={[{ value: "all", label: "All" }, ...stationOptions]}
            value={stationFilter}
          />
        </div>

        <Card className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <StatBlock label="Slots filled" value={`${summary.filled}/${summary.required}`} />
          <StatBlock animated label="Fill rate" value={fillPercent} />
          <StatBlock animated label="Open gaps" value={openGaps} />
          <StatBlock animated label="Hours scheduled" value={hoursScheduled} />
        </Card>

        <Card title={eventName}>
          {/* TODO(agent-6): presence dots slot goes here once realtime lands. */}
          <div className="flex flex-col gap-6">
            {grouped.map((group) => (
              <section key={group.name}>
                <h3 className="sticky left-0 text-xs font-semibold uppercase tracking-wide text-text-secondary">{group.name}</h3>
                <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
                  {group.cells.map((cell) => (
                    <DroppableShiftCapsule
                      cell={cell}
                      drawInIndex={drawInIndexByShiftId.get(cell.shiftId) ?? 0}
                      key={cell.shiftId}
                      onSelect={() => setSelectedShiftId(cell.shiftId === selectedShiftId ? null : cell.shiftId)}
                      selected={cell.shiftId === selectedShiftId}
                      timeZone={eventTimezone}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Card>

        {assignError ? (
          <p className="text-sm text-accent-warn" role="alert">
            {assignError}
          </p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <AnimatePresence mode="wait">
            {selectedCell ? (
              // Keyed by shift id so switching the selected shift remounts the panel: every local
              // field (notes draft, member picker, pending/message state) resets cleanly instead of
              // carrying over from the previous shift, without needing a sync-on-prop-change effect.
              // AssignPanel itself carries the shared "assign-panel" layoutId, morphing against the
              // placeholder below (and against itself when switching shifts) via MORPH_TRANSITION.
              <AssignPanel cell={selectedCell} key={selectedCell.shiftId} roster={roster} timeZone={eventTimezone} />
            ) : (
              <motion.div key="assign-panel-placeholder" layoutId="assign-panel" transition={MORPH_TRANSITION}>
                <Card className="flex items-center">
                  <motion.span
                    animate="visible"
                    className="text-sm text-text-secondary"
                    exit="hidden"
                    initial="visible"
                    variants={MORPH_TEXT_OUTGOING}
                  >
                    Select a shift to assign or unassign a member, or drag a roster chip onto a capsule.
                  </motion.span>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
          <Card title="Roster">
            {roster.length === 0 ? (
              <p className="text-sm text-text-secondary">No active members yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                <AnimatePresence initial={false}>
                  {roster.map((member) => (
                    <motion.li exit={{ opacity: 0 }} key={member.profileId} layout transition={{ layout: SPRING_STANDARD }}>
                      <RosterChip member={member} />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </Card>
        </div>
      </div>
    </DndContext>
  );
}
