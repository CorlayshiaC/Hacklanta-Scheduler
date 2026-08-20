"use client";

import { Children, type ReactNode } from "react";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEntranceCascade } from "@/lib/utils/motion";

export type PageEntranceProps = {
  children: ReactNode;
  /** Cadence between regions. Defaults to stagger-standard, correct for card-sized blocks. */
  staggerMs?: number;
  className?: string;
};

/**
 * Landing choreography for an ordinary page: each direct child is a region that rises in, one
 * stagger apart. Pass a page's header and sections as separate children and they cascade in source
 * order; pass a single child and it is a plain rise-in.
 *
 * Why this exists: several live pages (availability, open shifts, swaps, every settings sub-page)
 * had no landing animation at all. They were not caught by an import-graph audit because their
 * component trees do import motion, just for internal things like cell painting or a sheet
 * transition, never for the page arriving. Importing a preset is not the same as having an
 * entrance, which is exactly the gap this closes.
 *
 * Keyed on the pathname so the cascade re-runs once per navigation and never on a re-render or a
 * data refresh (motion spec law 2). That keying is also what makes this safe to mount in a layout:
 * a layout persists across sibling routes, so without the key a settings sub-page swap would land
 * with no animation at all.
 *
 * Deliberately not doing shared-element morphs or bespoke per-region delays. A page that deserves a
 * hand-choreographed timeline (the dashboard, section 3 of the motion spec) should keep writing its
 * own explicit regions; this is the default for everything else.
 *
 * Proposed addition to Agent 1's preset layer rather than a claim on it: it composes their
 * useEntranceCascade and adds no new motion values. Absorb, rename, or relocate it freely, see
 * docs/contracts/requests.md.
 */
export function PageEntrance({ children, staggerMs, className }: PageEntranceProps) {
  const pathname = usePathname();
  const cascade = useEntranceCascade(staggerMs);

  return (
    <motion.div
      animate="visible"
      className={className}
      initial="hidden"
      key={pathname}
      variants={cascade.container}
    >
      {Children.map(children, (child) =>
        child == null ? child : <motion.div variants={cascade.item}>{child}</motion.div>,
      )}
    </motion.div>
  );
}
