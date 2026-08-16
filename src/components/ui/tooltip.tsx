"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ComponentRef } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils/cn";

export type TooltipProviderProps = ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>;

/** Wrap the app once; defaults delayDuration to 200ms so tooltips don't feel laggy. */
export function TooltipProvider({ delayDuration = 200, ...props }: TooltipProviderProps) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />;
}

export const Tooltip = TooltipPrimitive.Root;

export type TooltipTriggerProps = ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>;

export const TooltipTrigger = forwardRef<ComponentRef<typeof TooltipPrimitive.Trigger>, TooltipTriggerProps>(
  ({ className, ...props }, ref) => (
    <TooltipPrimitive.Trigger ref={ref} className={cn(className)} {...props} />
  ),
);
TooltipTrigger.displayName = TooltipPrimitive.Trigger.displayName;

export type TooltipContentProps = ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>;

export const TooltipContent = forwardRef<ComponentRef<typeof TooltipPrimitive.Content>, TooltipContentProps>(
  ({ className, sideOffset = 6, children, ...props }, ref) => (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "z-50 rounded-neu-sm border border-hairline bg-bg-surface px-2.5 py-1.5 text-xs text-text-secondary shadow-neu-floating outline-none",
          "data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-fast ease-neu-out motion-reduce:transition-none",
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="fill-bg-surface" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  ),
);
TooltipContent.displayName = TooltipPrimitive.Content.displayName;
