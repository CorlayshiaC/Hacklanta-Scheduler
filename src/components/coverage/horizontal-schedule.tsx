"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Card } from "@/components/ui/neu-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ShiftCapsule } from "@/components/ui/shift-capsule";
import { ScheduleCapsule } from "@/components/coverage/schedule-capsule";
import { TimelineTrack, timeToX } from "@/components/coverage/timeline-track";
import { cn } from "@/lib/utils/cn";
import { assignMember, reassignAssignment, retimeShift, unassignMember } from "@/lib/scheduling/actions";
import { drawInDelay, SPRING_TRANSITION, useDrawIn } from "@/lib/utils/motion";
import type { ShiftCell } from "@/lib/scheduling/types";
import type { PersonScheduleRow } from "@/lib/scheduling/data";

/**
 * The flagship V2 rework: the per-event schedule as a people-Gantt. Members are rows (sticky
 * left, avatar + name), time flows horizontally, each assignment is a ScheduleCapsule on its
 * person's row colored by StatusPill semantics. Open slots pool in a top "Unassigned" row as
 * hollow/partial ShiftCapsules. Drag a capsule vertically onto a different row to reassign (or
 * onto Unassigned to drop it), drag horizontally on its own row to retime (15m snap). Every
 * write re-enters approval per the V2 shared decision, this view never writes "approved" itself.
 */

const PX_PER_HOUR = 100;
const PX_PER_MS = PX_PER_HOUR / 3_600_000;
const ROW_HEIGHT = 44;
const ROW_PAD_TOP = 8;
const CAPSULE_MIN_WIDTH = 64;
const RETIME_DEADZONE_MS = 5 * 60 * 1000;
const FIFTEEN_MIN_MS = 15 * 60 * 1000;
const UNASSIGNED_ROW_ID = "unassigned";

type DragData =
  | { kind: "assignment"; assignmentId: string; shiftId: string; profileId: string; startsAt: string; endsAt: string }
  | { kind: "shift"; shiftId: string; startsAt: string; endsAt: string };

function RowDropZone({ id, top, width }: { id: string; top: number; width: number }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      className={cn("absolute rounded-lg transition-colors duration-fast ease-neu-out", isOver && "bg-accent-go/5")}
      ref={setNodeRef}
      style={{ top, left: 0, width, height: ROW_HEIGHT }}
    />
  );
}

/**
 * The outer motion.div owns position (left/top/width) and the drawIn entrance sweep, so a row
 * reassignment or retime settles into its new position via the shared spring (`layout`) without
 * fighting dnd-kit's own live-drag transform, which stays on the plain inner div exactly as
 * before. `drawInIndex` orders the initial left-to-right sweep across the whole board (unassigned
 * pool first, then each person's row), computed once by the caller from start time.
 */
function DraggableCapsule({
  dragId,
  data,
  trackStart,
  top,
  drawInIndex,
  children,
}: {
  dragId: string;
  data: DragData;
  trackStart: Date;
  top: number;
  drawInIndex: number;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: dragId, data });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const drawIn = useDrawIn();
  const left = timeToX(data.startsAt, trackStart, PX_PER_MS);
  const width = Math.max(CAPSULE_MIN_WIDTH, timeToX(data.endsAt, trackStart, PX_PER_MS) - left);

  return (
    <motion.div
      animate="visible"
      className="absolute"
      initial="hidden"
      layout
      style={{ left, width, top, transformOrigin: "left" }}
      transition={{ ...drawIn.transition, delay: drawInDelay(drawInIndex), layout: SPRING_TRANSITION }}
      variants={drawIn.variants}
    >
      <div
        {...listeners}
        {...attributes}
        className={cn(
          "touch-none cursor-grab active:cursor-grabbing",
          isDragging && "-translate-y-0.5 shadow-glow",
        )}
        ref={setNodeRef}
        style={style}
      >
        {children}
      </div>
    </motion.div>
  );
}

