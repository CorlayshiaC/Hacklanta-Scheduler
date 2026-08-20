"use client";

import { useState } from "react";
import { NeuToggle } from "@/components/ui/neu-toggle";

type NotificationKind = { key: string; value: string };

type ChannelState = Record<string, { email: boolean; inApp: boolean }>;

function humanizeKind(key: string): string {
  const withSpaces = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  const lower = withSpaces.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

type NotificationTogglesProps = {
  kinds: NotificationKind[];
  initialState: ChannelState;
  onToggle: (input: { kind: string; channel: "email" | "in_app"; enabled: boolean }) => Promise<void>;
};

// Backed by notification_preferences (supabase/migrations/20260816130800_notification_preferences.sql).
// A missing row means "enabled" (the table default), so initialState is pre-filled with true for
// every kind/channel that has no row yet, see src/app/(app)/settings/notifications/page.tsx.
export function NotificationToggles({ kinds, initialState, onToggle }: NotificationTogglesProps) {
  const [state, setState] = useState<ChannelState>(initialState);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function toggle(key: string, channel: "email" | "inApp") {
    const dbChannel = channel === "inApp" ? "in_app" : "email";
    const current = state[key] ?? { email: true, inApp: true };
    const nextEnabled = !current[channel];

    // Optimistic update, reverted if the write fails.
    setState((prev) => ({ ...prev, [key]: { ...current, [channel]: nextEnabled } }));
    setErrorKey(null);

    try {
      await onToggle({ kind: key, channel: dbChannel, enabled: nextEnabled });
    } catch {
      setState((prev) => ({ ...prev, [key]: current }));
      setErrorKey(key);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {kinds.map((kind) => {
        const channels = state[kind.key] ?? { email: true, inApp: true };

        return (
          <div
            className="flex flex-col gap-2 rounded-card bg-surface-elevated px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            key={kind.key}
          >
            <div className="flex flex-col gap-1">
              <span className="text-[13px] text-text-primary">{humanizeKind(kind.key)}</span>
              {errorKey === kind.key ? (
                <span className="text-xs text-accent-warn">Could not save. Try again.</span>
              ) : null}
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-[13px] text-text-secondary">
                Email
                <NeuToggle checked={channels.email} onCheckedChange={() => toggle(kind.key, "email")} />
              </label>
              <label className="flex items-center gap-2 text-[13px] text-text-secondary">
                In-app
                <NeuToggle checked={channels.inApp} onCheckedChange={() => toggle(kind.key, "inApp")} />
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}
