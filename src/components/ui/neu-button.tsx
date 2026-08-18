import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 rounded-pill px-4 text-sm font-semibold",
    "outline-none transition-[box-shadow,color,background-color,border-color,transform] duration-fast ease-neu-out motion-reduce:transition-none",
    "focus-visible:shadow-focus-ring disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.97]",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-accent-go text-on-accent font-semibold hover:brightness-110",
        default: "bg-elevated text-text-primary hover:brightness-110",
        ghost:
          "border border-transparent bg-transparent text-text-secondary hover:bg-elevated hover:text-text-primary",
        destructive:
          "border border-accent-warn/60 bg-transparent text-accent-warn hover:bg-accent-warn/10",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-5 text-base",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export type NeuButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const NeuButton = forwardRef<HTMLButtonElement, NeuButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
NeuButton.displayName = "NeuButton";

/** Prefer PillButton in new code. */
export const PillButton = NeuButton;
export type PillButtonProps = NeuButtonProps;

export { buttonVariants };