export function HorizontalSchedule({
  eventTimezone,
  people,
  unassigned,
  windowStart,
  windowEnd,
}: {
  eventTimezone: string;
  people: PersonScheduleRow[];
  unassigned: ShiftCell[];
  windowStart: string | null;
  windowEnd: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // windowStart/windowEnd null falls through to the empty-state return below; these two memos
  // still run (hooks can't be conditional) but their result is discarded in that case, so the
  // fallback just needs to be a fixed, pure value, never the actual current time.
  const trackStart = useMemo(() => {
    const date = new Date(windowStart ?? 0);
    date.setMinutes(0, 0, 0);
    return date;
  }, [windowStart]);

  const trackEnd = useMemo(() => {
    const date = new Date(windowEnd ?? 0);
    if (date.getMinutes() > 0 || date.getSeconds() > 0) {
      date.setHours(date.getHours() + 1, 0, 0, 0);
    }
    return date;
  }, [windowEnd]);

  const rowIds = useMemo(() => [UNASSIGNED_ROW_ID, ...people.map((person) => person.profileId)], [people]);
  const totalWidth = Math.max(1, (trackEnd.getTime() - trackStart.getTime()) * PX_PER_MS);

  // Left-to-right drawIn order across the whole board, by start time, so the initial sweep reads
  // as one continuous motion rather than row-by-row.
  const drawInIndexByDragId = useMemo(() => {
    const items = [
      ...unassigned.map((cell) => ({ dragId: `shift:${cell.shiftId}`, startsAt: cell.startsAt })),
      ...people.flatMap((person) =>
        person.assignments.map((assignment) => ({ dragId: `assignment:${assignment.assignmentId}`, startsAt: assignment.startsAt })),
      ),
    ].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return new Map(items.map((item, index) => [item.dragId, index]));
  }, [unassigned, people]);

  async function handleDragEnd(event: DragEndEvent) {
    const data = event.active.data.current as DragData | undefined;
    const overId = event.over?.id;

    if (!data || typeof overId !== "string") {
      return;
    }

    setError(null);
    const originalRowId = data.kind === "assignment" ? data.profileId : UNASSIGNED_ROW_ID;

    if (overId !== originalRowId) {
      const result =
        data.kind === "assignment"
          ? overId === UNASSIGNED_ROW_ID
            ? await unassignMember({ assignmentId: data.assignmentId })
            : await reassignAssignment({ assignmentId: data.assignmentId, profileId: overId })
          : overId === UNASSIGNED_ROW_ID
            ? null
            : await assignMember({ shiftId: data.shiftId, profileId: overId });

      if (result && !result.ok) {
        setError(result.message);
        return;
      }
      if (result) {
        router.refresh();
      }
      return;
    }

    const deltaMs = event.delta.x / PX_PER_MS;
    if (Math.abs(deltaMs) < RETIME_DEADZONE_MS) {
      return;
    }
    const snappedMs = Math.round(deltaMs / FIFTEEN_MIN_MS) * FIFTEEN_MIN_MS;
    if (snappedMs === 0) {
      return;
    }

    const result = await retimeShift({
      shiftId: data.shiftId,
      startsAt: new Date(new Date(data.startsAt).getTime() + snappedMs).toISOString(),
      endsAt: new Date(new Date(data.endsAt).getTime() + snappedMs).toISOString(),
    });

    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  }

  if (!windowStart || !windowEnd) {
    return (
      <Card className="text-center">
        <p className="text-sm text-text-secondary">No shifts yet. Generate them from the event page.</p>
      </Card>
    );
  }

  return (
    <DndContext onDragEnd={handleDragEnd} sensors={sensors}>
      <Card padded={false}>
        <div className="flex">
          <div className="flex w-44 shrink-0 flex-col border-r border-hairline">
            <div className="h-6 shrink-0" />
            <div className="flex shrink-0 items-center px-3 text-xs font-semibold uppercase tracking-wide text-accent-warn" style={{ height: ROW_HEIGHT }}>
              Unassigned
            </div>
            {people.map((person) => (
              <div className="flex shrink-0 items-center gap-2 px-3" key={person.profileId} style={{ height: ROW_HEIGHT }}>
                <Avatar size="sm">
                  <AvatarFallback size="sm">
                    {person.fullName
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((part) => part.charAt(0).toUpperCase())
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-sm text-text-primary">{person.fullName}</span>
              </div>
            ))}
            {people.length === 0 ? <p className="px-3 py-2 text-xs text-text-secondary">No active members yet.</p> : null}
          </div>

          <div className="min-w-0 flex-1 overflow-x-auto">
            <TimelineTrack
              axisUnit="hour"
              contentHeight={rowIds.length * ROW_HEIGHT}
              end={trackEnd}
              pxPerMs={PX_PER_MS}
              start={trackStart}
              timeZone={eventTimezone}
            >
              {rowIds.map((rowId, index) => (
                <RowDropZone id={rowId} key={rowId} top={index * ROW_HEIGHT} width={totalWidth} />
              ))}

              {unassigned.map((cell) => (
                <DraggableCapsule
                  data={{ kind: "shift", shiftId: cell.shiftId, startsAt: cell.startsAt, endsAt: cell.endsAt }}
                  dragId={`shift:${cell.shiftId}`}
                  drawInIndex={drawInIndexByDragId.get(`shift:${cell.shiftId}`) ?? 0}
                  key={cell.shiftId}
                  top={ROW_PAD_TOP}
                  trackStart={trackStart}
                >
                  <ShiftCapsule
                    aria-label={`${cell.station?.name ?? cell.title}, ${cell.headcountAssigned} of ${cell.headcountRequired} filled`}
                    className="w-full"
                    filled={cell.headcountAssigned}
                    label={cell.station?.name ?? cell.title}
                    needed={cell.headcountRequired}
                    size="sm"
                    state={cell.status === "empty" ? "empty" : "partial"}
                    urgentPulse={cell.understaffedUrgent}
                  />
                </DraggableCapsule>
              ))}

              {people.map((person, rowIndex) =>
                person.assignments.map((assignment) => (
                  <DraggableCapsule
                    data={{
                      kind: "assignment",
                      assignmentId: assignment.assignmentId,
                      shiftId: assignment.shiftId,
                      profileId: person.profileId,
                      startsAt: assignment.startsAt,
                      endsAt: assignment.endsAt,
                    }}
                    dragId={`assignment:${assignment.assignmentId}`}
                    drawInIndex={drawInIndexByDragId.get(`assignment:${assignment.assignmentId}`) ?? 0}
                    key={assignment.assignmentId}
                    top={(rowIndex + 1) * ROW_HEIGHT + ROW_PAD_TOP}
                    trackStart={trackStart}
                  >
                    <ScheduleCapsule
                      approvalState={assignment.approvalState}
                      aria-label={`${assignment.station?.name ?? assignment.title}, ${assignment.approvalState.replace("_", " ")}`}
                      className="w-full"
                      label={assignment.station?.name ?? assignment.title}
                      size="sm"
                    />
                  </DraggableCapsule>
                )),
              )}
            </TimelineTrack>
          </div>
        </div>
      </Card>

      {error ? (
        <p className="mt-2 text-sm text-accent-warn" role="alert">
          {error}
        </p>
      ) : null}
    </DndContext>
  );
}

// Re-exported for the axis-position math the view switcher's other views may want to share.
export { timeToX };
