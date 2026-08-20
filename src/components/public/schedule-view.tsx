"use client";

import { useMemo, useState } from "react";
import { NeuCard } from "@/components/ui/neu-card";
import { NeuInput } from "@/components/ui/neu-input";
import { StatusPill } from "@/components/ui/status-pill";
import type { PublicSchedule, PublicShift } from "@/lib/public/types";
import { formatTimeInTimeZone } from "@/lib/availability/time";

type ScheduleViewProps = {
  schedule: PublicSchedule;
};

type StationGroup = {
  stationName: string;
  shifts: PublicShift[];
};

const UNASSIGNED_STATION_LABEL = "General";

function matchesQuery(shift: PublicShift, query: string): boolean {
  const needle = query.trim().toLowerCase();

  if (needle === "") {
    return true;
  }

  return shift.assignees.some((name) => name.toLowerCase().includes(needle));
}

function groupByStation(shifts: PublicShift[]): StationGroup[] {
  const groups = new Map<string, PublicShift[]>();

  for (const shift of shifts) {
    const key = shift.stationName ?? UNASSIGNED_STATION_LABEL;
    const existing = groups.get(key);

    if (existing) {
      existing.push(shift);
    } else {
      groups.set(key, [shift]);
    }
  }

  return Array.from(groups.entries())
    .map(([stationName, groupShifts]) => ({
      stationName,
      shifts: [...groupShifts].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    }))
    .sort((a, b) => a.stationName.localeCompare(b.stationName));
}

/** Public schedule's "staffed/needs people/empty" is a headcount ratio, not literally an
 * assignment-approval status, but it maps cleanly onto StatusPill's three states with a custom
 * label: fully staffed reads as approved (purple dot), partially staffed as in_approval (orange
 * dot), empty as not_assigned (muted dot). Real StatusPill, not an approximation. */
function ShiftStatus({ filled, needed }: { filled: number; needed: number }) {
  const state = filled <= 0 ? "not_assigned" : filled < needed ? "in_approval" : "approved";

  return <StatusPill state={state} label={`${filled}/${needed}`} />;
}

export function ScheduleView({ schedule }: ScheduleViewProps) {
  const [query, setQuery] = useState("");

  const isSearching = query.trim() !== "";

  const filteredShifts = useMemo(
    () => (isSearching ? schedule.shifts.filter((shift) => matchesQuery(shift, query)) : schedule.shifts),
    [schedule.shifts, query, isSearching],
  );

  const stationGroups = useMemo(() => groupByStation(filteredShifts), [filteredShifts]);

  const timeColumns = useMemo(() => {
    const seen = new Set<string>();
    const times: string[] = [];

    for (const shift of [...filteredShifts].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
      if (!seen.has(shift.startsAt)) {
        seen.add(shift.startsAt);
        times.push(shift.startsAt);
      }
    }

    return times;
  }, [filteredShifts]);

  if (schedule.shifts.length === 0) {
    return <p className="text-[13px] text-text-secondary">No shifts published yet. Check back closer to the event.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div data-schedule-search className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xs flex-1">
          <label htmlFor="find-my-shifts" className="mb-1 block text-[11px] text-text-secondary">
            Find my shifts
          </label>
          <NeuInput
            id="find-my-shifts"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type your name"
          />
        </div>

        <div className="flex items-center gap-4 text-[11px] text-text-secondary">
          <span className="flex items-center gap-1.5">
            <span className="h-[5px] w-[5px] rounded-full bg-accent-primary" />
            Staffed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-[5px] w-[5px] rounded-full bg-accent-warn" />
            Needs people
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-[5px] w-[5px] rounded-full bg-text-secondary" />
            Empty
          </span>
        </div>
      </div>

      {stationGroups.length === 0 ? (
        <p className="text-[13px] text-text-secondary">
          No shifts match that name. Clear the search to see the full schedule.
        </p>
      ) : (
        <>
          {/* Grid layout: medium screens and up, stations as rows, start times as columns.
              Hidden in print, see print.css: print output always uses the agenda layout below. */}
          <div data-schedule-grid className="hidden overflow-x-auto md:block">
            <div
              className="grid min-w-max gap-3"
              style={{
                gridTemplateColumns: `10rem repeat(${timeColumns.length}, minmax(11rem, 1fr))`,
              }}
            >
              <div />
              {timeColumns.map((time) => (
                <div key={time} className="px-2 text-[11px] text-text-secondary">
                  <span className="font-mono tabular-nums">{formatTimeInTimeZone(time, schedule.event.timezone)}</span>
                </div>
              ))}

              {stationGroups.map((group) => (
                <ScheduleGridRow
                  key={group.stationName}
                  group={group}
                  timeColumns={timeColumns}
                  timezone={schedule.event.timezone}
                  isSearching={isSearching}
                />
              ))}
            </div>
          </div>

          {/* Agenda layout: below medium screens, grouped by station, sorted by start time.
              Also the layout print.css forces visible for print, one block per station. */}
          <div data-schedule-agenda className="flex flex-col gap-6 md:hidden">
            {stationGroups.map((group) => (
              <div key={group.stationName} data-schedule-station>
                <h2 className="mb-2 text-[11px] font-medium text-text-secondary">{group.stationName}</h2>
                <div className="flex flex-col gap-2">
                  {group.shifts.map((shift) => (
                    <ShiftCard
                      key={shift.id}
                      shift={shift}
                      timezone={schedule.event.timezone}
                      matched={isSearching}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ScheduleGridRow({
  group,
  timeColumns,
  timezone,
  isSearching,
}: {
  group: StationGroup;
  timeColumns: string[];
  timezone: string;
  isSearching: boolean;
}) {
  return (
    <>
      <div className="flex items-center px-2 text-[13px] font-medium text-text-primary">{group.stationName}</div>
      {timeColumns.map((time) => {
        const shiftsAtTime = group.shifts.filter((shift) => shift.startsAt === time);

        return (
          <div key={time} className="min-w-0">
            {shiftsAtTime.length > 0 ? (
              <div className="flex flex-col gap-2">
                {shiftsAtTime.map((shift) => (
                  <ShiftCard key={shift.id} shift={shift} timezone={timezone} matched={isSearching} />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function ShiftCard({
  shift,
  timezone,
  matched,
}: {
  shift: PublicShift;
  timezone: string;
  matched: boolean;
}) {
  return (
    <NeuCard data-schedule-shift padded className={matched ? "border-accent-primary" : undefined}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <p className="text-[13px] font-medium text-text-primary">{shift.title}</p>
          <span className="font-mono tabular-nums text-[11px] text-text-secondary">
            {formatTimeInTimeZone(shift.startsAt, timezone)} to {formatTimeInTimeZone(shift.endsAt, timezone)}
          </span>
          {shift.location ? <p className="text-[11px] text-text-secondary">{shift.location}</p> : null}
        </div>
        <ShiftStatus filled={shift.filled} needed={shift.needed} />
      </div>
      {shift.filled === 0 ? (
        <p className="mt-2 text-[11px] text-text-secondary">No one assigned yet</p>
      ) : (
        <p className="mt-2 text-[11px] text-text-secondary">{shift.assignees.join(", ")}</p>
      )}
    </NeuCard>
  );
}
