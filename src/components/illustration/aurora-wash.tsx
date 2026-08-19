import { cn } from "@/lib/utils/cn";

export type AuroraWashProps = {
  className?: string;
};

/**
 * V4: purple-only wash, not a multi-hue aurora. "Purple is the atmosphere... orange and lime stay
 * rationed" (docs/contracts/design.md), so the old three-color V3 gradient is gone; this reads the
 * same single --canvas-tint token the ambient body background uses (globals.css), just layered
 * denser with a couple of blurred glow circles so it reads as a deliberate moment rather than the
 * faint ambient version behind ordinary content. Sign-in/join (Agent 5) is the only intended call
 * site in V4, see Hero's `wash` prop. Absolutely positioned to fill its nearest positioned
 * ancestor; the caller provides that ancestor with `relative overflow-hidden`.
 *
 * Static: FloatShapes (float-shapes.tsx) is the animated layer, kept separate so a caller that
 * wants the wash without motion can mount this alone.
 */
export function AuroraWash({ className }: AuroraWashProps) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(ellipse 80% 60% at 50% 0%, var(--canvas-tint), transparent 65%)",
        }}
      />
      <div
        className="absolute -left-1/4 -top-1/3 h-[70%] w-[70%] rounded-full opacity-70 blur-3xl"
        style={{ background: "var(--canvas-tint)" }}
      />
      <div
        className="absolute -right-1/4 top-0 h-[60%] w-[60%] rounded-full opacity-50 blur-3xl"
        style={{ background: "var(--canvas-tint)" }}
      />
    </div>
  );
}
