import { forwardRef } from "react";
import { ShiftCapsule, type ShiftCapsuleProps } from "@/components/ui/shift-capsule";
import type { ApprovalState } from "@/lib/scheduling/types";
import { cn } from "@/lib/utils/cn";

/**
 * The horizontal schedule's per-assignment pill: `ShiftCapsule`'s shape, colored by
 * `StatusPill`'s fixed per-state styling instead of ShiftCapsule's own headcount-driven
 * empty/partial/full palette, since one cell here is always exactly one person's one assignment,
 * never a headcount. `state="partial"` is a styling no-op base, `className` fully repaints it
 * (tailwind-merge resolves the conflicting border/bg/text utilities in favor of the later class).
 */
const APPROVAL_STATE_CLASS: Record<ApprovalState, string> = {
  approved: "border-none bg-accent-go text-on-accent",
  in_approval: "border border-accent-warn bg-transparent text-accent-warn",
  not_assigned: "border border-dashed border-hairline bg-elevated text-text-secondary",
};

export type ScheduleCapsuleProps = Omit<ShiftCapsuleProps, "state" | "filled" | "needed" | "members"> & {
  approvalState: ApprovalState;
};

export const ScheduleCapsule = forwardRef<HTMLDivElement, ScheduleCapsuleProps>(
  ({ approvalState, className, ...props }, ref) => (
    <ShiftCapsule ref={ref} className={cn(APPROVAL_STATE_CLASS[approvalState], className)} state="partial" {...props} />
  ),
);
ScheduleCapsule.displayName = "ScheduleCapsule";
