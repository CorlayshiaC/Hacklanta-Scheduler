"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildRecurringGridSpec,
  cellsToWindows,
  recurringRowsToWindows,
  recurringWindowsToRows,
  windowsToCells,
  type RecurringWindowRow,
} from "@/lib/availability/grid";
import { syncRecurringAvailabilityAction } from "@/lib/availability/recurring-actions";
import { AvailabilityGrid } from "@/components/availability/availability-grid";
import { Card } from "@/components/ui/neu-card";

type RecurringAvailabilityManagerProps = {
  initialWindows: RecurringWindowRow[];
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

const SAVE_DEBOUNCE_MS = 900;

export function RecurringAvailabilityManager({ initialWindows }: RecurringAvailabilityManagerProps) {
  const spec = useMemo(() => buildRecurringGridSpec(30), []);
  const initialCells = useMemo(() => windowsToCells(recurringRowsToWindows(initialWindows), spec), [initialWindows, spec]);
  const [selected, setSelected] = useState<Set<string>>(initialCells);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (savedTickTimer.current) clearTimeout(savedTickTimer.current);
    },
    [],
  );

  const persist = useCallback(
    (cells: Set<string>) => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }

      saveTimer.current = setTimeout(async () => {
        setStatus("saving");
        const minuteWindows = cellsToWindows(cells, spec);
        const rows = recurringWindowsToRows(minuteWindows);
        const result = await syncRecurringAvailabilityAction(rows);

        if (result.ok) {
          setStatus("saved");
          setErrorMessage(null);
          if (savedTickTimer.current) clearTimeout(savedTickTimer.current);
          savedTickTimer.current = setTimeout(() => setStatus("idle"), 1800);
        } else {
          setStatus("error");
          setErrorMessage(result.message);
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [spec],
  );

  const handleChange = useCallback(
    (next: Set<string>) => {
      setSelected(next);
      persist(next);
    },
    [persist],
  );

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-go">Recurring availability</p>
        <h1 className="mt-2 text-3xl font-semibold text-text-primary">When you are generally free.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
          Paint the times you are usually available in a normal week. Organizers use this to suggest shifts and
          find meeting times.
        </p>
      </Card>

      <Card padded={false} className="flex items-center p-4">
        <SaveIndicator errorMessage={errorMessage} status={status} />
      </Card>

      <AvailabilityGrid onChange={handleChange} spec={spec} value={selected} />
    </div>
  );
}

function SaveIndicator({ status, errorMessage }: { status: SaveStatus; errorMessage: string | null }) {
  if (status === "saving") {
    return <p className="text-sm text-text-secondary">Saving...</p>;
  }

  if (status === "saved") {
    return <p className="text-sm text-accent-go">✓ Saved</p>;
  }

  if (status === "error") {
    return <p className="text-sm text-accent-warn">{errorMessage ?? "Unable to save."}</p>;
  }

  return <p className="text-sm text-text-secondary">Changes save automatically.</p>;
}
