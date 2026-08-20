"use client";

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef, memo } from "react";
import { cellKey, generateGridRows, minuteToLocalTime, type GridSpec } from "@/lib/availability/grid";
import { MatrixDot, type MatrixDotState } from "@/components/ui/matrix-dot";
import { PillButton } from "@/components/ui/neu-button";

export type AvailabilityGridHandle = {
  /** Renders an AI-drafted selection at half fill until the member confirms (mergeSelection) or clears it. */
  paintDraft: (cells: string[]) => void;
  clearDraft: () => void;
};

type PaintMode = "select" | "erase";

type AvailabilityGridProps = {
  spec: GridSpec;
  value: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  draftCells?: ReadonlySet<string>;
  footer?: React.ReactNode;
  disabled?: boolean;
  formatRowLabel?: (minute: number) => string;
};

function defaultRowLabel(minute: number): string {
  const [hourStr, minuteStr] = minuteToLocalTime(minute).split(":");
  const hour = Number(hourStr);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return minuteStr === "00" ? `${displayHour} ${period}` : `${displayHour}:${minuteStr} ${period}`;
}

/** Compact tick label for the horizontal time axis, e.g. "12a", "2p". Only shown every 2 hours
 * (see shouldLabelColumn) so a full day's worth of half-hour columns stays readable without
 * crowding or rotated text. */
