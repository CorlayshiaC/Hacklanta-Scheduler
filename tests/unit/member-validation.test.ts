import { describe, expect, it } from "vitest";
import {
  coverageRoleMutationInputSchema,
  memberSettingsInputSchema,
  profileUpdateInputSchema,
  readCheckbox,
} from "@/lib/admin/member-validation";

const profileId = "11111111-1111-4111-8111-111111111111";
const eventId = "22222222-2222-4222-8222-222222222222";
const coverageRoleId = "33333333-3333-4333-8333-333333333333";

describe("admin member validation", () => {
  it("accepts valid profile updates with active status", () => {
    const result = profileUpdateInputSchema.safeParse({
      profileId,
      fullName: "Ada Lovelace",
      role: "admin",
      isActive: true,
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid application roles", () => {
    const result = profileUpdateInputSchema.safeParse({
      profileId,
      fullName: "Ada Lovelace",
      role: "owner",
      isActive: true,
    });

    expect(result.success).toBe(false);
  });

  it("preserves inactive profile updates as explicit boolean state", () => {
    const result = profileUpdateInputSchema.safeParse({
      profileId,
      fullName: "Grace Hopper",
      role: "board_member",
      isActive: false,
    });

    expect(result.success).toBe(true);
    expect(result.data?.isActive).toBe(false);
  });

  it("validates coverage role assignment ids", () => {
    expect(
      coverageRoleMutationInputSchema.safeParse({
        profileId,
        eventId,
        coverageRoleId,
      }).success,
    ).toBe(true);

    expect(
      coverageRoleMutationInputSchema.safeParse({
        profileId: "not-a-uuid",
        eventId,
        coverageRoleId,
      }).success,
    ).toBe(false);
  });

  it("validates member work constraints", () => {
    expect(
      memberSettingsInputSchema.safeParse({
        profileId,
        eventId,
        maxHours: "12.5",
        minimumBreakMinutes: "30",
      }).success,
    ).toBe(true);

    expect(
      memberSettingsInputSchema.safeParse({
        profileId,
        eventId,
        maxHours: "0",
        minimumBreakMinutes: "-1",
      }).success,
    ).toBe(false);
  });

  it("reads checkbox state from form data", () => {
    const formData = new FormData();
    formData.set("isActive", "on");

    expect(readCheckbox(formData, "isActive")).toBe(true);
    expect(readCheckbox(new FormData(), "isActive")).toBe(false);
  });
});
