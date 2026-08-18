import { forwardRef, type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border border-hairline bg-elevated text-text-secondary",
        purple: "border border-accent-go/40 bg-accent-go/10 text-accent-go",
        warning: "border border-accent-warn/40 bg-accent-warn/10 text-accent-warn",
        danger: "border border-accent-warn/40 bg-accent-warn/10 text-accent-warn",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export type NeuBadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

/** Quiet chip for event/role/status labels (e.g. "organizer", "draft", "swap_pending"). Outline treatment only, no solid fills. */
export const NeuBadge = forwardRef<HTMLSpanElement, NeuBadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
  ),
);
NeuBadge.displayName = "NeuBadge";
export { badgeVariants };
