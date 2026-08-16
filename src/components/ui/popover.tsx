"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ComponentRef } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils/cn";

export const Popover = PopoverPrimitive.Root;

export type PopoverTriggerProps = ComponentPropsWithoutRef<typeof PopoverPrimitive.Trigger>;

export const PopoverTrigger = forwardRef<ComponentRef<typeof PopoverPrimitive.Trigger>, PopoverTriggerProps>(
  ({ className, ...props }, ref) => (
    <PopoverPrimitive.Trigger ref={ref} className={cn(className)} {...props} />
  ),
);
PopoverTrigger.displayName = PopoverPrimitive.Trigger.displayName;

export type PopoverContentProps = ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>;

export const PopoverContent = forwardRef<ComponentRef<typeof PopoverPrimitive.Content>, PopoverContentProps>(
  ({ className, sideOffset = 8, children, ...props }, ref) => (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "z-50 rounded-neu-sm border border-hairline bg-bg-surface p-4 text-text-primary shadow-neu-floating outline-none",
          "data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-fast ease-neu-out motion-reduce:transition-none",
          className,
        )}
        {...props}
      >
        {children}
        <PopoverPrimitive.Arrow className="fill-bg-surface" />
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  ),
);
PopoverContent.displayName = PopoverPrimitive.Content.displayName;
