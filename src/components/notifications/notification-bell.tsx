"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { NotificationList } from "@/components/notifications/notification-list";
import { isArrivingBatch, type NotificationRow } from "@/components/notifications/utils";
import { SPRING_TRANSITION } from "@/lib/utils/motion";

/**
 * Motion spec v4.1 section 2 ("Notification panel") sets the page size's ceiling indirectly: law 6
 * caps un-capped cascades at 30 items. At 20 this list never reaches that threshold, so the plain
 * staggerChildren cascade in notification-list.tsx is correct as-is. Raising this above 30 requires
 * the capped-cascade preset requested from Agent 1 in docs/contracts/requests.md first.
 */
const PAGE_SIZE = 20;

/** Motion spec v4.1 section 2: a single 8-degree tilt-and-return when a new notification lands. */
const BELL_TILT_DEGREES = 8;

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
  // Imported here rather than at module scope on purpose. This component is mounted from
  // src/app/(app)/layout.tsx, so a static import puts @supabase/ssr + @supabase/auth-js (~220 KB
  // parsed, measured in docs/perf-baseline.md) into the client graph of every authenticated route,
  // to render an unread badge. This function is already only ever called from inside an async
  // effect, so awaiting the import here costs nothing on the render path and moves the SDK into a
  // chunk fetched after first paint.
  const { createSupabaseBrowserClient } = await import("@/lib/supabase/browser");
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
 * Self-contained bell trigger + popover for the notification center. Drop it into TopBar's
 * notificationSlot (src/components/layout/topbar.tsx, Agent 1's file) and it needs nothing else.
 *
 * V3: every visual decision here now comes from Agent 1's primitives and semantic tokens. The
 * previous version reached around them with `!`-prefixed overrides and literal hexes because the
 * pill/bento primitives had not shipped yet; they have, so this file carries no colors, no glass,
 * and no shadows of its own, and it repainted into the aurora/midnight glass look for free.
 *
 * v4.1 motion (section 2, "Notification panel"): the panel slides in 16px from the right edge, its
 * rows cascade at stagger-tight (notification-list.tsx), and the bell tilts once per arriving
 * batch. Both the slide and the tilt currently run on Agent 1's single published SPRING_TRANSITION;
 * the spec's three-spring layer (spring-snap for the tilt, spring-standard for the panel) is not
 * published yet, so those two call sites are marked and will retarget in one line each. See
 * docs/contracts/requests.md.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const bellControls = useAnimationControls();
  const reducedMotion = useReducedMotion();
  /** null until the first successful load, so the initial fetch never reads as an arrival. */
  const lastSeenUnreadRef = useRef<number | null>(null);

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

  /**
   * Refresh every time the panel opens, so a notification that arrived since mount isn't missed.
   *
   * This deliberately does NOT flip back to "loading". Motion law 2: entrances fire once per
   * navigation, never on a data refresh. Showing the skeleton here unmounted NotificationList and
   * remounted it when the refresh resolved, which replayed the whole row cascade a second time
   * inside a single panel open, on every open. Rows now update in place under the cascade root that
   * mounted with the panel, so the entrance runs exactly once per open and only genuinely new rows
   * animate in. A failed background refresh keeps the rows already on screen rather than replacing
   * a working panel with an error.
   */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function run() {
      const result = await fetchNotifications();
      if (cancelled) return;
      if (!result.ok) {
        setLoadState((current) => (current === "ready" ? current : "error"));
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

  /**
   * One tilt per arriving batch, not per notification: this watches the unread count rather than
   * individual rows, so three notifications landing together produce a single tilt. Never fires on
   * the first load (an existing backlog is not an arrival) and never on a count going down, since
   * reading a notification is not an event worth animating. Silent under reduced motion, per law 5.
   */
  useEffect(() => {
    if (loadState !== "ready") return;

    const lastSeen = lastSeenUnreadRef.current;
    lastSeenUnreadRef.current = unreadCount;

    if (reducedMotion || !isArrivingBatch(lastSeen, unreadCount)) return;

    async function tilt() {
      // MARK(agent-1 v4.1): retarget both legs to spring-snap when the three-spring layer ships.
      await bellControls.start({ rotate: BELL_TILT_DEGREES }, SPRING_TRANSITION);
      await bellControls.start({ rotate: 0 }, SPRING_TRANSITION);
    }

    void tilt();
  }, [bellControls, loadState, reducedMotion, unreadCount]);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <IconButton
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
          className="relative"
          size="md"
          variant="neutral"
        >
          {/* Only the icon tilts, not the button: rotating the hit target would move the badge
              and the focus ring with it. */}
          <motion.span animate={bellControls} className="inline-flex">
            <BellIcon />
          </motion.span>
          {unreadCount > 0 ? (
            // The unread marker is the one accent on this control: solid accent-primary with
            // on-accent text, the same "approved/primary" purple every other surface uses, so an
            // unread count never reads as a warning.
            //
            // No count-up on this numeral (spec section 6 is about stat numerals): the tilt already
            // marks the arrival, and rolling digits inside a 16px chip would be a second signal for
            // one event.
            <span
              aria-hidden
              className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-accent-primary px-1 font-mono text-[10px] font-semibold leading-none tabular-nums text-on-accent"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </IconButton>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(92vw,22rem)] p-0" sideOffset={10}>
        {/*
          Spec section 2: the panel slides from the right edge 16px plus fade. Only the slide is
          here; the fade already comes from PopoverContent itself, and doubling it would visibly
          double-dip. Transform and opacity only, per law 1. Reduced motion starts at rest so there
          is no movement at all, leaving just the primitive's fade.
          MARK(agent-1 v4.1): retarget to spring-standard, and lift this into a shared panel/sheet
          entrance preset, since the palette and the change-request sheet want the same move.
        */}
        <motion.div
          animate={{ x: 0 }}
          initial={{ x: reducedMotion ? 0 : 16 }}
          transition={SPRING_TRANSITION}
        >
          <div className="border-b border-hairline px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Notifications
            </p>
          </div>

          <div className="max-h-96 overflow-y-auto p-2">
            {/*
              The skeleton is a first-load-only state now. Once rows exist they stay on screen
              through every background refresh, which is what keeps the row cascade from replaying
              (law 2); see the refresh effect above.
            */}
            {loadState === "loading" && notifications.length === 0 ? (
              <LoadingRows />
            ) : loadState === "error" ? (
              <div className="rounded-card bg-surface-elevated p-4 text-center text-sm text-accent-warn">
                Could not load notifications.
              </div>
            ) : (
              <NotificationList
                notifications={notifications}
                onNotificationsChange={setNotifications}
              />
            )}
          </div>
        </motion.div>
      </PopoverContent>
    </Popover>
  );
}

function LoadingRows() {
  return (
    <div aria-label="Loading notifications" className="flex flex-col gap-2 p-1" role="status">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
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
