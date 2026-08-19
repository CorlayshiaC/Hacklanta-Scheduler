import { z } from "zod";

// Mirrors the real app_role enum exactly. "board_member"/"organizer" were dropped by
// 20260817000100_v2_role_model_and_event_directors.sql; this schema still declaring "board_member"
// meant every role change submitted through it sent a value the database no longer accepts, so the
// write was rejected at the constraint rather than caught here.
export const applicationRoleSchema = z.enum(["admin", "director", "member"]);

export const profileUpdateInputSchema = z.object({
  profileId: z.string().uuid("Invalid member id."),
  fullName: z.string().trim().max(120, "Name must be 120 characters or fewer."),
  role: applicationRoleSchema,
  isActive: z.boolean(),
});

export const coverageRoleMutationInputSchema = z.object({
  profileId: z.string().uuid("Invalid member id."),
  eventId: z.string().uuid("Invalid event id."),
  coverageRoleId: z.string().uuid("Invalid coverage role id."),
});

export const memberSettingsInputSchema = z.object({
  profileId: z.string().uuid("Invalid member id."),
  eventId: z.string().uuid("Invalid event id."),
  maxHours: z.coerce.number().positive("Maximum hours must be greater than 0."),
  minimumBreakMinutes: z.coerce
    .number()
    .int("Minimum break must be a whole number of minutes.")
    .min(0, "Minimum break cannot be negative."),
});

export function readRequiredString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function readCheckbox(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

export function validationMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}
