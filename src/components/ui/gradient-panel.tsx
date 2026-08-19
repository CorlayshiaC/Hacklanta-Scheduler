import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type GradientPanelProps = HTMLAttributes<HTMLDivElement>;

/**
 * The one gradient panel allowed per view (docs/contracts/design.md "V4: precision instrument"):
 * deep purple range (--gradient-panel-from/to, both themes), faint glow allowed. Reserved for the
 * AI surface (Ask prog, Fill gaps) and nothing else, per the shared spec's glow-budget rule. Chips
 * placed inside it should use a 5px hairline outline (`border border-hairline bg-transparent`),
 * not a solid or tinted fill, to read as "inside the glow" rather than another surface stacked on
 * top of it.
 */
export const GradientPanel = forwardRef<HTMLDivElement, GradientPanelProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-card p-4 text-text-primary shadow-glow",
        "bg-[linear-gradient(155deg,var(--gradient-panel-from),var(--gradient-panel-to))]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
);
GradientPanel.displayName = "GradientPanel";
