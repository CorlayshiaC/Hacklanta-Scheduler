"use client";

import { forwardRef, useId } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { cn } from "@/lib/utils/cn";

export type NeuSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type NeuSelectProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: NeuSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  name?: string;
  className?: string;
  id?: string;
};

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
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
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="text-purple-400">
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
 * Flat controlled dropdown over @radix-ui/react-select. Deliberately hides the compound API
 * (Root/Trigger/Item/...) behind a single options array so callers don't have to assemble it.
 */
export const NeuSelect = forwardRef<HTMLButtonElement, NeuSelectProps>(
  (
    {
      value,
      defaultValue,
      onValueChange,
      options,
      placeholder = "Select…",
      disabled,
      name,
      className,
      id,
    },
    ref,
  ) => {
    const generatedId = useId();
    const triggerId = id ?? generatedId;

    return (
      <SelectPrimitive.Root
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        disabled={disabled}
        name={name}
      >
        <SelectPrimitive.Trigger
          ref={ref}
          id={triggerId}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-neu-sm border border-hairline bg-bg-sunken px-3 text-sm text-text-secondary shadow-neu-pressed outline-none",
            "transition-[box-shadow,color] duration-fast ease-neu-out",
            "focus-visible:shadow-neu-focus",
            "disabled:pointer-events-none disabled:opacity-50",
            className,
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
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
              "overflow-hidden rounded-neu-sm border border-hairline bg-bg-surface text-text-primary shadow-neu-floating",
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
                    "relative flex cursor-pointer select-none items-center rounded-neu-sm py-2 pl-8 pr-3 text-sm outline-none",
                    "text-text-secondary data-[state=checked]:text-text-primary",
                    "data-[highlighted]:bg-bg-sunken data-[highlighted]:text-text-primary",
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
NeuSelect.displayName = "NeuSelect";
