"use client";

import { forwardRef, useId } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { cn } from "@/lib/utils/cn";

export type FilterPillOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type FilterPillProps = {
  label: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: FilterPillOption[];
  placeholder?: string;
  className?: string;
  id?: string;
};

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0 text-text-muted", className)}
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="text-accent-go">
      <path
        d="M11.5 3.5L5.5 10.5L2.5 7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * "Label: Value" filter capsule over @radix-ui/react-select. Same Portal/Content/Viewport/Item
 * structure as NeuSelect, used directly here rather than through NeuSelect's hidden-compound API
 * so the trigger can render the split label/value text instead of a single Value slot.
 */
export const FilterPill = forwardRef<HTMLButtonElement, FilterPillProps>(
  ({ label, value, defaultValue, onValueChange, options, placeholder, className, id }, ref) => {
    const generatedId = useId();
    const triggerId = id ?? generatedId;

    return (
      <SelectPrimitive.Root value={value} defaultValue={defaultValue} onValueChange={onValueChange}>
        <SelectPrimitive.Trigger
          ref={ref}
          id={triggerId}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-pill border border-hairline bg-elevated px-3.5 text-sm outline-none",
            "transition-[box-shadow,border-color,transform] duration-fast ease-neu-out",
            "focus-visible:shadow-focus-ring focus-visible:border-accent-go",
            "active:scale-[0.97] motion-reduce:transition-none",
            "disabled:pointer-events-none disabled:opacity-50",
            className,
          )}
        >
          <span className="text-text-secondary">{label}:</span>
          <SelectPrimitive.Value placeholder={placeholder ?? "All"} className="font-medium text-text-primary" />
          <SelectPrimitive.Icon>
            <ChevronIcon />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={6}
            className={cn(
              "z-50 min-w-[--radix-select-trigger-width] max-h-[--radix-select-content-available-height]",
              "overflow-hidden rounded-card border border-hairline bg-card text-text-primary",
            )}
          >
            <SelectPrimitive.ScrollUpButton className="flex items-center justify-center py-1 text-text-secondary">
              <ChevronIcon className="rotate-180" />
            </SelectPrimitive.ScrollUpButton>
            <SelectPrimitive.Viewport className="p-1">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-pill py-2 pl-8 pr-3 text-sm outline-none",
                    "text-text-secondary data-[state=checked]:text-text-primary",
                    "data-[highlighted]:bg-elevated data-[highlighted]:text-text-primary",
                    "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                  )}
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <SelectPrimitive.ItemIndicator>
                      <CheckIcon />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
            <SelectPrimitive.ScrollDownButton className="flex items-center justify-center py-1 text-text-secondary">
              <ChevronIcon />
            </SelectPrimitive.ScrollDownButton>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    );
  },
);
FilterPill.displayName = "FilterPill";
