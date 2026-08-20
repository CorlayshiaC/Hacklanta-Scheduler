"use client";

import { forwardRef, type ElementRef, type ComponentPropsWithoutRef } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils/cn";

export const NeuTabs = TabsPrimitive.Root;

export type NeuTabsListProps = ComponentPropsWithoutRef<typeof TabsPrimitive.List>;

export const NeuTabsList = forwardRef<ElementRef<typeof TabsPrimitive.List>, NeuTabsListProps>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1 rounded-pill bg-elevated p-1",
        className,
      )}
      {...props}
    />
  ),
);
NeuTabsList.displayName = "NeuTabsList";

export type NeuTabsTriggerProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>;

export const NeuTabsTrigger = forwardRef<ElementRef<typeof TabsPrimitive.Trigger>, NeuTabsTriggerProps>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "rounded-pill px-3 py-1.5 text-sm font-medium text-text-secondary outline-none",
        "transition-[background-color,color,transform] duration-fast ease-neu-out motion-reduce:transition-none",
        "data-[state=inactive]:hover:text-text-primary",
        "active:scale-[0.97]",
        "focus-visible:shadow-focus-ring",
        "data-[state=active]:bg-pill-white data-[state=active]:text-on-accent",
        className,
      )}
      {...props}
    />
  ),
);
NeuTabsTrigger.displayName = "NeuTabsTrigger";

export type NeuTabsContentProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Content>;

export const NeuTabsContent = forwardRef<ElementRef<typeof TabsPrimitive.Content>, NeuTabsContentProps>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Content ref={ref} className={cn(className)} {...props} />
  ),
);
NeuTabsContent.displayName = "NeuTabsContent";
