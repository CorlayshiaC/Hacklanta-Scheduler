"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useMotionPreset } from "@/lib/utils/motion";

/**
 * pageTransition fallback for a hard navigation a shared-element morph can't cross (an event card
 * linking to its full event page is a real route change, not a client-side panel swap). Per
 * docs/contracts/design.md's morphTo entry: "Where routing prevents a true layoutId morph, fall
 * back to useMotionPreset's pageTransition instead."
 */
export function PageFadeIn({ children }: { children: ReactNode }) {
  const { variants, transition } = useMotionPreset();

  return (
    <motion.div animate="visible" initial="hidden" transition={transition} variants={variants}>
      {children}
    </motion.div>
  );
}
