import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type NeuWellProps = HTMLAttributes<HTMLDivElement> & {
  size?: "sm" | "md";
  padded?: boolean;
};

/** Static inset container, the pressed-surface counterpart to NeuCard (e.g. grouping form fields, quiet summary blocks). */
export const NeuWell = forwardRef<HTMLDivElement, NeuWellProps>(
  ({ className, size = "md", padded = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "border border-hairline bg-bg-sunken text-text-primary shadow-neu-pressed",
        size === "sm" ? "rounded-neu-sm" : "rounded-neu",
        padded && "p-4",
        className,
      )}
      {...props}
    />
  ),
);
NeuWell.displayName = "NeuWell";
