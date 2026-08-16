import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type NeuInputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Swaps the border to border-danger and reveals errorMessage (if provided) below the field. */
  invalid?: boolean;
  /** Rendered in text-danger text-xs below the field, only shown when invalid is true. */
  errorMessage?: string;
};

/**
 * Pressed well per spec: rest state reads as recessed into the surface (shadow-neu-pressed) rather
 * than raised, distinguishing inputs/wells from raised cards and buttons at a glance.
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
            "h-10 w-full rounded-neu-sm border bg-bg-sunken px-3 text-sm text-text-primary shadow-neu-pressed outline-none",
            "transition-[box-shadow,border-color] duration-fast ease-neu-out placeholder:text-text-secondary",
            "focus-visible:shadow-neu-focus",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
            invalid ? "border-danger" : "border-hairline",
            className,
          )}
          {...props}
        />
        {invalid && errorMessage ? (
          <p id={errorId} className="text-xs text-danger">
            {errorMessage}
          </p>
        ) : null}
      </div>
    );
  },
);
NeuInput.displayName = "NeuInput";
