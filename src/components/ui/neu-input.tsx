import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type NeuInputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Swaps the border to border-accent-warn and reveals errorMessage (if provided) below the field. */
  invalid?: boolean;
  /** Rendered in text-accent-warn text-xs below the field, only shown when invalid is true. */
  errorMessage?: string;
};

/**
 * Flat elevated pill: bg-elevated fill with a hairline border, no shadow. Focus swaps the border
 * to accent-go and adds the standard focus ring.
 */
export const NeuInput = forwardRef<HTMLInputElement, NeuInputProps>(
  ({ className, invalid = false, errorMessage, id, "aria-describedby": ariaDescribedBy, ...props }, ref) => {
    const errorId = invalid && errorMessage && id ? `${id}-error` : undefined;
    const describedBy = [ariaDescribedBy, errorId].filter(Boolean).join(" ") || undefined;
    return (
      <div className="flex flex-col gap-1">
        <input
          ref={ref}
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-10 w-full rounded-pill border bg-elevated px-3 text-sm text-text-primary outline-none",
            "transition-[box-shadow,border-color] duration-fast ease-neu-out placeholder:text-text-secondary",
            "focus-visible:shadow-focus-ring focus-visible:border-accent-go",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
            invalid ? "border-accent-warn" : "border-hairline",
            className,
          )}
          {...props}
        />
        {invalid && errorMessage ? (
          <p id={errorId} className="text-xs text-accent-warn">
            {errorMessage}
          </p>
        ) : null}
      </div>
    );
  },
);
NeuInput.displayName = "NeuInput";
