"use client";

import { useEffect, useState } from "react";
import { NeuToggle } from "@/components/ui/neu-toggle";

/**
 * The permission ask itself is real (Notification.requestPermission(), only ever fired from this
 * explicit toggle, never on load, per the V2 brief). What happens after permission is granted is
 * STUB(agent-2): there is no push_subscriptions table, no VAPID key pair, and no
 * pushManager.subscribe() server endpoint yet (see docs/contracts/schema-requests.md), so a grant
 * here does not yet register a real subscription. Reflects that honestly with a caption rather
 * than pretending the toggle is fully wired.
 */
export function PushNotificationToggle() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    // Server always renders "default" (no Notification global), reading the real permission only
    // after mount, same sanctioned exception sound-manager.tsx uses for localStorage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPermission("Notification" in window ? Notification.permission : "unsupported");
  }, []);

  async function handleCheckedChange(next: boolean) {
    if (!next || permission !== "default") {
      return;
    }

    const result = await Notification.requestPermission();
    setPermission(result);
  }

  if (permission === "unsupported") {
    return null;
  }

  return (
    <div className="flex flex-col gap-1 rounded-card bg-surface-elevated px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-text-primary">Push notifications</span>
        <NeuToggle
          checked={permission === "granted"}
          disabled={permission === "denied"}
          onCheckedChange={handleCheckedChange}
        />
      </div>
      <p className="text-xs text-text-secondary">
        {permission === "denied"
          ? "Blocked in your browser settings. Re-enable there to turn this on."
          : permission === "granted"
            ? "Reminder delivery is not wired up yet, this just confirms the browser permission."
            : "Reminders (day-before, schedule published) once wired up."}
      </p>
    </div>
  );
}
