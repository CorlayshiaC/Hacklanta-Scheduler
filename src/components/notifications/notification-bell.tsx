"use client";

import { useEffect, useState } from "react";
import { NeuButton } from "@/components/ui/neu-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { NotificationList } from "@/components/notifications/notification-list";
import type { NotificationRow } from "@/components/notifications/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const PAGE_SIZE = 20;

type LoadState = "loading" | "ready" | "error";

type FetchResult = { ok: true; notifications: NotificationRow[] } | { ok: false };

/**
 * Pure data fetch, no state setting: kept outside the component so each effect below can call it
 * from a plain inline function without the loader itself being a dependency (a useCallback-wrapped
 * loader referenced from a useEffect is flagged by this repo's react-hooks/set-state-in-effect
 * lint rule as state-setting-inside-an-effect; an inline async function local to each effect is
 * not, matching the pattern src/components/notifications/notification-preferences.tsx already uses).
 */
async function fetchNotifications(): Promise<FetchResult> {
  const supabase = createSupabaseBrowserClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: true, notifications: [] };
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    // RLS already scopes select to the caller's own rows; filtering explicitly here too so this
    // query never silently depends on RLS alone to return the right rows.
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (error) {
    return { ok: false };
  }

  return { ok: true, notifications: data ?? [] };
}

/**
 * Self-contained bell trigger + popover for the notification center. Not wired into the app shell
 * yet (that slot doesn't exist), so this renders as a standalone floating trigger anywhere it's
 * mounted; whoever wires it in later can drop it into the header and it needs nothing else.
 *
 * STUB(agent-1): reuses NeuButton/PopoverContent/Skeleton for their behavior (Radix positioning,
 * focus handling) but forces their visual output to the new pill/bento palette via `!`-prefixed
 * overrides, since those primitives haven't been rebuilt yet. Exact hexes from the redesign brief,
 * not the old neu tokens. Drop the overrides once Card/IconButton ship. Logged in
 * docs/contracts/pending.md.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  // Load once on mount so the unread badge is correct before the panel is ever opened.
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoadState("loading");
      const result = await fetchNotifications();
      if (cancelled) return;
      if (!result.ok) {
        setLoadState("error");
        return;
      }
      setNotifications(result.notifications);
      setLoadState("ready");
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  // Refresh every time the panel opens, so a notification that arrived since mount isn't missed.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function run() {
      setLoadState("loading");
      const result = await fetchNotifications();
      if (cancelled) return;
      if (!result.ok) {
        setLoadState("error");
        return;
      }
      setNotifications(result.notifications);
      setLoadState("ready");
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const unreadCount = notifications.filter((notification) => notification.read_at === null).length;

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <NeuButton
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
          className="relative h-10 w-10 !rounded-full border border-white/[0.08] bg-transparent p-0 text-[#F5F5F5] hover:bg-[#1E1E1E] focus-visible:!shadow-none focus-visible:!ring-2 focus-visible:!ring-[#A78BFA] active:!shadow-none"
          size="md"
          variant="ghost"
        >
          <BellIcon />
          {unreadCount > 0 ? (
            <span
              aria-hidden
              className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#A78BFA] px-1 font-mono text-[10px] font-semibold leading-none tabular-nums text-[#0A0A0A]"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </NeuButton>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[min(92vw,22rem)] !rounded-[24px] border border-white/[0.08] !bg-[#131313] p-0 !shadow-none"
        sideOffset={10}
      >
        <div className="border-b border-white/[0.08] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#9A9A9A]">
            Notifications
          </p>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {loadState === "loading" ? (
            <LoadingRows />
          ) : loadState === "error" ? (
            <div className="rounded-2xl bg-[#1E1E1E] p-4 text-center text-sm text-[#FF9F2E]">
              Could not load notifications.
            </div>
          ) : (
            <NotificationList
              notifications={notifications}
              onNotificationsChange={setNotifications}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function LoadingRows() {
  return (
    <div aria-label="Loading notifications" className="flex flex-col gap-2 p-1" role="status">
      <Skeleton className="h-14 w-full !rounded-2xl !bg-[#1E1E1E] !shadow-none" />
      <Skeleton className="h-14 w-full !rounded-2xl !bg-[#1E1E1E] !shadow-none" />
      <Skeleton className="h-14 w-full !rounded-2xl !bg-[#1E1E1E] !shadow-none" />
      <Skeleton className="h-14 w-full !rounded-2xl !bg-[#1E1E1E] !shadow-none" />
    </div>
  );
}

function BellIcon() {
  return (
    <svg aria-hidden className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 3a5 5 0 0 0-5 5v3.2c0 .5-.16 1-.47 1.4L5 15h14l-1.53-2.4a2.4 2.4 0 0 1-.47-1.4V8a5 5 0 0 0-5-5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M9.5 18a2.5 2.5 0 0 0 5 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}
