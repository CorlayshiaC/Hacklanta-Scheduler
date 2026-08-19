"use client";

import { forwardRef } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils/cn";

export type NeuToggleProps = SwitchPrimitive.SwitchProps;

/**
 * Track is glass bg-elevated at rest; checked state fills the track solid accent-primary. Thumb is
 * a literal white knob (bg-white, not the pill-white token, which now aliases accent-primary) so
 * it never disappears into a purple track: this is a physical switch affordance, not a semantic
 * selection pill, see tailwind.config.ts's pill-white comment.
 */
export const NeuToggle = forwardRef<HTMLButtonElement, NeuToggleProps>(
  ({ className, ...props }, ref) => (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-hairline bg-surface-elevated px-1 outline-none backdrop-blur-glass",
        "transition-[background-color,border-color,transform] duration-fast ease-neu-out motion-reduce:transition-none",
        "active:scale-[0.97]",
        "focus-visible:shadow-focus-ring",
        "data-[state=checked]:border-accent-primary data-[state=checked]:bg-accent-primary",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-soft",
          "translate-x-0 transition-transform duration-fast ease-neu-out motion-reduce:transition-none",
          "data-[state=checked]:translate-x-5",
        )}
      />
    </SwitchPrimitive.Root>
  ),
);
NeuToggle.displayName = "NeuToggle";
