"use client";

import { useCallback, useEffect, useState } from "react";
import { NeuCard } from "@/components/ui/neu-card";
import { NeuToggle } from "@/components/ui/neu-toggle";
import { NeuWell } from "@/components/ui/neu-well";
import { Skeleton } from "@/components/ui/skeleton";
import { getNotificationLabel } from "@/components/notifications/utils";
import { scheduleNotificationEvents } from "@/lib/notifications/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { TablesInsert } from "@/types/database";

type Channel = "email" | "in_app";

type ChannelState = Record<string, { email: boolean; in_app: boolean }>;

type LoadState = "loading" | "ready" | "error";

// Same select-string inference workaround as src/app/(app)/settings/notifications/page.tsx and
// src/lib/auth/authorization.ts: this client's generated types don't resolve a select() result to
// a concrete row type for this table, so the response is cast to this local shape instead.
type NotificationPreferenceRow = { kind: string; channel: string; enabled: boolean };

// The kind list is a fixed compile-time constant (scheduleNotificationEvents), never empty, so
// there is no "no preferences to show" empty state to design for here, unlike notification-list's
// "No notifications yet." (a genuinely variable, often-zero list).
const KINDS: string[] = Object.values(scheduleNotificationEvents);

function defaultState(): ChannelState {
  return Object.fromEntries(KINDS.map((kind) => [kind, { email: true, in_app: true }]));
}

/**
 * Settings-screen component: two toggles (email, in-app) per notification kind. A kind/channel with
 * no stored row renders as "on", matching notification_preferences' opt-out default (see
 * docs/contracts/schema.md). Reads and writes go straight through the browser client, scoped to the
 * signed-in profile by RLS (a profile can only read/write its own rows).
 */
export function NotificationPreferences() {
  const [userId, setUserId] = useState<string | null>(null);
  const [state, setState] = useState<ChannelState>(defaultState);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadState("loading");
      const supabase = createSupabaseBrowserClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) setLoadState("error");
        return;
      }

      const { data, error } = await supabase
        .from("notification_preferences")
        .select("kind, channel, enabled")
        // RLS already scopes this to the caller's own rows; filtered explicitly too, same as
        // notification-bell.tsx's load().
        .eq("profile_id", user.id);

      if (cancelled) return;

      if (error) {
        setLoadState("error");
        return;
      }

      const rows = (data as NotificationPreferenceRow[] | null) ?? [];
      const next = defaultState();
      for (const row of rows) {
        if (row.channel !== "email" && row.channel !== "in_app") continue;
        if (!next[row.kind]) next[row.kind] = { email: true, in_app: true };
        next[row.kind][row.channel] = row.enabled;
      }

      setUserId(user.id);
      setState(next);
      setLoadState("ready");
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(
    async (kind: string, channel: Channel) => {
      if (!userId) return;

      const current = state[kind] ?? { email: true, in_app: true };
      const nextEnabled = !current[channel];
      const previous = state;
      const errorKey = `${kind}:${channel}`;

      setState((prev) => ({ ...prev, [kind]: { ...current, [channel]: nextEnabled } }));
      setRowErrors((prev) => {
        if (!(errorKey in prev)) return prev;
        const next = { ...prev };
        delete next[errorKey];
        return next;
      });

      const supabase = createSupabaseBrowserClient();
      const row: TablesInsert<"notification_preferences"> = {
        profile_id: userId,
        kind,
        channel,
        enabled: nextEnabled,
      };
      // Cast matches the established workaround for this Supabase client's mutation-argument
      // inference used throughout the codebase (e.g. src/lib/settings/notification-actions.ts):
      // without it, .upsert()'s argument type collapses to `never`.
      const { error } = await supabase
        .from("notification_preferences")
        .upsert(row as never, { onConflict: "profile_id,kind,channel" });

      if (error) {
        setState(previous);
        setRowErrors((prev) => ({ ...prev, [errorKey]: "Could not save. Try again." }));
      }
    },
    [state, userId],
  );

  if (loadState === "loading") {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <NeuWell className="text-sm text-danger">Could not load notification preferences.</NeuWell>
    );
  }

  return (
    <NeuCard className="divide-y divide-hairline" padded={false}>
      {KINDS.map((kind) => {
        const channels = state[kind] ?? { email: true, in_app: true };
        const rowError = rowErrors[`${kind}:email`] ?? rowErrors[`${kind}:in_app`];

        return (
          <div
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            key={kind}
          >
            <div className="flex flex-col gap-1">
              <span className="text-sm text-text-primary">{getNotificationLabel(kind)}</span>
              {rowError ? <span className="text-xs text-danger">{rowError}</span> : null}
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-xs text-text-secondary">
                Email
                <NeuToggle
                  aria-label={`Email for ${getNotificationLabel(kind)}`}
                  checked={channels.email}
                  onCheckedChange={() => void toggle(kind, "email")}
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-text-secondary">
                In-app
                <NeuToggle
                  aria-label={`In-app for ${getNotificationLabel(kind)}`}
                  checked={channels.in_app}
                  onCheckedChange={() => void toggle(kind, "in_app")}
                />
              </label>
            </div>
          </div>
        );
      })}
    </NeuCard>
  );
}
