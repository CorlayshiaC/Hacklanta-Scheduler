import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type NeuWellProps = HTMLAttributes<HTMLDivElement> & {
  size?: "sm" | "md";
  padded?: boolean;
};

/** Flat elevated container (e.g. grouping form fields, quiet summary blocks). bg-elevated, hairline border, no shadow. */
export const NeuWell = forwardRef<HTMLDivElement, NeuWellProps>(
  ({ className, size = "md", padded = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "border border-hairline bg-surface-elevated text-text-primary backdrop-blur-glass",
        size === "sm" ? "rounded-pill" : "rounded-card",
        padded && "p-4",
        className,
      )}
      {...props}
    />
  ),
);
NeuWell.displayName = "NeuWell";
