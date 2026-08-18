"use client";

import { useCallback, useEffect, useState } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { Skeleton } from "@/components/ui/skeleton";
import { getNotificationLabel } from "@/components/notifications/utils";
import { scheduleNotificationEvents } from "@/lib/notifications/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils/cn";
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
 *
 * STUB(agent-1): the card shell and toggle below are hand-styled to the pill/bento palette on raw
 * Radix Switch primitives, mirroring the same STUB(agent-1) pattern already used in
 * src/components/settings/notification-toggles.tsx (Agent 5), since components/ui hasn't published
 * Card/Toggle yet. Swap both for the real primitives once they ship; see docs/contracts/pending.md.
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
        <Skeleton className="h-16 w-full !rounded-2xl !bg-[#1E1E1E] !shadow-none" />
        <Skeleton className="h-16 w-full !rounded-2xl !bg-[#1E1E1E] !shadow-none" />
        <Skeleton className="h-16 w-full !rounded-2xl !bg-[#1E1E1E] !shadow-none" />
        <Skeleton className="h-16 w-full !rounded-2xl !bg-[#1E1E1E] !shadow-none" />
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="rounded-2xl bg-[#1E1E1E] p-4 text-sm text-[#FF9F2E]">
        Could not load notification preferences.
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/[0.08] rounded-[24px] bg-[#131313]">
      {KINDS.map((kind) => {
        const channels = state[kind] ?? { email: true, in_app: true };
        const rowError = rowErrors[`${kind}:email`] ?? rowErrors[`${kind}:in_app`];

        return (
          <div
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            key={kind}
          >
            <div className="flex flex-col gap-1">
              <span className="text-sm text-[#F5F5F5]">{getNotificationLabel(kind)}</span>
              {rowError ? <span className="text-xs text-[#FF9F2E]">{rowError}</span> : null}
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-xs text-[#9A9A9A]">
                Email
                <PillToggle
                  aria-label={`Email for ${getNotificationLabel(kind)}`}
                  checked={channels.email}
                  onCheckedChange={() => void toggle(kind, "email")}
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-[#9A9A9A]">
                In-app
                <PillToggle
                  aria-label={`In-app for ${getNotificationLabel(kind)}`}
                  checked={channels.in_app}
                  onCheckedChange={() => void toggle(kind, "in_app")}
                />
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PillToggle({
  "aria-label": ariaLabel,
  checked,
  onCheckedChange,
}: {
  "aria-label": string;
  checked: boolean;
  onCheckedChange: () => void;
}) {
  return (
    <SwitchPrimitive.Root
      aria-label={ariaLabel}
      checked={checked}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-white/[0.08] px-0.5 outline-none transition-colors duration-150 ease-out",
        "focus-visible:ring-2 focus-visible:ring-[#A78BFA]",
        checked ? "bg-[#A78BFA]" : "bg-[#1E1E1E]",
      )}
      onCheckedChange={onCheckedChange}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "block h-3.5 w-3.5 rounded-full bg-white transition-transform duration-150 ease-out motion-reduce:transition-none",
          checked ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </SwitchPrimitive.Root>
  );
}
