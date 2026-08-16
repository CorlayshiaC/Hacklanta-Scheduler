import { z } from "zod";
import { HACKLANTA_TIME_ZONE, localDateTimeToUtcIso } from "@/lib/availability/time";

export const SHIFT_TITLE_MAX_LENGTH = 120;
export const SHIFT_LOCATION_MAX_LENGTH = 120;
export const SHIFT_NOTES_MAX_LENGTH = 500;

export type ShiftEventWindow = {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
};

export const shiftFormInputSchema = z.object({
  title: z.string().trim().min(1, "Shift title is required.").max(SHIFT_TITLE_MAX_LENGTH),
  shiftRoleId: z.string().uuid().optional().or(z.literal("")),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date."),
  startsAt: z.string().regex(/^\d{2}:\d{2}$/, "Choose a valid start time."),
  endsAt: z.string().regex(/^\d{2}:\d{2}$/, "Choose a valid end time."),
  location: z.string().trim().max(SHIFT_LOCATION_MAX_LENGTH).optional(),
  notes: z.string().trim().max(SHIFT_NOTES_MAX_LENGTH).optional(),
  requiredPeople: z.coerce.number().int().min(1, "Required people must be at least 1."),
});

export const roleRequirementSchema = z.object({
  coverageRoleId: z.string().uuid(),
  requiredPeople: z.coerce.number().int().min(1).max(99),
});

export type ParsedShiftForm = {
  title: string;
  shiftRoleId: string | null;
  startsAt: string;
  endsAt: string;
  location: string | null;
  notes: string | null;
  requiredPeople: number;
};

export function parseShiftFormInput(input: {
  title: string;
  shiftRoleId?: string;
  date: string;
  startsAt: string;
  endsAt: string;
  location?: string;
  notes?: string;
  requiredPeople: string;
}) {
  const parsed = shiftFormInputSchema.safeParse(input);

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
    return { ok: false as const, message: "Shift start time must be before end time." };
  }

  return {
    ok: true as const,
    value: {
      title: parsed.data.title,
      shiftRoleId: parsed.data.shiftRoleId || null,
      startsAt,
      endsAt,
      location: parsed.data.location?.trim() || null,
      notes: parsed.data.notes?.trim() || null,
      requiredPeople: parsed.data.requiredPeople,
    } satisfies ParsedShiftForm,
  };
}

export function validateShiftInsideEvent(input: {
  startsAt: string;
  endsAt: string;
  event: ShiftEventWindow;
}) {
  if (input.event.name !== "HackLanta II") {
    return { ok: false as const, message: "Shifts can only be created for HackLanta II." };
  }

  if (input.event.timezone !== HACKLANTA_TIME_ZONE) {
    return { ok: false as const, message: "HackLanta II must use America/New_York time." };
  }

  const startsAt = new Date(input.startsAt).getTime();
  const endsAt = new Date(input.endsAt).getTime();
  const eventStartsAt = new Date(input.event.starts_at).getTime();
  const eventEndsAt = new Date(input.event.ends_at).getTime();

  if (startsAt < eventStartsAt || endsAt > eventEndsAt) {
    return { ok: false as const, message: "Shift must stay within the HackLanta II operational window." };
  }

  return { ok: true as const };
}

export function parseRoleRequirements(input: {
  coverageRoleIds: string[];
  requiredPeopleByRole: Record<string, string>;
  validCoverageRoleIds: Set<string>;
}) {
  const requirements = [];
  const seen = new Set<string>();

  for (const coverageRoleId of input.coverageRoleIds) {
    if (seen.has(coverageRoleId)) {
      return { ok: false as const, message: "Duplicate coverage roles are not allowed." };
    }

    seen.add(coverageRoleId);

    if (!input.validCoverageRoleIds.has(coverageRoleId)) {
      return { ok: false as const, message: "Coverage role must belong to HackLanta II." };
    }

    const parsed = roleRequirementSchema.safeParse({
      coverageRoleId,
      requiredPeople: input.requiredPeopleByRole[coverageRoleId],
    });

    if (!parsed.success) {
      return { ok: false as const, message: "Each selected coverage role needs at least 1 person." };
    }

    requirements.push(parsed.data);
  }

  return { ok: true as const, value: requirements };
}
