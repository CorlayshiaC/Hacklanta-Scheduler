import { describe, expect, it } from "vitest";
import {
  buildScheduleNotificationContent,
  buildScheduleNotificationEmail,
} from "@/lib/notifications/content";
import {
  renderNotificationEmailHtml,
  renderNotificationEmailText,
} from "@/lib/notifications/email-template";
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
  status: "published" as const,
};

const siteUrl = "https://scheduler.progsu.org";

function contentFor(eventType: (typeof scheduleNotificationEvents)[keyof typeof scheduleNotificationEvents]) {
  return buildScheduleNotificationContent({
    eventName: "Fall GBM",
    eventType,
    recipient,
    shift,
    timezone: "America/New_York",
  });
}

describe("transactional email HTML", () => {
  it("renders the light theme card, not glass", () => {
    const html = renderNotificationEmailHtml(
      contentFor(scheduleNotificationEvents.assignmentAdded),
      siteUrl,
    );

    // Solid light canvas and a solid white card. backdrop-filter has no support in any mail client,
    // so a translucent surface must never make it into this output.
    expect(html).toContain("background-color:#F4F4F7");
    expect(html).toContain("background-color:#FFFFFF");
    expect(html).not.toContain("backdrop-filter");
    expect(html).not.toContain("rgba(");
    // Auto dark-mode inversion would wreck a white-card layout, so the scheme is declared.
    expect(html).toContain('name="color-scheme" content="light"');
  });

  it("uses one purple CTA with white text and an absolute link", () => {
    const html = renderNotificationEmailHtml(
      contentFor(scheduleNotificationEvents.assignmentAdded),
      siteUrl,
    );

    expect(html).toContain('bgcolor="#6D4AFF"');
    expect(html).toContain("color:#FFFFFF");
    expect(html).toContain(`href="${siteUrl}/my-schedule"`);
    expect(html).toContain("View your schedule");
  });

  it("renders warning kinds as dark text on an orange tint, never white on an orange fill", () => {
    const html = renderNotificationEmailHtml(
      contentFor(scheduleNotificationEvents.shiftCancelled),
      siteUrl,
    );

    expect(html).toContain("border-left:3px solid #E8730C");
    expect(html).toContain("background-color:#FDF1E4");
    // White on #E8730C is 3.05:1 and fails AA. Orange is never a text-bearing fill here.
    expect(html).not.toContain('bgcolor="#E8730C"');
    expect(html).toContain("A shift you were assigned to was cancelled.");
  });

  it("keeps positive kinds free of the warning callout", () => {
    const html = renderNotificationEmailHtml(
      contentFor(scheduleNotificationEvents.assignmentApproved),
      siteUrl,
    );

    expect(html).not.toContain("#E8730C");
    expect(html).toContain("It&#39;s now confirmed.");
  });

  it("escapes user-authored values", () => {
    const content = buildScheduleNotificationContent({
      eventName: "<script>alert(1)</script>",
      eventType: scheduleNotificationEvents.assignmentChanged,
      recipient: { ...recipient, fullName: 'Jane "JJ" O\'Hara' },
      shift: { ...shift, title: "Check-in & Badging", location: "<b>Room 4</b>" },
      timezone: "America/New_York",
    });
    const html = renderNotificationEmailHtml(content, siteUrl);

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Check-in &amp; Badging");
    expect(html).toContain("&lt;b&gt;Room 4&lt;/b&gt;");
    expect(html).toContain("Jane &quot;JJ&quot; O&#39;Hara");
  });

  it("carries every shift detail into both parts", () => {
    const content = contentFor(scheduleNotificationEvents.reminder24h);
    const html = renderNotificationEmailHtml(content, siteUrl);
    const text = renderNotificationEmailText(content, siteUrl);

    for (const value of ["Check-in", "Operations", "Main Entrance", "official schedule"]) {
      expect(html).toContain(value);
      expect(text).toContain(value);
    }

    expect(text).toContain("Shift: Check-in");
    expect(text).toContain(`View your schedule: ${siteUrl}/my-schedule`);
  });

  it("links to notification settings in the footer", () => {
    const html = renderNotificationEmailHtml(
      contentFor(scheduleNotificationEvents.reminder1h),
      siteUrl,
    );

    expect(html).toContain(`href="${siteUrl}/settings/notifications"`);
  });

  it("ships both parts on every built email", () => {
    const email = buildScheduleNotificationEmail({
      eventName: "Fall GBM",
      eventType: scheduleNotificationEvents.schedulePublished,
      recipient,
      timezone: "America/New_York",
    });

    expect(email.html).toContain("<!doctype html>");
    expect(email.html).toContain("America/New_York");
    expect(email.body).toContain("America/New_York");
    expect(email.body).not.toContain("<");
  });
});
