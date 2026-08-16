import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type NeuTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** Swaps the border to border-danger and reveals errorMessage (if provided) below the field. */
  invalid?: boolean;
  /** Rendered in text-danger text-xs below the field, only shown when invalid is true. */
  errorMessage?: string;
};

/**
 * Pressed well per spec, same treatment as NeuInput: rest state reads as recessed
 * (shadow-neu-pressed) rather than raised.
 */
export const NeuTextarea = forwardRef<HTMLTextAreaElement, NeuTextareaProps>(
  (
    { className, invalid = false, errorMessage, id, rows = 3, "aria-describedby": ariaDescribedBy, ...props },
    ref,
  ) => {
    const errorId = invalid && errorMessage && id ? `${id}-error` : undefined;
    const describedBy = [ariaDescribedBy, errorId].filter(Boolean).join(" ") || undefined;
    return (
      <div className="flex flex-col gap-1">
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(
            "w-full resize-y rounded-neu-sm border bg-bg-sunken px-3 py-2 text-sm text-text-primary shadow-neu-pressed outline-none",
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
NeuTextarea.displayName = "NeuTextarea";
