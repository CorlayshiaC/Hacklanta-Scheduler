"use client";

import { Children, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useEntranceCascade } from "@/lib/utils/motion";

/**
 * Entrance choreography for the notifications settings page: header, then each control block,
 * cascading at stagger-standard. This was the only settings sub-page with no motion anywhere in its
 * component graph, because its three controls (NotificationToggles, PushNotificationToggle,
 * SoundToggle) are all plain server-rendered forms, unlike profile-form/roles-table/
 * organization-form/invite-links-panel, which animate themselves.
 *
 * Wrapping here rather than in the shared settings layout on purpose: the other four sub-pages
 * already run their own entrances, so a layout-level cascade would animate them twice, which motion
 * spec law 2 and the "one entrance" rule both forbid. This stays scoped to the page that is
 * actually missing one.
 *
 * Kept as a colocated client component rather than a shared primitive: it claims no shared API, and
 * new shared motion components belong to Agent 1's preset layer, not to a feature folder.
 *
 * stagger-standard (the 40ms default), not stagger-tight: these are card-sized sections, and
 * stagger-tight is the cadence for chips and dense rows.
 */
export function NotificationsCascade({ children }: { children: ReactNode }) {
  const cascade = useEntranceCascade();

  return (
    <motion.div
      animate="visible"
      className="flex flex-col gap-6"
      initial="hidden"
      variants={cascade.container}
    >
      {Children.map(children, (child) => (
        <motion.div variants={cascade.item}>{child}</motion.div>
      ))}
    </motion.div>
  );
}
