import { formatShiftDate, formatShiftRange, formatShiftTime } from "@/lib/utils/format";
import type { QuickchatAnswer } from "@/lib/quickchat/types";

/**
 * One pure, deterministic template builder per query kind, mirroring `lib/ai/kinds/gap-
 * analysis.ts`'s split between "compute the facts" (data.ts, real queries) and "phrase the
 * sentence" (here, no I/O, unit-testable, the fallback Gemini rephrasing can never beat on
 * correctness). Every sentence stays under 15 words and puts every time/count/number in mono at
 * render time (the component wraps digits, not this module: these return plain strings).
 */

export function buildScheduleAnswer(input: {
  nextShift: { label: string; eventName: string; startsAt: string; timezone: string } | null;
}): QuickchatAnswer {
  if (!input.nextShift) {
    return {
      text: "No upcoming shifts. Open shifts you can take are on the Shifts page.",
      deepLink: "/shifts",
      containsPersonalData: false,
    };
  }

  const { label, eventName, startsAt, timezone } = input.nextShift;
  const day = formatShiftDate(startsAt, timezone);
  const time = formatShiftTime(startsAt, timezone);
  return {
    text: `Next shift: ${day} ${time}, ${label}, ${eventName}.`,
    deepLink: "/my-schedule",
    containsPersonalData: false,
  };
}

export function buildNextEventAnswer(input: {
  event: { name: string; startsAt: string; endsAt: string; timezone: string } | null;
}): QuickchatAnswer {
  if (!input.event) {
    return {
      text: "No upcoming events scheduled yet.",
      deepLink: "/events",
      containsPersonalData: false,
    };
  }

  const { name, startsAt, endsAt, timezone } = input.event;
  const range =
    formatShiftDate(startsAt, timezone) === formatShiftDate(endsAt, timezone)
      ? formatShiftDate(startsAt, timezone)
      : `${formatShiftDate(startsAt, timezone)} to ${formatShiftDate(endsAt, timezone)}`;
  return {
    text: `${name}, ${range}.`,
    deepLink: "/events",
    containsPersonalData: false,
  };
}

export function buildHoursAnswer(input: {
  eventName: string | null;
  hoursThisEvent: number | null;
  hoursSemester: number | null;
}): QuickchatAnswer {
  if (input.eventName === null || input.hoursThisEvent === null) {
    return {
      text: "No scheduled hours yet this event.",
      deepLink: "/my-schedule",
      containsPersonalData: false,
    };
  }

  const eventLine = `${input.hoursThisEvent}h scheduled for ${input.eventName}.`;
  // hoursSemester is null until Agent 2 publishes hours_semester(), STUB(agent-2), see
  // docs/contracts/quickchat.md: omit the line rather than show a fabricated total.
  const semesterLine = input.hoursSemester !== null ? ` ${input.hoursSemester}h this semester.` : "";
  return {
    text: `${eventLine}${semesterLine}`,
    deepLink: "/my-schedule",
    containsPersonalData: false,
  };
}

export function buildCoworkersAnswer(input: {
  shiftLabel: string | null;
  coworkerNames: string[];
}): QuickchatAnswer {
  if (!input.shiftLabel) {
    return {
      text: "No upcoming shift to check coworkers for.",
      deepLink: "/my-schedule",
      // No names in this branch, but the kind always reports true (see QuickchatAnswer's doc
      // comment): a caller filtering on this field shouldn't have to branch on shape.
      containsPersonalData: true,
    };
  }

  if (input.coworkerNames.length === 0) {
    return {
      text: `No one else is assigned to ${input.shiftLabel} yet.`,
      deepLink: "/my-schedule",
      containsPersonalData: true,
    };
  }

  const names =
    input.coworkerNames.length <= 3
      ? input.coworkerNames.join(", ")
      : `${input.coworkerNames.slice(0, 3).join(", ")}, +${input.coworkerNames.length - 3} more`;
  return {
    text: `${input.shiftLabel}: ${names}.`,
    deepLink: "/my-schedule",
    containsPersonalData: true,
  };
}

export function buildOpenShiftsAnswer(input: {
  openCount: number;
  firstShiftLabel: string | null;
}): QuickchatAnswer {
  if (input.openCount === 0) {
    return {
      text: "No open shifts right now.",
      deepLink: "/shifts",
      containsPersonalData: false,
    };
  }

  const suffix = input.firstShiftLabel ? `, starting with ${input.firstShiftLabel}` : "";
  return {
    text: `${input.openCount} open ${input.openCount === 1 ? "shift" : "shifts"}${suffix}.`,
    deepLink: "/shifts",
    containsPersonalData: false,
  };
}

// formatShiftRange is re-exported for data.ts's shift-label building, kept in one place so every
// "X to Y" pairing in this module goes through the same formatter.
export { formatShiftRange };
