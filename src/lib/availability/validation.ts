import { z } from "zod";
import { HACKLANTA_TIME_ZONE, localDateTimeToUtcIso } from "@/lib/availability/time";

export const AVAILABILITY_NOTE_MAX_LENGTH = 160;

export type AvailabilityWindowLike = {
  id: string;
  starts_at: string;
  ends_at: string;
};

export type AvailabilityFormInput = {
  date: string;
  startsAt: string;
  endsAt: string;
  note?: string;
};

export type AvailabilityEventWindow = {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
};

export const availabilityFormInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date."),
  startsAt: z.string().regex(/^\d{2}:\d{2}$/, "Choose a valid start time."),
  endsAt: z.string().regex(/^\d{2}:\d{2}$/, "Choose a valid end time."),
  note: z.string().trim().max(AVAILABILITY_NOTE_MAX_LENGTH).optional(),
});

export function parseAvailabilityFormInput(input: AvailabilityFormInput) {
  const parsed = availabilityFormInputSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const startsAt = localDateTimeToUtcIso(
    parsed.data.date,
    parsed.data.startsAt,
    HACKLANTA_TIME_ZONE,
  );
  const endsAt = localDateTimeToUtcIso(parsed.data.date, parsed.data.endsAt, HACKLANTA_TIME_ZONE);

  if (!startsAt || !endsAt) {
    return { ok: false as const, message: "Choose a valid date and time." };
  }

  if (new Date(startsAt).getTime() >= new Date(endsAt).getTime()) {
    return { ok: false as const, message: "Start time must be before end time." };
  }

  return {
    ok: true as const,
    value: {
      startsAt,
      endsAt,
      note: parsed.data.note?.trim() || null,
    },
  };
}

export function validateWindowInsideEvent(input: {
  startsAt: string;
  endsAt: string;
  event: AvailabilityEventWindow;
}) {
  const startsAt = new Date(input.startsAt).getTime();
  const endsAt = new Date(input.endsAt).getTime();
  const eventStartsAt = new Date(input.event.starts_at).getTime();
  const eventEndsAt = new Date(input.event.ends_at).getTime();

  if (input.event.name !== "HackLanta II") {
    return { ok: false as const, message: "Availability can only be submitted for HackLanta II." };
  }

  if (input.event.timezone !== HACKLANTA_TIME_ZONE) {
    return { ok: false as const, message: "HackLanta II must use America/New_York time." };
  }

  if (startsAt < eventStartsAt || endsAt > eventEndsAt) {
    return {
      ok: false as const,
      message: "Availability must stay within the HackLanta II operational window.",
    };
  }

  return { ok: true as const };
}

export function findOverlappingWindow(input: {
  startsAt: string;
  endsAt: string;
  existingWindows: AvailabilityWindowLike[];
  excludeWindowId?: string;
}) {
  const startsAt = new Date(input.startsAt).getTime();
  const endsAt = new Date(input.endsAt).getTime();

  return input.existingWindows.find((window) => {
    if (window.id === input.excludeWindowId) {
      return false;
    }

    return new Date(window.starts_at).getTime() < endsAt && new Date(window.ends_at).getTime() > startsAt;
  });
}
