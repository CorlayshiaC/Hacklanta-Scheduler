"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useMotionPreset } from "@/lib/utils/motion";

/**
 * Settles in whichever branch the server picked (invalid invite, not signed in, or signed in with
 * the name form) via the real pageTransition preset (10px rise, spring-standard). True
 * shared-element morphing between those three server-rendered branches isn't feasible without
 * moving the flow to client-side state, out of scope for this pass; this is a settle-in on the
 * resolved branch, not a real morph between branches, same scope limit as every prior pass.
 */
export function JoinPanel({ children }: { children: ReactNode }) {
  const { transition, variants } = useMotionPreset();

  return (
    <motion.div
      className="flex w-full flex-col items-center gap-6 text-center"
      initial="hidden"
      animate="visible"
      variants={variants}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}
