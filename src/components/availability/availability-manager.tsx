"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { syncEventAvailabilityAction } from "@/lib/availability/actions";
import { buildEventGridSpec, eventWindowsToNormalizedWindows, normalizedWindowsToEventWindows, windowsToCells, cellsToWindows } from "@/lib/availability/grid";
import { AvailabilityGrid } from "@/components/availability/availability-grid";
import { Card } from "@/components/ui/neu-card";
import { StatBlock } from "@/components/ui/stat-block";
import type { AvailabilityWindow, AvailabilityEventWindow } from "@/lib/availability/data";

type AvailabilityManagerProps = {
  event: AvailabilityEventWindow;
  showEventHeader?: boolean;
  windows: AvailabilityWindow[];
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

const SAVE_DEBOUNCE_MS = 900;

export function AvailabilityManager({ event, showEventHeader = true, windows }: AvailabilityManagerProps) {
  const spec = useMemo(
    () =>
      buildEventGridSpec({
        eventStartsAt: event.starts_at,
        eventEndsAt: event.ends_at,
        timeZone: event.timezone,
        granularityMinutes: 30,
      }),
    [event.starts_at, event.ends_at, event.timezone],
  );

  const initialCells = useMemo(() => {
    const normalized = windows.map((window) => ({ startsAt: window.starts_at, endsAt: window.ends_at }));
    return windowsToCells(normalizedWindowsToEventWindows(normalized, event.timezone), spec);
  }, [windows, event.timezone, spec]);

  // Seeded once from the server-loaded windows; not re-synced on prop changes so a background
  // revalidation never clobbers an in-progress paint the debounced save hasn't flushed yet.
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
        const normalizedWindows = eventWindowsToNormalizedWindows(minuteWindows, event.timezone);
        const result = await syncEventAvailabilityAction(event.id, normalizedWindows);

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
    [event.id, event.timezone, spec],
  );

  const handleChange = useCallback(
    (next: Set<string>) => {
      setSelected(next);
      persist(next);
    },
    [persist],
  );

  const totalHours = useMemo(() => {
    const totalCells = selected.size;
    return Math.round((totalCells * spec.granularityMinutes / 60) * 10) / 10;
  }, [selected, spec.granularityMinutes]);

  return (
    <div className="space-y-4">
      {showEventHeader ? (
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent-go">{event.name}</p>
          <h1 className="mt-2 text-3xl font-semibold text-text-primary">Availability</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Paint the times you can work. Drag across cells, or use arrow keys and space.
          </p>
        </Card>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2">
        <Card padded={false} className="p-4">
          <StatBlock label="Total availability" value={`${totalHours}h`} />
        </Card>
        <Card padded={false} className="flex items-center p-4">
          <SaveIndicator errorMessage={errorMessage} status={status} />
        </Card>
      </section>

      <AvailabilityGrid
        footer={null}
        onChange={handleChange}
        spec={spec}
        value={selected}
      />
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
