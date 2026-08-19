"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { syncEventAvailabilityAction } from "@/lib/availability/actions";
import { buildEventGridSpec, eventWindowsToNormalizedWindows, normalizedWindowsToEventWindows, windowsToCells, cellsToWindows } from "@/lib/availability/grid";
import { AvailabilityGrid } from "@/components/availability/availability-grid";
import { Card } from "@/components/ui/neu-card";
import { StatBlock } from "@/components/ui/stat-block";
import { EASE_OUT_SLOW } from "@/lib/utils/motion";
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
  const [showFirstSubmitRipple, setShowFirstSubmitRipple] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rippleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // motion-spec.md delight budget item 1: "first-ever availability submission... once per account,
  // ever." No new schema/flag needed: the member had zero windows for this event when this
  // component mounted (a real server fact, not a cosmetic localStorage guess), so the first
  // successful save from that starting point IS their first-ever submission for it. Guarded by
  // hasShownRippleRef so a second save later in the same session (still starting from the same
  // empty `initialCells` snapshot) doesn't replay it.
  const hasNoInitialAvailability = initialCells.size === 0;
  const hasShownRippleRef = useRef(false);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (savedTickTimer.current) clearTimeout(savedTickTimer.current);
      if (rippleTimer.current) clearTimeout(rippleTimer.current);
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

          if (hasNoInitialAvailability && cells.size > 0 && !hasShownRippleRef.current) {
            hasShownRippleRef.current = true;
            setShowFirstSubmitRipple(true);
            if (rippleTimer.current) clearTimeout(rippleTimer.current);
            rippleTimer.current = setTimeout(() => setShowFirstSubmitRipple(false), 700);
          }
        } else {
          setStatus("error");
          setErrorMessage(result.message);
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [event.id, event.timezone, hasNoInitialAvailability, spec],
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
          <SaveIndicator errorMessage={errorMessage} showFirstSubmitRipple={showFirstSubmitRipple} status={status} />
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

/**
 * motion-spec.md section 8: "the save tick draws its checkmark path over 240ms; if this is the
 * member's first-ever submission, the sanctioned delight moment plays instead" (a 600ms radial
 * hairline ripple from the tick, delight budget item 1). The ripple is additive, not a
 * replacement: the checkmark still draws normally, the ripple just plays alongside it.
 */
function SaveIndicator({
  status,
  errorMessage,
  showFirstSubmitRipple,
}: {
  status: SaveStatus;
  errorMessage: string | null;
  showFirstSubmitRipple: boolean;
}) {
  const reduced = useReducedMotion();

  if (status === "saving") {
    return <p className="text-sm text-text-secondary">Saving...</p>;
  }

  if (status === "saved") {
    return (
      <p className="relative flex items-center gap-1.5 text-sm text-accent-primary-glow">
        <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
          <svg aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} viewBox="0 0 24 24">
            <motion.path
              animate={{ pathLength: 1 }}
              d="M20 6 9 17l-5-5"
              initial={{ pathLength: reduced ? 1 : 0 }}
              transition={EASE_OUT_SLOW}
            />
          </svg>
          {showFirstSubmitRipple && !reduced ? (
            <motion.span
              animate={{ scale: 3, opacity: 0 }}
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full border border-accent-primary-glow"
              initial={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: EASE_OUT_SLOW.ease }}
            />
          ) : null}
        </span>
        Saved
      </p>
    );
  }

  if (status === "error") {
    return <p className="text-sm text-accent-warn">{errorMessage ?? "Unable to save."}</p>;
  }

  return <p className="text-sm text-text-secondary">Changes save automatically.</p>;
}
