"use client";

import { forwardRef } from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { cn } from "@/lib/utils/cn";

export type NeuCheckboxProps = CheckboxPrimitive.CheckboxProps;

/**
 * Unchecked is a pressed well; checked/indeterminate switch to a raised surface with a purple-400
 * outline and mark (checkmark or dash), never a solid purple fill. The Indicator's own data-state
 * (mirrored by Radix regardless of controlled/uncontrolled usage) picks which glyph renders, since
 * `checked` isn't reliably readable from props alone in uncontrolled mode.
 */
export const NeuCheckbox = forwardRef<HTMLButtonElement, NeuCheckboxProps>(
  ({ className, ...props }, ref) => (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "peer inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border border-hairline bg-bg-sunken shadow-neu-pressed outline-none",
        "transition-[box-shadow,background-color,border-color] duration-fast ease-neu-out",
        "focus-visible:shadow-neu-focus",
        "data-[state=checked]:border-purple-400/50 data-[state=checked]:bg-bg-surface data-[state=checked]:shadow-neu-raised-sm",
        "data-[state=indeterminate]:border-purple-400/50 data-[state=indeterminate]:bg-bg-surface data-[state=indeterminate]:shadow-neu-raised-sm",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="group flex items-center justify-center text-purple-400" forceMount>
        <svg
          aria-hidden="true"
          width="11"
          height="11"
          viewBox="0 0 11 11"
          fill="none"
          className="hidden group-data-[state=checked]:block"
        >
          <path
            d="M1.75 5.6L4.2 8.25L9.25 2.75"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <svg
          aria-hidden="true"
          width="11"
          height="11"
          viewBox="0 0 11 11"
          fill="none"
          className="hidden group-data-[state=indeterminate]:block"
        >
          <path d="M2 5.5H9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  ),
);
NeuCheckbox.displayName = "NeuCheckbox";
