import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const iconButtonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center rounded-full",
    "outline-none transition-[box-shadow,color,background-color,border-color,transform] duration-fast ease-neu-out motion-reduce:transition-none",
    "focus-visible:shadow-focus-ring disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.97]",
  ],
  {
    variants: {
      variant: {
        neutral:
          "border border-hairline bg-elevated text-text-secondary hover:text-text-primary",
        ghost:
          "border border-transparent bg-transparent text-text-secondary hover:bg-elevated hover:text-text-primary",
      },
      size: {
        sm: "h-8 w-8",
        md: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "neutral", size: "md" },
  },
);

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof iconButtonVariants> & { "aria-label": string };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(iconButtonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
IconButton.displayName = "IconButton";

export { iconButtonVariants };
