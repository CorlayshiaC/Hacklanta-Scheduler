"use client";

import { forwardRef } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils/cn";

export type NeuToggleProps = SwitchPrimitive.SwitchProps;

/**
 * Track is a pressed well at rest; checked state tints the track with purple-400 and lifts the
 * thumb (shadow-neu-raised-sm) rather than filling anything solid purple.
 */
export const NeuToggle = forwardRef<HTMLButtonElement, NeuToggleProps>(
  ({ className, ...props }, ref) => (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-hairline bg-bg-sunken px-1 shadow-neu-pressed outline-none",
        "transition-colors duration-fast ease-neu-out",
        "focus-visible:shadow-neu-focus",
        "data-[state=checked]:border-purple-400/50 data-[state=checked]:bg-purple-400/10",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-bg-surface",
          "translate-x-0 transition-transform duration-fast ease-neu-out motion-reduce:transition-none",
          "data-[state=checked]:translate-x-5 data-[state=checked]:shadow-neu-raised-sm data-[state=checked]:ring-1 data-[state=checked]:ring-purple-400/60",
        )}
      />
    </SwitchPrimitive.Root>
  ),
);
NeuToggle.displayName = "NeuToggle";
