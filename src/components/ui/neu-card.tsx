import { forwardRef, type HTMLAttributes, type KeyboardEvent, type MouseEvent } from "react";
import { cn } from "@/lib/utils/cn";

export type NeuCardProps = HTMLAttributes<HTMLDivElement> & {
  /** Hover lift, active press, Enter/Space activation, and a focus ring. Use for clickable cards. */
  interactive?: boolean;
  /** Set to false when a child needs to bleed to the card's edge (e.g. an image or a GridCell grid). */
  padded?: boolean;
};

export const NeuCard = forwardRef<HTMLDivElement, NeuCardProps>(
  ({ className, interactive = false, padded = true, onClick, onKeyDown, ...props }, ref) => {
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
          "rounded-neu border border-hairline bg-bg-surface text-text-primary shadow-neu-raised outline-none",
          padded && "p-4",
          interactive && [
            "cursor-pointer transition-[transform,box-shadow] duration-base ease-neu-out",
            "hover:-translate-y-0.5 hover:shadow-neu-raised-lg",
            "active:translate-y-0 active:shadow-neu-pressed active:duration-fast",
            "focus-visible:shadow-neu-focus",
          ],
          className,
        )}
        {...props}
      />
    );
  },
);
NeuCard.displayName = "NeuCard";
