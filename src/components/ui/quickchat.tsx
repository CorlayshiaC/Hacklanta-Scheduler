import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type QuickchatButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/** Preset-query pill, e.g. "When am I scheduled". Pairs with QuickchatAnswerCard on tap. */
export const QuickchatButton = forwardRef<HTMLButtonElement, QuickchatButtonProps>(
  ({ className, type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "rounded-pill border border-hairline bg-elevated px-3.5 py-2 text-sm font-medium text-text-primary",
          "outline-none transition-[background-color,transform] duration-fast ease-neu-out motion-reduce:transition-none",
          "hover:bg-card active:scale-[0.97] focus-visible:shadow-focus-ring",
          "disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
QuickchatButton.displayName = "QuickchatButton";

export type QuickchatAnswerCardProps = HTMLAttributes<HTMLDivElement>;

/** Compact inline reveal for a QuickchatButton's answer. Caller wraps any time/number children in font-mono tabular-nums. */
export const QuickchatAnswerCard = forwardRef<HTMLDivElement, QuickchatAnswerCardProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("max-w-sm rounded-card bg-card p-3 text-sm text-text-primary", className)}
        {...props}
      />
    );
  },
);
QuickchatAnswerCard.displayName = "QuickchatAnswerCard";
