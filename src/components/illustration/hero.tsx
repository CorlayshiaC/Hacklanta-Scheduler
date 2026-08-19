import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { AuroraWash } from "./aurora-wash";
import { FloatShapes } from "./float-shapes";

export type HeroProps = {
  children: ReactNode;
  className?: string;
  /** The full aurora-wash-plus-floating-shapes treatment. Off by default in V4: "no decorative
   * shapes anywhere except the sign-in page. Hero treatment elsewhere is typography plus the
   * canvas tint" (docs/contracts/design.md). Sign-in/join (Agent 5) are the only call sites that
   * should pass `wash` and `shapes` true; everywhere else, mount Hero for its typography and
   * layout only, and the ambient canvas tint (already global, see globals.css) supplies the
   * "atmosphere" without a per-component gradient layer. */
  wash?: boolean;
  shapes?: boolean;
  shapeCount?: 3 | 4 | 5;
};

/**
 * A content slot in a flat card, optionally framed with AuroraWash + FloatShapes for the one
 * cinematic exception (sign-in/join). One hero per page regardless of which mode is used, never
 * mounted behind a dense data surface (a coverage board, a table).
 */
export function Hero({ children, className, wash = false, shapes = false, shapeCount = 5 }: HeroProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-card border border-hairline bg-surface-card p-8 shadow-soft md:p-12",
        className,
      )}
    >
      {wash ? <AuroraWash /> : null}
      {shapes ? <FloatShapes count={shapeCount} /> : null}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
