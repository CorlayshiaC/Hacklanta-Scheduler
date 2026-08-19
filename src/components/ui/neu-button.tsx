import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

/**
 * V4: "one filled purple button per view maximum for the primary action; secondary actions are
 * text links, no bordered pill buttons" (docs/contracts/design.md). `primary` is that one filled
 * button. `link` is the new preferred secondary/tertiary action: no fill, no border, just accent
 * text with an underline on hover. `default`/`ghost`/`destructive`/`white` all still resolve
 * (nothing here breaks an existing call site: `rounded-pill` already flattens every one of them to
 * the 6px control radius automatically) but new secondary actions should reach for `link`, not
 * `default`/`ghost`, to match the spec's text-link intent. Enforcing "one filled button per view"
 * itself is a per-screen call each feature agent makes, not something a single primitive can
 * count; see motion-spec.md's enforcement note.
 */
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
        primary: "bg-accent-primary text-on-accent font-semibold hover:brightness-110",
        default: "bg-elevated text-text-primary hover:brightness-110",
        ghost:
          "border border-transparent bg-transparent text-text-secondary hover:bg-elevated hover:text-text-primary",
        destructive:
          "border border-accent-warn/60 bg-transparent text-accent-warn hover:bg-accent-warn/10",
        /** The V4 secondary-action shape: plain text, no fill, no border. Keeps the size variant's
         * height/padding as its click/tap target (invisible box around the text) rather than
         * fighting it with a padding override, which cva's variant-then-size class ordering would
         * silently lose anyway once merged through cn()'s tailwind-merge. */
        link: "bg-transparent text-accent-primary-glow font-medium underline-offset-4 hover:underline",
        /** Selection semantics: "this is you" / "you're claiming this", e.g. "Claim swap". Back-compat
         * only; prefer `primary` in new code, `pill-white` now resolves to the same fill-safe purple. */
        white: "bg-pill-white text-on-accent font-semibold hover:brightness-95",
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
