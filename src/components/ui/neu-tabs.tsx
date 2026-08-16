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
        "inline-flex items-center gap-1 rounded-neu-sm bg-bg-sunken p-1 shadow-neu-pressed",
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
        "rounded-neu-sm px-3 py-1.5 text-sm font-medium text-text-secondary outline-none",
        "transition-[background-color,box-shadow] duration-fast ease-neu-out",
        "focus-visible:shadow-neu-focus",
        "data-[state=active]:bg-bg-surface data-[state=active]:text-text-primary data-[state=active]:shadow-neu-raised-sm",
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
