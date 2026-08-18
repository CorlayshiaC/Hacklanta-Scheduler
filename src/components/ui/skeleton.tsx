import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

/**
 * Flat placeholder for content that hasn't loaded yet. Size it from the caller via className,
 * e.g. "h-4 w-32".
 */
export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      aria-hidden
      className={cn("animate-pulse rounded-card bg-elevated motion-reduce:animate-none", className)}
      {...props}
    />
  ),
);
Skeleton.displayName = "Skeleton";
