import {
  formatInputDateInTimeZone,
  formatInputTimeInTimeZone,
  listCalendarDaysInRange,
  localDateTimeToUtcIso,
} from "@/lib/availability/time";

export type GridGranularityMinutes = 15 | 30 | 60;

export type GridDay = {
  id: string;
  label: string;
};

export type GridSpec = {
  days: GridDay[];
  granularityMinutes: GridGranularityMinutes;
  startMinute: number;
  endMinute: number;
};

export type GridCellCoord = {
  dayId: string;
  minute: number;
};

export type MinuteWindow = {
  dayId: string;
  startMinute: number;
  endMinute: number;
};

export type NormalizedWindow = {
  startsAt: string;
  endsAt: string;
};

export function cellKey(coord: GridCellCoord): string {
  return `${coord.dayId}:${coord.minute}`;
}

export function parseCellKey(key: string): GridCellCoord {
  const separatorIndex = key.lastIndexOf(":");
  return {
    dayId: key.slice(0, separatorIndex),
    minute: Number(key.slice(separatorIndex + 1)),
  };
}

export function generateGridRows(spec: GridSpec): number[] {
  const rows: number[] = [];

  for (let minute = spec.startMinute; minute < spec.endMinute; minute += spec.granularityMinutes) {
    rows.push(minute);
  }

  return rows;
}

export function minuteToLocalTime(minute: number): string {
  const normalized = ((minute % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (normalized % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function addCalendarDays(dateValue: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);

  if (!match) {
    return dateValue;
  }

  const [, year, month, day] = match;
  const shifted = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day) + days));
  return shifted.toISOString().slice(0, 10);
}

/**
 * Merges a set of selected cell keys into contiguous per-day minute windows.
 * A run of adjacent selected cells on the same day becomes one window.
 */
export function cellsToWindows(selected: ReadonlySet<string>, spec: GridSpec): MinuteWindow[] {
  const rows = generateGridRows(spec);
  const windows: MinuteWindow[] = [];

  for (const day of spec.days) {
    let runStart: number | null = null;

    rows.forEach((minute, index) => {
      const isSelected = selected.has(cellKey({ dayId: day.id, minute }));
      if (isSelected && runStart === null) {
        runStart = minute;
      }

      const nextMinute = rows[index + 1];
      const nextSelected = nextMinute !== undefined && selected.has(cellKey({ dayId: day.id, minute: nextMinute }));
      const runContinues = isSelected && nextMinute === minute + spec.granularityMinutes && nextSelected;

      if (isSelected && !runContinues) {
        windows.push({ dayId: day.id, startMinute: runStart as number, endMinute: minute + spec.granularityMinutes });
        runStart = null;
      }
    });
  }

  return windows;
}

export function windowsToCells(windows: MinuteWindow[], spec: GridSpec): Set<string> {
  const rows = generateGridRows(spec);
  const cells = new Set<string>();

  for (const window of windows) {
    for (const minute of rows) {
      if (minute >= window.startMinute && minute < window.endMinute && window.dayId) {
        cells.add(cellKey({ dayId: window.dayId, minute }));
      }
    }
  }

  return cells;
}

/**
 * Converts grid-local minute windows (dayId is a calendar date, e.g. "2026-10-09") into
 * absolute UTC timestamps using the event's timezone. `endMinute` may exceed 24*60 for a
 * window that runs past midnight; it rolls onto the next calendar day.
 */
export function eventWindowsToNormalizedWindows(windows: MinuteWindow[], timeZone: string): NormalizedWindow[] {
  return windows.map((window) => {
    const rollsToNextDay = window.endMinute >= 24 * 60;
    const endDayId = rollsToNextDay ? addCalendarDays(window.dayId, 1) : window.dayId;
    const startsAt = localDateTimeToUtcIso(window.dayId, minuteToLocalTime(window.startMinute), timeZone);
    const endsAt = localDateTimeToUtcIso(endDayId, minuteToLocalTime(window.endMinute), timeZone);

    if (!startsAt || !endsAt) {
      throw new Error("Unable to convert grid selection to a timestamp.");
    }

    return { startsAt, endsAt };
  });
}

/**
 * Inverse of `eventWindowsToNormalizedWindows`: reads stored absolute timestamps back into
 * grid-local minute windows for painting the grid's initial selection.
 */
export function normalizedWindowsToEventWindows(windows: NormalizedWindow[], timeZone: string): MinuteWindow[] {
  return windows.map((window) => {
    const startDayId = formatInputDateInTimeZone(window.startsAt, timeZone);
    const endDayId = formatInputDateInTimeZone(window.endsAt, timeZone);
    const [startHour, startMinute] = formatInputTimeInTimeZone(window.startsAt, timeZone).split(":").map(Number);
    const [endHour, endMinuteValue] = formatInputTimeInTimeZone(window.endsAt, timeZone).split(":").map(Number);
    const startMinuteOfDay = startHour * 60 + startMinute;
    let endMinuteOfDay = endHour * 60 + endMinuteValue;

    if (endDayId !== startDayId) {
      endMinuteOfDay += 24 * 60;
    }

    return { dayId: startDayId, startMinute: startMinuteOfDay, endMinute: endMinuteOfDay };
  });
}

/**
 * Recurring-availability variant: dayId is a day-of-week index ("0".."6", 0 = Sunday,
 * matching `Date.getDay()`), minutes are wall-clock local time with no timezone conversion,
 * since a recurring weekly pattern never crosses a timezone boundary the way an
 * event-scoped timestamp does.
 */
export const RECURRING_DAY_IDS = ["0", "1", "2", "3", "4", "5", "6"] as const;

export const RECURRING_DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type RecurringWindowRow = {
  day_of_week: number;
  starts_at_local: string;
  ends_at_local: string;
};

export function recurringWindowsToRows(
  windows: MinuteWindow[],
): { dayOfWeek: number; startsAtLocal: string; endsAtLocal: string }[] {
  return windows.map((window) => ({
    dayOfWeek: Number(window.dayId),
    startsAtLocal: minuteToLocalTime(window.startMinute),
    endsAtLocal: minuteToLocalTime(window.endMinute),
  }));
}

function parseLocalTimeToMinute(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function recurringRowsToWindows(rows: RecurringWindowRow[]): MinuteWindow[] {
  return rows.map((row) => ({
    dayId: String(row.day_of_week),
    startMinute: parseLocalTimeToMinute(row.starts_at_local),
    endMinute: parseLocalTimeToMinute(row.ends_at_local),
  }));
}

export function buildRecurringGridSpec(granularityMinutes: GridGranularityMinutes = 30): GridSpec {
  return {
    days: RECURRING_DAY_IDS.map((id, index) => ({ id, label: RECURRING_DAY_LABELS[index] })),
    granularityMinutes,
    startMinute: 8 * 60,
    endMinute: 22 * 60,
  };
}

export function buildEventGridSpec(input: {
  eventStartsAt: string;
  eventEndsAt: string;
  timeZone: string;
  granularityMinutes: GridGranularityMinutes;
  dayStartMinute?: number;
  dayEndMinute?: number;
}): GridSpec {
  const days: GridDay[] = listCalendarDaysInRange(input.eventStartsAt, input.eventEndsAt, input.timeZone).map(
    (dayId) => ({ id: dayId, label: dayId }),
  );

  return {
    days,
    granularityMinutes: input.granularityMinutes,
    startMinute: input.dayStartMinute ?? 0,
    endMinute: input.dayEndMinute ?? 24 * 60,
  };
}
