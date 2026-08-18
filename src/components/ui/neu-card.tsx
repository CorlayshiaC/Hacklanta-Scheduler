import { forwardRef, type HTMLAttributes, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type NeuCardProps = HTMLAttributes<HTMLDivElement> & {
  /** Hover lift, active press, Enter/Space activation, and a focus ring. Use for clickable cards. */
  interactive?: boolean;
  /** Set to false when a child needs to bleed to the card's edge (e.g. an image or a GridCell grid). */
  padded?: boolean;
  /** Uppercase overline label rendered above children. */
  title?: string;
  /** Trailing slot in the title row, e.g. an overflow menu trigger. */
  menuSlot?: ReactNode;
};

export const NeuCard = forwardRef<HTMLDivElement, NeuCardProps>(
  ({ className, interactive = false, padded = true, title, menuSlot, onClick, onKeyDown, children, ...props }, ref) => {
    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
      onKeyDown?.(event);
      if (!interactive || !onClick || event.defaultPrevented) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onClick(event as unknown as MouseEvent<HTMLDivElement>);
    }

    return (
      <div
        ref={ref}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={onClick}
        onKeyDown={interactive ? handleKeyDown : onKeyDown}
        className={cn(
          "rounded-card bg-card text-text-primary outline-none",
          padded && "p-4",
          interactive && [
            "cursor-pointer transition-[transform,background-color] duration-base ease-neu-out motion-reduce:transition-none",
            "hover:bg-elevated/60",
            "active:scale-[0.99] active:duration-fast",
            "focus-visible:shadow-focus-ring",
          ],
          className,
        )}
        {...props}
      >
        {title ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{title}</span>
              {menuSlot}
            </div>
            {children}
          </div>
        ) : (
          children
        )}
      </div>
    );
  },
);
NeuCard.displayName = "NeuCard";

/** Prefer Card in new code. */
export const Card = NeuCard;
export type CardProps = NeuCardProps;
