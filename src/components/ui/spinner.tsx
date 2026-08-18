import { forwardRef, type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const spinnerVariants = cva("animate-spin text-accent-go motion-reduce:animate-none", {
  variants: {
    size: {
      sm: "h-4 w-4",
      md: "h-6 w-6",
      lg: "h-8 w-8",
    },
  },
  defaultVariants: { size: "md" },
});

export type SpinnerProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof spinnerVariants> & {
    /** Accessible name announced to screen readers. The SVG is aria-hidden, this is the only label. */
    label?: string;
  };

/**
 * Small rotating loading indicator: an SVG ring with a partial stroke (stroke-dasharray) spun via
 * animate-spin. The SVG carries no semantics of its own, so callers must supply an accessible
 * "label" (default "Loading"), rendered as sr-only text next to it.
 */
export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(
  ({ className, size, label = "Loading", ...props }, ref) => (
    <span ref={ref} className={cn("inline-flex items-center", className)} {...props}>
      <svg aria-hidden viewBox="0 0 24 24" fill="none" className={spinnerVariants({ size })}>
        <circle
          cx="12"
          cy="12"
          r="10"
          pathLength={100}
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="30 70"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  ),
);
Spinner.displayName = "Spinner";