function defaultColumnLabel(minute: number): string {
  const hour = Math.floor(minute / 60) % 24;
  const period = hour >= 12 ? "p" : "a";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}${period}`;
}

function shouldLabelColumn(minute: number): boolean {
  return minute % 120 === 0;
}

const TIME_COLUMN_WIDTH = 28;
const DAY_LABEL_WIDTH = 72;

export const AvailabilityGrid = forwardRef<AvailabilityGridHandle, AvailabilityGridProps>(function AvailabilityGrid(
  { spec, value, onChange, draftCells, footer, disabled, formatRowLabel = defaultRowLabel },
  handleRef,
) {
  const rows = useMemo(() => generateGridRows(spec), [spec]);
  const firstCellKey = useMemo(
    () => (spec.days[0] && rows[0] !== undefined ? cellKey({ dayId: spec.days[0].id, minute: rows[0] }) : null),
    [spec.days, rows],
  );
  const [eraseMode, setEraseMode] = useState(false);
  const [localDraft, setLocalDraft] = useState<ReadonlySet<string> | null>(null);
  const [focusedKey, setFocusedKey] = useState<string | null>(firstCellKey);
  const dragState = useRef<{ mode: PaintMode; touched: Set<string> } | null>(null);
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const anchorRef = useRef<string | null>(null);

  const effectiveDraft = draftCells ?? localDraft;

  /**
   * One latest-value box so every handler below can have an empty (or spec-only) dependency array.
   *
   * This is the whole point of the memoization work in this file. `value` is a brand-new Set on
   * every paint step, so when the handlers depended on it directly, one `pointerenter` during a
   * drag rebuilt every callback, which changed every cell's props, which re-rendered all ~336
   * cells and detached/reattached all 336 refs. Reading through this box keeps the callbacks
   * stable, which lets the memoized GridCell below skip every cell whose own state did not change.
   *
   * Synced in an effect rather than during render, per this repo's react-hooks/refs rule. A passive
   * effect is sufficient here even though pointer events are continuous: `commitCell` advances
   * `latest.current.value` itself the moment it commits, so a burst of pointer events inside one
   * frame never reads a stale set. The effect only needs to catch changes that come from outside
   * this component (an AI draft merge, a reset), and those never race a drag.
   */
  const latest = useRef({ value, onChange, eraseMode, disabled });
  useEffect(() => {
    latest.current = { value, onChange, eraseMode, disabled };
  }, [value, onChange, eraseMode, disabled]);

  const registerCellRef = useCallback((key: string, node: HTMLButtonElement | null) => {
    if (node) {
      cellRefs.current.set(key, node);
    } else {
      cellRefs.current.delete(key);
    }
  }, []);

  useImperativeHandle(
    handleRef,
    () => ({
      paintDraft: (cells: string[]) => setLocalDraft(new Set(cells)),
      clearDraft: () => setLocalDraft(null),
    }),
    [],
  );

  /**
   * `latest.current.value` is advanced eagerly here as well as synced from the prop above, so a burst of
   * `pointerenter` events that lands between two React renders still accumulates. The previous
   * version rebuilt from the `value` captured at the last render, so a fast drag across several
   * cells within one frame could drop the earlier ones. In the ordinary one-commit-per-render case
   * the two are identical; this only differs in a race the old code got wrong.
   */
  const commitCell = useCallback((key: string, mode: PaintMode) => {
    const next = new Set(latest.current.value);
    if (mode === "select") {
      next.add(key);
    } else {
      next.delete(key);
    }
    latest.current.value = next;
    latest.current.onChange(next);
  }, []);

  const commitRange = useCallback((keys: string[], mode: PaintMode) => {
    const next = new Set(latest.current.value);
    for (const key of keys) {
      if (mode === "select") {
        next.add(key);
      } else {
        next.delete(key);
      }
    }
    latest.current.value = next;
    latest.current.onChange(next);
  }, []);

  const handlePointerDown = useCallback(
    (key: string, event: React.PointerEvent<HTMLButtonElement>) => {
      if (latest.current.disabled) return;
      const isCurrentlySelected = latest.current.value.has(key);
      const mode: PaintMode = latest.current.eraseMode || isCurrentlySelected ? "erase" : "select";
      dragState.current = { mode, touched: new Set([key]) };
      anchorRef.current = key;
      setFocusedKey(key);
      commitCell(key, mode);
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.style.touchAction = "none";
    },
    [commitCell],
  );

  const handlePointerEnter = useCallback(
    (key: string) => {
      const drag = dragState.current;
      if (!drag || drag.touched.has(key)) return;
      drag.touched.add(key);
      commitCell(key, drag.mode);
    },
    [commitCell],
  );

  const handlePointerUp = useCallback(() => {
    dragState.current = null;
  }, []);

  const moveFocus = useCallback(
    (dayIndex: number, rowIndex: number) => {
      const day = spec.days[dayIndex];
      const minute = rows[rowIndex];
      if (!day || minute === undefined) return;
      const key = cellKey({ dayId: day.id, minute });
      setFocusedKey(key);
      cellRefs.current.get(key)?.focus();
    },
    [spec.days, rows],
  );

  const handleKeyDown = useCallback(
    (dayIndex: number, rowIndex: number, key: string, event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (latest.current.disabled) return;

      // Axes match the horizontal-time layout below: left/right step through the day's time
      // columns, up/down step between day rows (flipped from the old vertical-time layout).
      if (event.key === "ArrowRight") {
        event.preventDefault();
        moveFocus(dayIndex, Math.min(rowIndex + 1, rows.length - 1));
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveFocus(dayIndex, Math.max(rowIndex - 1, 0));
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveFocus(Math.min(dayIndex + 1, spec.days.length - 1), rowIndex);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveFocus(Math.max(dayIndex - 1, 0), rowIndex);
        return;
      }

      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();

        if (event.shiftKey && anchorRef.current) {
          const anchor = anchorRef.current;
          const anchorDayIndex = spec.days.findIndex((day) => key.startsWith(`${day.id}:`) && anchor.startsWith(`${day.id}:`));
          if (anchorDayIndex === dayIndex) {
            const anchorMinute = Number(anchor.slice(anchor.lastIndexOf(":") + 1));
            const anchorRowIndex = rows.indexOf(anchorMinute);
            const [from, to] = anchorRowIndex <= rowIndex ? [anchorRowIndex, rowIndex] : [rowIndex, anchorRowIndex];
            const day = spec.days[dayIndex];
            const rangeKeys = rows.slice(from, to + 1).map((minute) => cellKey({ dayId: day.id, minute }));
            const mode: PaintMode = latest.current.eraseMode ? "erase" : "select";
            commitRange(rangeKeys, mode);
            return;
          }
        }

        anchorRef.current = key;
        const mode: PaintMode = latest.current.eraseMode || latest.current.value.has(key) ? "erase" : "select";
        commitCell(key, mode);
      }
    },
    [moveFocus, rows, spec.days, commitCell, commitRange],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
          Drag to paint. Arrows and space work too.
        </p>
        <PillButton
          aria-pressed={eraseMode}
          onClick={() => setEraseMode((current) => !current)}
          size="sm"
          variant={eraseMode ? "primary" : "default"}
        >
          {eraseMode ? "Erasing" : "Eraser"}
        </PillButton>
      </div>

      <div
        className="overflow-x-auto rounded-card bg-card p-3"
        onPointerUp={handlePointerUp}
        style={{ touchAction: "none" }}
      >
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: `${DAY_LABEL_WIDTH}px repeat(${rows.length}, ${TIME_COLUMN_WIDTH}px)`,
          }}
        >
          <div />
          {rows.map((minute) => (
            <div
              className="flex items-end justify-center pb-1 font-mono text-[10px] text-text-secondary"
              key={minute}
            >
              {shouldLabelColumn(minute) ? defaultColumnLabel(minute) : null}
            </div>
          ))}

          {spec.days.map((day, dayIndex) => (
            <FragmentDayRow
              day={day}
              dayIndex={dayIndex}
              disabled={disabled}
              draftCells={effectiveDraft}
              focusedKey={focusedKey}
              formatRowLabel={formatRowLabel}
              handleKeyDown={handleKeyDown}
              handlePointerDown={handlePointerDown}
              handlePointerEnter={handlePointerEnter}
              key={day.id}
              registerCellRef={registerCellRef}
              rows={rows}
              value={value}
            />
          ))}
        </div>
      </div>

      {footer ? <div className="font-mono text-xs text-text-secondary">{footer}</div> : null}
    </div>
  );
});

type GridCellProps = {
  cellId: string;
  dayIndex: number;
  rowIndex: number;
  label: string;
  state: MatrixDotState;
  focused: boolean;
  interactive: boolean;
  registerCellRef: (key: string, node: HTMLButtonElement | null) => void;
  onPointerDownCell: (key: string, event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerEnterCell: (key: string) => void;
  onKeyDownCell: (
    dayIndex: number,
    rowIndex: number,
    key: string,
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => void;
};

/**
 * One painted cell, memoized. Every prop is a primitive or one of the parent's now-stable
 * callbacks, so a cell only re-renders when its own `state` or `focused` actually flips. Painting
 * across a grid used to re-render all ~336 cells per pointer step (plus ~1000 fresh closures and
 * 336 ref detach/reattach cycles); it now re-renders exactly the cells that changed.
 *
 * The per-cell handler identities live here rather than in the parent on purpose: bound inside a
 * memoized child they are created once per cell and stay stable, whereas the parent's previous
 * curried factories (`handlePointerDown(key)`) allocated a fresh function per cell per render.
 *
 * Visuals are untouched: same MatrixDot, same className, same size, same roving `tabIndex`, same
 * aria-label. The paint pop is MatrixDot's own CSS transition keyed on `state`, which still
 * changes exactly when it did before.
 */
const GridCell = memo(function GridCell({
  cellId,
  dayIndex,
  rowIndex,
  label,
  state,
  focused,
  interactive,
  registerCellRef,
  onPointerDownCell,
  onPointerEnterCell,
  onKeyDownCell,
}: GridCellProps) {
  const setRef = useCallback(
    (node: HTMLButtonElement | null) => registerCellRef(cellId, node),
    [registerCellRef, cellId],
  );
  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => onPointerDownCell(cellId, event),
    [onPointerDownCell, cellId],
  );
  const handlePointerEnter = useCallback(
    () => onPointerEnterCell(cellId),
    [onPointerEnterCell, cellId],
  );
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => onKeyDownCell(dayIndex, rowIndex, cellId, event),
    [onKeyDownCell, dayIndex, rowIndex, cellId],
  );

  return (
    <MatrixDot
      aria-label={label}
      className="h-8 w-full"
      interactive={interactive}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerEnter={handlePointerEnter}
      ref={setRef}
      size="sm"
      state={state}
      tabIndex={focused ? 0 : -1}
    />
  );
});

type FragmentDayRowProps = {
  day: GridSpec["days"][number];
  dayIndex: number;
  rows: number[];
  formatRowLabel: (minute: number) => string;
  value: ReadonlySet<string>;
  draftCells: ReadonlySet<string> | null;
  disabled?: boolean;
  focusedKey: string | null;
  registerCellRef: (key: string, node: HTMLButtonElement | null) => void;
  handlePointerDown: (key: string, event: React.PointerEvent<HTMLButtonElement>) => void;
  handlePointerEnter: (key: string) => void;
  handleKeyDown: (
    dayIndex: number,
    rowIndex: number,
    key: string,
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => void;
};

function FragmentDayRow({
  day,
  dayIndex,
  rows,
  formatRowLabel,
  value,
  draftCells,
  disabled,
  focusedKey,
  registerCellRef,
  handlePointerDown,
  handlePointerEnter,
  handleKeyDown,
}: FragmentDayRowProps) {
  return (
    <>
      <div className="flex items-center justify-end pr-2 text-xs font-semibold text-text-secondary">{day.label}</div>
      {rows.map((minute, rowIndex) => {
        const key = cellKey({ dayId: day.id, minute });
        const isSelected = value.has(key);
        const isDraft = !isSelected && Boolean(draftCells?.has(key));
        const state: MatrixDotState = isSelected ? "painted" : isDraft ? "draft" : "idle";
        const rowLabel = formatRowLabel(minute);

        return (
          <GridCell
            cellId={key}
            dayIndex={dayIndex}
            focused={key === focusedKey}
            interactive={!disabled}
            key={key}
            label={`${day.label} ${rowLabel}`}
            onKeyDownCell={handleKeyDown}
            onPointerDownCell={handlePointerDown}
            onPointerEnterCell={handlePointerEnter}
            registerCellRef={registerCellRef}
            rowIndex={rowIndex}
            state={state}
          />
        );
      })}
    </>
  );
}
