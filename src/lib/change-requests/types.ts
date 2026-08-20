// STUB(agent-2): change_requests landed in 20260817000300_v2_change_requests.sql but
// src/types/database.ts hasn't been regenerated yet. Local types matching the migration's enums
// exactly; tracking removal: grep STUB(agent-2) in src/lib/change-requests/.
export type ChangeRequestKind = "swap_any" | "swap_with" | "drop" | "cant_make_time" | "more_hours";
export type ChangeRequestState = "open" | "claimed" | "approved" | "declined" | "cancelled";

export const CHANGE_REQUEST_KIND_LABELS: Record<ChangeRequestKind, string> = {
  swap_any: "Swap with anyone",
  swap_with: "Swap with a specific person",
  drop: "Drop this shift",
  cant_make_time: "Can't make this time",
  more_hours: "Request more hours",
};
