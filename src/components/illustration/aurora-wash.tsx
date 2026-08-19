import { cn } from "@/lib/utils/cn";

export type AuroraWashProps = {
  className?: string;
};

/**
 * Layered gradient background for hero moments (dashboard hero, sign-in, event headers, big empty
 * states, per docs/contracts/design.md "Illustration system"). One component, both themes: reads
 * the same --aurora-stop-* tokens the ambient body wash uses (see globals.css), just denser and
 * with a blurred glow layer so it reads as a deliberate hero moment rather than the faint ambient
 * version behind ordinary content. Absolutely positioned to fill its nearest positioned ancestor;
 * the caller (typically Hero, below) provides that ancestor with `relative overflow-hidden`.
 *
 * Static: FloatShapes (float-shapes.tsx) is the animated layer, kept separate so a caller that
 * wants the wash without motion (e.g. behind a dense but still hero-flavored panel) can mount this
 * alone.
 */
export function AuroraWash({ className }: AuroraWashProps) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: [
            "radial-gradient(ellipse 70% 60% at 20% 0%, var(--aurora-stop-1), transparent 65%)",
            "radial-gradient(ellipse 60% 55% at 85% 10%, var(--aurora-stop-2), transparent 60%)",
            "radial-gradient(ellipse 65% 50% at 50% 100%, var(--aurora-stop-3), transparent 65%)",
          ].join(", "),
        }}
      />
      <div
        className="absolute -left-1/4 -top-1/3 h-[70%] w-[70%] rounded-full opacity-70 blur-3xl"
        style={{ background: "var(--aurora-stop-1)" }}
      />
      <div
        className="absolute -right-1/4 top-0 h-[60%] w-[60%] rounded-full opacity-60 blur-3xl"
        style={{ background: "var(--aurora-stop-2)" }}
      />
    </div>
  );
}
