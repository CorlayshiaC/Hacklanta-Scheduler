import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

/**
 * "primary" is a raised dark surface with a purple glow halo and a purple-400 border accent, not a
 * solid purple-500 fill. Two reasons: the shared spec bans large flat purple fills, and text-primary
 * on a solid purple-500 fill measures ~3.6:1, under the AA floor for normal-size button text. The
 * glow treatment keeps text-primary at its normal ~15.7:1 contrast against bg-surface. See
 * docs/contracts/design.md "Contrast floor".
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 rounded-neu-sm px-4 text-sm font-semibold",
    "outline-none transition-[box-shadow,color,background-color,border-color] duration-fast ease-neu-out",
    "focus-visible:shadow-neu-focus disabled:pointer-events-none disabled:opacity-50",
  ],
  {
    variants: {
      variant: {
        primary:
          "border border-purple-400/40 bg-bg-surface text-text-primary shadow-neu-raised hover:shadow-neu-glow active:shadow-neu-pressed",
        default:
          "border border-hairline bg-bg-surface text-text-primary shadow-neu-raised hover:shadow-neu-raised-lg active:shadow-neu-pressed",
        ghost:
          "border border-transparent bg-transparent text-text-secondary hover:bg-bg-surface hover:text-text-primary active:shadow-neu-pressed",
        destructive:
          "border border-danger/30 bg-bg-surface text-danger shadow-neu-raised hover:border-danger/60 active:shadow-neu-pressed",
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

export { buttonVariants };
