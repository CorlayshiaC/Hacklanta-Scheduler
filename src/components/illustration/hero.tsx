import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { AuroraWash } from "./aurora-wash";
import { FloatShapes } from "./float-shapes";

export type HeroProps = {
  children: ReactNode;
  className?: string;
  /** Drop the floating shapes for a quieter hero; the aurora wash still shows. */
  shapes?: boolean;
  shapeCount?: 3 | 4 | 5;
};

/**
 * AuroraWash + FloatShapes + a content slot, glass-panel framed. One hero per page, per
 * docs/contracts/design.md "Restraint rules": the dashboard hero, sign-in, an event header, or a
 * big empty state, never more than one on a single view, and never mounted behind a dense data
 * surface (a coverage board, a table).
 */
export function Hero({ children, className, shapes = true, shapeCount = 5 }: HeroProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-card border border-hairline bg-surface-card p-8 shadow-soft backdrop-blur-glass md:p-12",
        className,
      )}
    >
      <AuroraWash />
      {shapes ? <FloatShapes count={shapeCount} /> : null}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
