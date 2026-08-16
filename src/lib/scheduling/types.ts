export type TimeWindow = {
  startsAt: string;
  endsAt: string;
};

/**
 * STUB(agent-2): `src/types/database.ts` has not been regenerated since the migrations that added
 * `swap_pending` to `assignment_status`, `organizer` to `app_role`, and `description`/`location`
 * to `events` (see docs/contracts/requests.md). Until it is, code here widens the stale generated
 * enum locally instead of hand-editing the generated file.
 *
 * An assignment in any of these three states still occupies its shift's headcount and blocks a
 * new overlapping assignment for the same person, mirroring `unique_active_shift_assignment` and
 * the overlap checks in `claim_shift()` / `execute_swap_transfer()`.
 */
export const ACTIVE_ASSIGNMENT_STATUSES = ["draft", "published", "swap_pending"] as const;
export type ActiveAssignmentStatus = (typeof ACTIVE_ASSIGNMENT_STATUSES)[number];

export type ShiftWindow = TimeWindow & {
  id: string;
};

/**
 * Every conflict/eligibility check in this module returns this shape. One type, every surface
 * (coverage board, self-signup, AI auto-fill) renders the same messages from the same source.
 */
export type ConflictCheckResult =
  | { status: "ok" }
  | { status: "blocked"; reason: string }
  | { status: "warning"; reasons: string[] };

export function isBlocked(result: ConflictCheckResult): result is { status: "blocked"; reason: string } {
  return result.status === "blocked";
}

export function hasWarnings(result: ConflictCheckResult): result is { status: "warning"; reasons: string[] } {
  return result.status === "warning";
}

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
};

export type AssignmentCandidateStatus = "available" | "conflict";

export type AssignmentCandidate = {
  profileId: string;
  fullName: string;
  status: AssignmentCandidateStatus;
  check: ConflictCheckResult;
};
