import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type NeuTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** Swaps the border to border-accent-warn and reveals errorMessage (if provided) below the field. */
  invalid?: boolean;
  /** Rendered in text-accent-warn text-xs below the field, only shown when invalid is true. */
  errorMessage?: string;
};

/**
 * Flat elevated well, same family as NeuInput but with a slightly tighter radius suited to a
 * multi-line field. bg-elevated fill, hairline border, no shadow.
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
            "w-full resize-y rounded-2xl border bg-elevated px-3 py-2 text-sm text-text-primary outline-none",
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
NeuTextarea.displayName = "NeuTextarea";
