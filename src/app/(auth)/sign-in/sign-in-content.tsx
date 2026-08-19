"use client";

import { motion } from "framer-motion";
import { useHeroEntrance } from "@/lib/utils/motion";
import { ContinueWithGoogleButton } from "@/components/auth/continue-with-google-button";

export function SignInContent({ message, next }: { message: string | null; next?: string }) {
  const { transition, variants } = useHeroEntrance();

  return (
    <motion.div
      className="flex w-full flex-col items-center gap-4"
      initial="hidden"
      animate="visible"
      variants={variants}
      transition={transition}
    >
      <p className="font-display text-[20px] font-medium text-text-primary">progsu</p>
      {message ? <p className="text-[13px] text-accent-warn">{message}</p> : null}
      <div className="w-full max-w-xs">
        <ContinueWithGoogleButton next={next} />
      </div>
    </motion.div>
  );
}
