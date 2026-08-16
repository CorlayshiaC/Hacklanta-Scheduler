"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactElement } from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";
import { useToast } from "./use-toast";

export const ToastProvider = ToastPrimitive.Provider;

/** Default auto-dismiss window, applied via ToastProvider; a toast's own `duration` overrides it. */
const DEFAULT_TOAST_DURATION = 6000;

export const ToastViewport = forwardRef<
  ElementRef<typeof ToastPrimitive.Viewport>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      "fixed inset-x-4 bottom-4 z-50 flex flex-col gap-2 outline-none",
      "sm:inset-x-auto sm:right-4 sm:w-full sm:max-w-sm",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = "ToastViewport";

const toastVariants = cva(
  [
    "pointer-events-auto relative flex w-full items-start gap-3 rounded-neu-sm border bg-bg-surface p-4",
    "text-text-primary shadow-neu-floating outline-none",
    "translate-y-2 opacity-0 transition-[transform,opacity] duration-base ease-neu-out motion-reduce:transition-none",
    "data-[state=open]:translate-y-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0",
    "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none",
    "data-[swipe=cancel]:translate-x-0",
    "data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=end]:duration-fast",
  ],
  {
    variants: {
      variant: {
        default: "border-hairline",
        destructive: "border-danger/40",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export type ToastProps = ComponentPropsWithoutRef<typeof ToastPrimitive.Root> &
  VariantProps<typeof toastVariants>;

export const Toast = forwardRef<ElementRef<typeof ToastPrimitive.Root>, ToastProps>(
  ({ className, variant, ...props }, ref) => (
    <ToastPrimitive.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  ),
);
Toast.displayName = "Toast";
export { toastVariants };

export type ToastTitleProps = ComponentPropsWithoutRef<typeof ToastPrimitive.Title> &
  Pick<VariantProps<typeof toastVariants>, "variant">;

export const ToastTitle = forwardRef<ElementRef<typeof ToastPrimitive.Title>, ToastTitleProps>(
  ({ className, variant, ...props }, ref) => (
    <ToastPrimitive.Title
      ref={ref}
      className={cn(
        "text-sm font-semibold text-text-primary",
        variant === "destructive" && "text-danger",
        className,
      )}
      {...props}
    />
  ),
);
ToastTitle.displayName = "ToastTitle";

export const ToastDescription = forwardRef<
  ElementRef<typeof ToastPrimitive.Description>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description
    ref={ref}
    className={cn("text-sm text-text-secondary", className)}
    {...props}
  />
));
ToastDescription.displayName = "ToastDescription";

export const ToastClose = forwardRef<
  ElementRef<typeof ToastPrimitive.Close>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Close
    ref={ref}
    aria-label="Close"
    className={cn(
      "absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-neu-sm",
      "border border-transparent bg-transparent text-text-secondary outline-none",
      "transition-[box-shadow,color,background-color] duration-fast ease-neu-out",
      "hover:bg-bg-surface hover:text-text-primary active:shadow-neu-pressed",
      "focus-visible:shadow-neu-focus",
      className,
    )}
    {...props}
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  </ToastPrimitive.Close>
));
ToastClose.displayName = "ToastClose";

export const ToastAction = forwardRef<
  ElementRef<typeof ToastPrimitive.Action>,
  ComponentPropsWithoutRef<typeof ToastPrimitive.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-neu-sm border border-transparent",
      "bg-transparent px-3 text-xs font-semibold text-text-secondary outline-none",
      "transition-[box-shadow,color,background-color,border-color] duration-fast ease-neu-out",
      "hover:bg-bg-surface hover:text-text-primary active:shadow-neu-pressed",
      "focus-visible:shadow-neu-focus disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
ToastAction.displayName = "ToastAction";

/** Element shape `toast({ action })` accepts; re-exported so use-toast.ts can type it without a runtime import. */
export type ToastActionElement = ReactElement<typeof ToastAction>;

/**
 * Renders the live toast queue. Mount once near the root layout, inside (or alongside) the rest
 * of the app — it owns its own ToastProvider/ToastViewport, no wrapping required.
 */
export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastProvider duration={DEFAULT_TOAST_DURATION}>
      {toasts.map(({ id, title, description, action, variant, ...props }) => (
        <Toast key={id} variant={variant} {...props}>
          <div className="flex flex-1 flex-col gap-1 pr-6">
            {title ? <ToastTitle variant={variant}>{title}</ToastTitle> : null}
            {description ? <ToastDescription>{description}</ToastDescription> : null}
          </div>
          {action}
          <ToastClose onClick={() => dismiss(id)} />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
