"use client";

import { useMemo, useState } from "react";
import type { PublicSchedule, PublicShift } from "@/lib/public/types";
// STUB(agent-1): replace with the real primitive once components/ui publishes it.
import { MonoText, ShiftCapsule, TextInput } from "@/components/public/_stub-primitives";
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
    return (
      <p className="text-sm text-[#9A9A9A]">No shifts published yet. Check back closer to the event.</p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div data-schedule-search className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xs flex-1">
          <label htmlFor="find-my-shifts" className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#5E5E5E]">
            Find my shifts
          </label>
          <TextInput
            id="find-my-shifts"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type your name"
          />
        </div>

        <div className="flex items-center gap-4 text-xs text-[#9A9A9A]">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#A78BFA]" />
            Staffed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF9F2E]" />
            Needs people
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full border border-[#5E5E5E]" />
            Empty
          </span>
        </div>
      </div>

      {stationGroups.length === 0 ? (
        <p className="text-sm text-[#9A9A9A]">No shifts match that name. Clear the search to see the full schedule.</p>
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
                <div key={time} className="px-2 text-xs font-medium uppercase tracking-wide text-[#5E5E5E]">
                  <MonoText>{formatTimeInTimeZone(time, schedule.event.timezone)}</MonoText>
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
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9A9A9A]">
                  {group.stationName}
                </h2>
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
      <div className="flex items-center px-2 text-sm font-semibold text-[#F5F5F5]">{group.stationName}</div>
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
    <div data-schedule-shift className="rounded-2xl bg-[#1E1E1E] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-[#F5F5F5]">{shift.title}</p>
          <MonoText className="text-xs text-[#9A9A9A]">
            {formatTimeInTimeZone(shift.startsAt, timezone)} to {formatTimeInTimeZone(shift.endsAt, timezone)}
          </MonoText>
          {shift.location ? <p className="text-xs text-[#5E5E5E]">{shift.location}</p> : null}
        </div>
        <ShiftCapsule filled={shift.filled} needed={shift.needed} matched={matched} />
      </div>
      {shift.filled === 0 ? (
        <p className="mt-2 text-xs text-[#5E5E5E]">No one assigned yet</p>
      ) : (
        <p className="mt-2 text-xs text-[#9A9A9A]">{shift.assignees.join(", ")}</p>
      )}
    </div>
  );
}
