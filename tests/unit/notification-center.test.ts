import { describe, expect, it } from "vitest";
import {
  getNotificationAccent,
  getNotificationLabel,
  isArrivingBatch,
} from "@/components/notifications/utils";
import { scheduleNotificationEvents } from "@/lib/notifications/types";

/**
 * Motion spec v4.1 section 2 and law 2. These are the notification center's behavioral motion
 * rules, kept testable by living in a pure helper rather than inside the component: Agent 6's
 * enforcement sweep checks "entrances replaying on re-render or Realtime updates", and the bell
 * tilt is the one place in this surface where a wrong answer is silent rather than visible.
 */
describe("bell tilt arrival detection", () => {
  it("stays still on the first load, however large the backlog", () => {
    expect(isArrivingBatch(null, 0)).toBe(false);
    expect(isArrivingBatch(null, 12)).toBe(false);
  });

  it("tilts once for a batch, not once per notification", () => {
    // Six landing together is one arrival event and therefore one tilt.
    expect(isArrivingBatch(0, 6)).toBe(true);
    expect(isArrivingBatch(2, 3)).toBe(true);
  });

  it("stays still when nothing changed, which is every re-render and empty refresh", () => {
    expect(isArrivingBatch(0, 0)).toBe(false);
    expect(isArrivingBatch(5, 5)).toBe(false);
  });

  it("stays still when the count drops, since reading is not an arrival", () => {
    expect(isArrivingBatch(3, 2)).toBe(false);
    expect(isArrivingBatch(3, 0)).toBe(false);
  });
});

describe("notification kind semantics", () => {
  it("agrees between the bell and the inbox on what counts as a warning", () => {
    expect(getNotificationAccent(scheduleNotificationEvents.shiftCancelled)).toBe("warn");
    expect(getNotificationAccent(scheduleNotificationEvents.changeRequestDeclined)).toBe("warn");
    expect(getNotificationAccent(scheduleNotificationEvents.assignmentApproved)).toBe("go");
    expect(getNotificationAccent(scheduleNotificationEvents.swapClaimed)).toBe("neutral");
  });

  it("humanizes an unmapped kind instead of leaking the stored string", () => {
    expect(getNotificationLabel(scheduleNotificationEvents.announcementPosted)).toBe("Announcement");
    expect(getNotificationLabel("SOME_FUTURE_KIND")).toBe("Some future kind");
  });
});
