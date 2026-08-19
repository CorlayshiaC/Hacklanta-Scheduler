"use client";

import { forwardRef, type HTMLAttributes, type SVGAttributes } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils/cn";

function XIcon(props: SVGAttributes<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;

export const DialogOverlay = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-surface-canvas/60 backdrop-blur-sm",
      "opacity-0 transition-opacity duration-base ease-neu-out motion-reduce:transition-none",
      "data-[state=open]:opacity-100 data-[state=closed]:opacity-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = "DialogOverlay";

export const DialogContent = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2",
        // "Floating layers (palette, dialogs): card surface on a dim scrim, hairline border; blur
        // allowed here only" (docs/contracts/design.md): dialogs are named explicitly, so unlike
        // every other panel in V4 (Popover, Tooltip, NeuWell, cards), this one keeps the blur.
        "rounded-card border border-hairline bg-surface-card p-6 text-text-primary shadow-soft backdrop-blur-glass",
        "outline-none opacity-0 transition-opacity duration-base ease-neu-out motion-reduce:transition-none",
        "data-[state=open]:opacity-100 data-[state=closed]:opacity-0",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className={cn(
          "absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-pill",
          "border border-transparent bg-transparent text-text-secondary outline-none",
          "transition-[box-shadow,color,background-color,transform] duration-fast ease-neu-out motion-reduce:transition-none",
          "hover:bg-elevated hover:text-text-primary active:scale-[0.97]",
          "focus-visible:shadow-focus-ring",
        )}
        aria-label="Close"
      >
        <XIcon className="h-4 w-4" aria-hidden="true" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = "DialogContent";

export const DialogHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1.5", className)} {...props} />
  ),
);
DialogHeader.displayName = "DialogHeader";

export const DialogFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex justify-end gap-2", className)} {...props} />
  ),
);
DialogFooter.displayName = "DialogFooter";

export const DialogTitle = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-text-primary", className)}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-text-secondary", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

export const DialogClose = DialogPrimitive.Close;
