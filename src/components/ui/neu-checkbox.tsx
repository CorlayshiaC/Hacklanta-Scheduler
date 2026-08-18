"use client";

import { forwardRef } from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { cn } from "@/lib/utils/cn";

export type NeuCheckboxProps = CheckboxPrimitive.CheckboxProps;

/**
 * Unchecked is flat bg-elevated; checked/indeterminate fill solid accent-go with an on-accent
 * glyph (checkmark or dash), no shadows. The Indicator's own data-state (mirrored by Radix
 * regardless of controlled/uncontrolled usage) picks which glyph renders, since `checked` isn't
 * reliably readable from props alone in uncontrolled mode.
 */
export const NeuCheckbox = forwardRef<HTMLButtonElement, NeuCheckboxProps>(
  ({ className, ...props }, ref) => (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "peer inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[8px] border border-hairline bg-elevated outline-none",
        "transition-[background-color,border-color,transform] duration-fast ease-neu-out motion-reduce:transition-none",
        "active:scale-[0.97]",
        "focus-visible:shadow-focus-ring",
        "data-[state=checked]:border-accent-go data-[state=checked]:bg-accent-go",
        "data-[state=indeterminate]:border-accent-go data-[state=indeterminate]:bg-accent-go",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="group flex items-center justify-center text-on-accent" forceMount>
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
