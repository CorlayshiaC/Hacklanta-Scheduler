import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

/**
 * Pressed-well placeholder for content that hasn't loaded yet. Uses Tailwind's built-in
 * animate-pulse rather than a custom shimmer-sweep keyframe: a sweep would need either a
 * tailwind.config.ts addition (owned by Agent 1, not this file) or a module-scoped <style> tag,
 * which duplicates on every SSR render of this component. Pulse needs neither. Size it from the
 * caller via className, e.g. "h-4 w-32".
 */
export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      aria-hidden
      className={cn(
        "animate-pulse rounded-neu-sm bg-bg-sunken shadow-neu-pressed motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  ),
);
Skeleton.displayName = "Skeleton";
