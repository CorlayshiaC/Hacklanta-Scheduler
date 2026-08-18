import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type StatusPillState = "approved" | "in_approval" | "not_assigned";

export type StatusPillProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  state: StatusPillState;
  /** Overrides the default label text for this state. */
  label?: string;
};

const STATUS_PILL_LABELS: Record<StatusPillState, string> = {
  approved: "Approved",
  in_approval: "Pending approval",
  not_assigned: "Not assigned",
};

// Fixed per-state styling only (no variant props): this pill renders identically
// everywhere in the app, so callers cannot restyle the three assignment states.
const STATUS_PILL_STATE_STYLES: Record<StatusPillState, string> = {
  approved: "bg-accent-go text-on-accent",
  in_approval: "bg-transparent border border-accent-warn text-accent-warn",
  not_assigned: "bg-elevated text-text-secondary",
};

export const StatusPill = forwardRef<HTMLSpanElement, StatusPillProps>(
  ({ state, label, className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-pill px-2.5 py-1 text-xs font-semibold",
        STATUS_PILL_STATE_STYLES[state],
        className,
      )}
      {...props}
    >
      {label ?? STATUS_PILL_LABELS[state]}
    </span>
  ),
);
StatusPill.displayName = "StatusPill";
