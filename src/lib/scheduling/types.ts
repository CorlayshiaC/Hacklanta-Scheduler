import type { Database } from "@/types/database";

export type TimeWindow = {
  startsAt: string;
  endsAt: string;
};

/**
 * `assignment_status` (`draft` / `published` / `removed` / `swap_pending`) is V1's vocabulary,
 * kept but deprecated by supabase/migrations/20260817000200_v2_assignment_approval_state.sql in
 * favor of `state` (`ApprovalState`/`ACTIVE_APPROVAL_STATES` below), which every V2 surface in
 * this file reads and writes instead. `ACTIVE_ASSIGNMENT_STATUSES` survives only for the
 * pre-V2 whole-schedule draft/publish review workflow (`src/lib/admin/schedule/review.ts`) that
 * migration's own comment calls out as the one remaining `status` consumer.
 */
export const ACTIVE_ASSIGNMENT_STATUSES = ["draft", "published", "swap_pending"] as const;
export type ActiveAssignmentStatus = (typeof ACTIVE_ASSIGNMENT_STATUSES)[number];

export type ShiftWindow = TimeWindow & {
  id: string;
};

/**
 * Every conflict/eligibility check in this module returns this shape. One type, every surface
 * (coverage board, self-signup, AI auto-fill) renders the same messages from the same source.
 *
 * V2 shared decision: hard limits are gone. Overlap and hours checks are warnings surfaced in the
 * approval queue, never blocks, approval is the safety net. There is no "blocked" variant anymore;
 * `checkAssignmentConflicts` in `conflict-engine.ts` always returns "ok" or "warning".
 */
export type ConflictCheckResult = { status: "ok" } | { status: "warning"; reasons: string[] };

export function hasWarnings(result: ConflictCheckResult): result is { status: "warning"; reasons: string[] } {
  return result.status === "warning";
}

/**
 * V2's real assignment-state vocabulary (`shift_assignments.state`, supabase/migrations/
 * 20260817000200_v2_assignment_approval_state.sql). `status` (`ACTIVE_ASSIGNMENT_STATUSES` above)
 * is kept only for the pre-V2 whole-schedule draft/publish review workflow per that migration's
 * own comment; every V2 surface (StatusPill, the horizontal schedule, the approval queue) reads
 * and writes `state`, not `status`.
 */
export type ApprovalState = Database["public"]["Enums"]["assignment_state"];
export const ACTIVE_APPROVAL_STATES = ["in_approval", "approved"] as const satisfies readonly ApprovalState[];

export type CoverageStation = {
  id: string;
  name: string;
};

export type ShiftCellAssignee = {
  assignmentId: string;
  profileId: string;
  fullName: string;
};

export type ShiftCellStatus = "empty" | "partial" | "full";

/**
 * The unit the coverage board, roster panel, and calendar chips all render. Published in
 * docs/contracts/scheduling.md.
 */
export type ShiftCell = {
  shiftId: string;
  /** Null for a standalone shift (no event). */
  eventId: string | null;
  title: string;
  station: CoverageStation | null;
  startsAt: string;
  endsAt: string;
  location: string | null;
  headcountRequired: number;
  headcountAssigned: number;
  status: ShiftCellStatus;
  assignees: ShiftCellAssignee[];
  /** True when understaffed and starting within 24h. Drives the hairline pulse. */
  understaffedUrgent: boolean;
  /** Director note on this shift (shifts.notes, reused, not a new column), null when there is none. Directors/admins only. */
  notes: string | null;
};

export type AssignmentCandidateStatus = "available" | "conflict";

export type AssignmentCandidate = {
  profileId: string;
  fullName: string;
  status: AssignmentCandidateStatus;
  check: ConflictCheckResult;
};
