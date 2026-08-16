"use client";

import { forwardRef } from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils/cn";

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
} as const;

const fallbackTextSizeClasses = {
  sm: "text-[10px]",
  md: "text-xs",
  lg: "text-sm",
} as const;

export type AvatarSize = keyof typeof sizeClasses;

export type AvatarProps = AvatarPrimitive.AvatarProps & {
  size?: AvatarSize;
};

export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(
  ({ className, size = "md", ...props }, ref) => (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-full border border-hairline shadow-neu-raised-sm",
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  ),
);
Avatar.displayName = "Avatar";

export const AvatarImage = forwardRef<
  HTMLImageElement,
  AvatarPrimitive.AvatarImageProps
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full object-cover", className)}
    {...props}
  />
));
AvatarImage.displayName = "AvatarImage";

export type AvatarFallbackProps = AvatarPrimitive.AvatarFallbackProps & {
  size?: AvatarSize;
};

export const AvatarFallback = forwardRef<HTMLSpanElement, AvatarFallbackProps>(
  ({ className, size = "md", ...props }, ref) => (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn(
        "flex h-full w-full items-center justify-center bg-bg-sunken font-medium text-text-secondary",
        fallbackTextSizeClasses[size],
        className,
      )}
      {...props}
    />
  ),
);
AvatarFallback.displayName = "AvatarFallback";
