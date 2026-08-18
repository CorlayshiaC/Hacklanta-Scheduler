"use client";

import { useCallback, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
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

  const commitCell = useCallback(
    (key: string, mode: PaintMode) => {
      const next = new Set(value);
      if (mode === "select") {
        next.add(key);
      } else {
        next.delete(key);
      }
      onChange(next);
    },
    [value, onChange],
  );

  const commitRange = useCallback(
    (keys: string[], mode: PaintMode) => {
      const next = new Set(value);
      for (const key of keys) {
        if (mode === "select") {
          next.add(key);
        } else {
          next.delete(key);
        }
      }
      onChange(next);
    },
    [value, onChange],
  );

  const handlePointerDown = useCallback(
    (key: string) => (event: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled) return;
      const isCurrentlySelected = value.has(key);
      const mode: PaintMode = eraseMode || isCurrentlySelected ? "erase" : "select";
      dragState.current = { mode, touched: new Set([key]) };
      anchorRef.current = key;
      setFocusedKey(key);
      commitCell(key, mode);
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.style.touchAction = "none";
    },
    [disabled, eraseMode, value, commitCell],
  );

  const handlePointerEnter = useCallback(
    (key: string) => () => {
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
    (dayIndex: number, rowIndex: number, key: string) => (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveFocus(dayIndex, Math.min(rowIndex + 1, rows.length - 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveFocus(dayIndex, Math.max(rowIndex - 1, 0));
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        moveFocus(Math.min(dayIndex + 1, spec.days.length - 1), rowIndex);
        return;
      }
      if (event.key === "ArrowLeft") {
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
            const mode: PaintMode = eraseMode ? "erase" : "select";
            commitRange(rangeKeys, mode);
            return;
          }
        }

        anchorRef.current = key;
        const mode: PaintMode = eraseMode || value.has(key) ? "erase" : "select";
        commitCell(key, mode);
      }
    },
    [disabled, moveFocus, rows, spec.days, eraseMode, value, commitCell, commitRange],
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
            gridTemplateColumns: `72px repeat(${spec.days.length}, minmax(40px, 1fr))`,
          }}
        >
          <div />
          {spec.days.map((day) => (
            <div className="pb-1 text-center text-xs font-semibold text-text-secondary" key={day.id}>
              {day.label}
            </div>
          ))}

          {rows.map((minute, rowIndex) => (
            <FragmentRow
              disabled={disabled}
              draftCells={effectiveDraft}
              focusedKey={focusedKey}
              handleKeyDown={handleKeyDown}
              handlePointerDown={handlePointerDown}
              handlePointerEnter={handlePointerEnter}
              key={minute}
              minute={minute}
              rowIndex={rowIndex}
              registerCellRef={registerCellRef}
              rowLabel={formatRowLabel(minute)}
              spec={spec}
              value={value}
            />
          ))}
        </div>
      </div>

      {footer ? <div className="font-mono text-xs text-text-secondary">{footer}</div> : null}
    </div>
  );
});

type FragmentRowProps = {
  minute: number;
  rowIndex: number;
  rowLabel: string;
  spec: GridSpec;
  value: ReadonlySet<string>;
  draftCells: ReadonlySet<string> | null;
  disabled?: boolean;
  focusedKey: string | null;
  registerCellRef: (key: string, node: HTMLButtonElement | null) => void;
  handlePointerDown: (key: string) => (event: React.PointerEvent<HTMLButtonElement>) => void;
  handlePointerEnter: (key: string) => () => void;
  handleKeyDown: (
    dayIndex: number,
    rowIndex: number,
    key: string,
  ) => (event: React.KeyboardEvent<HTMLButtonElement>) => void;
};

function FragmentRow({
  minute,
  rowIndex,
  rowLabel,
  spec,
  value,
  draftCells,
  disabled,
  focusedKey,
  registerCellRef,
  handlePointerDown,
  handlePointerEnter,
  handleKeyDown,
}: FragmentRowProps) {
  return (
    <>
      <div className="flex items-center justify-end pr-2 font-mono text-[11px] text-text-secondary">{rowLabel}</div>
      {spec.days.map((day, dayIndex) => {
        const key = cellKey({ dayId: day.id, minute });
        const isSelected = value.has(key);
        const isDraft = !isSelected && Boolean(draftCells?.has(key));
        const state: MatrixDotState = isSelected ? "painted" : isDraft ? "draft" : "idle";

        return (
          <MatrixDot
            aria-label={`${day.label} ${rowLabel}`}
            className="h-8 w-full"
            interactive={!disabled}
            key={key}
            onKeyDown={handleKeyDown(dayIndex, rowIndex, key)}
            onPointerDown={handlePointerDown(key)}
            onPointerEnter={handlePointerEnter(key)}
            ref={(node) => registerCellRef(key, node)}
            size="sm"
            state={state}
            tabIndex={key === focusedKey ? 0 : -1}
          />
        );
      })}
    </>
  );
}
