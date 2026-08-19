"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useHeroEntrance } from "@/lib/utils/motion";

/**
 * entrance-rise-large (motion-spec.md section 1, "heroes only"): 16px rise on spring-gentle, once
 * per navigation. `Hero`'s own children slot has no opinion on entrance, this is the one-time
 * choreography a feature page wraps around it (mirrors the dashboard hero's `useHeroEntrance()`,
 * per docs/contracts/design.md's "an event header" being an explicitly hero-eligible surface).
 */
export function HeroEntrance({ children }: { children: ReactNode }) {
  const { transition, variants } = useHeroEntrance();

  return (
    <motion.div animate="visible" initial="hidden" transition={transition} variants={variants}>
      {children}
    </motion.div>
  );
}
