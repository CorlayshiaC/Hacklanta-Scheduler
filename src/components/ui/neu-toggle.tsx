"use client";

import { forwardRef } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils/cn";

export type NeuToggleProps = SwitchPrimitive.SwitchProps;

/**
 * Track is flat bg-elevated at rest; checked state fills the track solid accent-go. Thumb stays a
 * solid white pill in both states (no shadows anywhere, depth comes from tonal steps only).
 */
export const NeuToggle = forwardRef<HTMLButtonElement, NeuToggleProps>(
  ({ className, ...props }, ref) => (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-hairline bg-elevated px-1 outline-none",
        "transition-[background-color,border-color,transform] duration-fast ease-neu-out motion-reduce:transition-none",
        "active:scale-[0.97]",
        "focus-visible:shadow-focus-ring",
        "data-[state=checked]:border-accent-go data-[state=checked]:bg-accent-go",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-pill-white",
          "translate-x-0 transition-transform duration-fast ease-neu-out motion-reduce:transition-none",
          "data-[state=checked]:translate-x-5",
        )}
      />
    </SwitchPrimitive.Root>
  ),
);
NeuToggle.displayName = "NeuToggle";
