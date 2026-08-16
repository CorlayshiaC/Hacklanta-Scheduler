import { describe, expect, it } from "vitest";
import {
  parseRoleRequirements,
  parseShiftFormInput,
  validateShiftInsideEvent,
} from "@/lib/scheduling/shift-validation";

const event = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "HackLanta II",
  starts_at: "2026-10-09T11:00:00.000Z",
  ends_at: "2026-10-11T19:00:00.000Z",
  timezone: "America/New_York",
};

describe("shift validation", () => {
  it("parses local HackLanta shift fields into UTC timestamps", () => {
    const parsed = parseShiftFormInput({
      title: "Registration desk",
      shiftRoleId: "",
      date: "2026-10-09",
      startsAt: "07:00",
      endsAt: "10:00",
      location: "Lobby",
      notes: "",
      requiredPeople: "2",
    });

    expect(parsed.ok).toBe(true);

    if (parsed.ok) {
      expect(parsed.value.startsAt).toBe("2026-10-09T11:00:00.000Z");
      expect(parsed.value.endsAt).toBe("2026-10-09T14:00:00.000Z");
      expect(parsed.value.requiredPeople).toBe(2);
    }
  });

  it("rejects shifts outside the HackLanta II operational window", () => {
    expect(
      validateShiftInsideEvent({
        startsAt: "2026-10-09T10:00:00.000Z",
        endsAt: "2026-10-09T12:00:00.000Z",
        event,
      }),
    ).toEqual({
      ok: false,
      message: "Shift must stay within the HackLanta II operational window.",
    });
  });

  it("requires positive general staffing", () => {
    expect(
      parseShiftFormInput({
        title: "Coverage",
        shiftRoleId: "",
        date: "2026-10-10",
        startsAt: "10:00",
        endsAt: "12:00",
        requiredPeople: "0",
      }).ok,
    ).toBe(false);
  });

  it("validates role requirements and rejects duplicate roles", () => {
    const roleId = "33333333-3333-4333-8333-333333333333";

    expect(
      parseRoleRequirements({
        coverageRoleIds: [roleId],
        requiredPeopleByRole: { [roleId]: "1" },
        validCoverageRoleIds: new Set([roleId]),
      }),
    ).toEqual({
      ok: true,
      value: [{ coverageRoleId: roleId, requiredPeople: 1 }],
    });

    expect(
      parseRoleRequirements({
        coverageRoleIds: [roleId, roleId],
        requiredPeopleByRole: { [roleId]: "1" },
        validCoverageRoleIds: new Set([roleId]),
      }),
    ).toEqual({ ok: false, message: "Duplicate coverage roles are not allowed." });
  });
});
