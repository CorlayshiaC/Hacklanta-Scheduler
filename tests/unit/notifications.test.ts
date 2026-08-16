import { describe, expect, it, vi } from "vitest";
import { buildScheduleNotificationEmail } from "@/lib/notifications/content";
import { deliverEmailNotification } from "@/lib/notifications/provider";
import { sendScheduleNotification } from "@/lib/notifications/service";
import { scheduleNotificationEvents } from "@/lib/notifications/types";

const recipient = {
  id: "profile-1",
  email: "member@example.com",
  fullName: "Jane Smith",
  isActive: true,
};

const shift = {
  title: "Check-in",
  startsAt: "2026-10-09T19:00:00.000Z",
  endsAt: "2026-10-09T21:00:00.000Z",
  coverageRoleName: "Operations",
  location: "Main Entrance",
  status: "draft" as const,
};

describe("schedule notifications", () => {
  it("builds schedule published content for the affected member", () => {
    const email = buildScheduleNotificationEmail({
      eventName: "HackLanta II",
      eventType: scheduleNotificationEvents.schedulePublished,
      recipient,
      timezone: "America/New_York",
    });

    expect(email.to).toBe("member@example.com");
    expect(email.subject).toBe("HackLanta II schedule is published");
    expect(email.body).toContain("official schedule is now available");
    expect(email.body).toContain("/my-schedule");
    expect(email.body).toContain("America/New_York");
  });

  it("builds tentative draft assignment content with shift details", () => {
    const email = buildScheduleNotificationEmail({
      eventName: "HackLanta II",
      eventType: scheduleNotificationEvents.assignmentAdded,
      recipient,
      shift,
      timezone: "America/New_York",
    });

    expect(email.subject).toBe("New HackLanta II assignment");
    expect(email.body).toContain("draft schedule changed");
    expect(email.body).toContain("Check-in");
    expect(email.body).toContain("Operations");
    expect(email.body).toContain("Main Entrance");
  });

  it("builds official published assignment removed content", () => {
    const email = buildScheduleNotificationEmail({
      eventName: "HackLanta II",
      eventType: scheduleNotificationEvents.assignmentRemoved,
      recipient,
      shift: { ...shift, status: "published" },
      timezone: "America/New_York",
    });

    expect(email.subject).toBe("HackLanta II assignment removed");
    expect(email.body).toContain("official HackLanta II schedule");
    expect(email.body).toContain("Check-in");
  });

  it("supports assignment changed content", () => {
    const email = buildScheduleNotificationEmail({
      eventName: "HackLanta II",
      eventType: scheduleNotificationEvents.assignmentChanged,
      recipient,
      shift: { ...shift, status: "published" },
      timezone: "America/New_York",
    });

    expect(email.subject).toBe("HackLanta II schedule changed");
    expect(email.body).toContain("official schedule changed");
  });

  it("reports delivery unavailable when no provider is configured", async () => {
    await expect(
      deliverEmailNotification({
        to: "member@example.com",
        subject: "Test",
        body: "Test",
      }),
    ).resolves.toEqual({
      ok: false,
      status: "unavailable",
      message: "Transactional email delivery is not configured.",
    });
  });

  it("does not deliver to inactive recipients", async () => {
    const provider = vi.fn(async () => ({ ok: true as const, status: "sent" as const }));

    const result = await sendScheduleNotification(
      {
        eventName: "HackLanta II",
        eventType: scheduleNotificationEvents.schedulePublished,
        recipient: { ...recipient, isActive: false },
        timezone: "America/New_York",
      },
      provider,
    );

    expect(result).toMatchObject({ ok: false, status: "unavailable" });
    expect(provider).not.toHaveBeenCalled();
  });

  it("handles provider failure without throwing provider details to callers", async () => {
    const provider = vi.fn(async () => {
      throw new Error("provider api key rejected");
    });

    const result = await sendScheduleNotification(
      {
        eventName: "HackLanta II",
        eventType: scheduleNotificationEvents.schedulePublished,
        recipient,
        timezone: "America/New_York",
      },
      provider,
    );

    expect(result).toEqual({
      ok: false,
      status: "failed",
      message: "Notification delivery failed.",
    });
  });
});
