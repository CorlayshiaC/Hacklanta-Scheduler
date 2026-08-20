import { forwardRef, type HTMLAttributes, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { HOVER_LIFT_CLASSES } from "@/lib/utils/motion";

export type NeuCardProps = HTMLAttributes<HTMLDivElement> & {
  /** Hover lift, active press, Enter/Space activation, and a focus ring. Use for clickable cards. */
  interactive?: boolean;
  /**
   * Hover lift only, with no button semantics. For a card that is not itself clickable but holds
   * an action inside it (a shift row with a "Take it" button, a swap row with a claim button):
   * those want the surface to respond to the pointer, but `interactive` would give the card
   * `role="button"` and a tab stop that does nothing, announcing a control that cannot be
   * activated and stranding keyboard users on it before the real button. Ignored when
   * `interactive` is set, since that already includes the lift.
   */
  hoverLift?: boolean;
  /** Set to false when a child needs to bleed to the card's edge (e.g. an image or a GridCell grid). */
  padded?: boolean;
  /** Uppercase overline label rendered above children. */
  title?: string;
  /** Trailing slot in the title row, e.g. an overflow menu trigger. */
  menuSlot?: ReactNode;
};

export const NeuCard = forwardRef<HTMLDivElement, NeuCardProps>(
  ({ className, interactive = false, hoverLift = false, padded = true, title, menuSlot, onClick, onKeyDown, children, ...props }, ref) => {
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
          "rounded-card border border-hairline bg-surface-card text-text-primary shadow-soft outline-none",
          padded && "p-4",
          !interactive && hoverLift && HOVER_LIFT_CLASSES,
          interactive && [
            HOVER_LIFT_CLASSES,
            "cursor-pointer",
            "active:scale-[0.99] active:duration-fast motion-reduce:active:scale-100",
            "focus-visible:shadow-focus-ring",
          ],
          className,
        )}
        {...props}
      >
        {title ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-text-secondary">{title}</span>
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
