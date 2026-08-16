"use client";

import { useState } from "react";

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
    <div className="grid grid-cols-1 divide-y divide-white/5 rounded-xl border border-white/5">
      {kinds.map((kind) => {
        const channels = state[kind.key] ?? { email: true, inApp: true };

        return (
          <div
            className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
            key={kind.key}
          >
            <div className="flex flex-col gap-1">
              <span className="text-sm text-zinc-200">{humanizeKind(kind.key)}</span>
              {errorKey === kind.key ? (
                <span className="text-xs text-rose-400">Could not save. Try again.</span>
              ) : null}
            </div>
            <div className="flex items-center gap-4">
              <ToggleSwitch checked={channels.email} label="Email" onClick={() => toggle(kind.key, "email")} />
              <ToggleSwitch checked={channels.inApp} label="In-app" onClick={() => toggle(kind.key, "inApp")} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// STUB(agent-1): this hand rolled switch will be replaced by the real toggle primitive once
// components/ui publishes it. Deliberately not named NeuToggle, that name is reserved for
// Agent 1's eventual primitive.
function ToggleSwitch({
  checked,
  label,
  onClick,
}: {
  checked: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-zinc-500">
      {label}
      <button
        aria-checked={checked}
        className={`relative h-5 w-9 rounded-full border transition ${
          checked ? "border-violet-500 bg-violet-600" : "border-white/5 bg-black/30"
        }`}
        onClick={onClick}
        role="switch"
        type="button"
      >
        <span
          className={`block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-4" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );
}
