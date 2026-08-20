import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/types/database";

type ShiftAssignmentRow = Database["public"]["Tables"]["shift_assignments"]["Row"];
type ChangeRequestRow = Database["public"]["Tables"]["change_requests"]["Row"];

/**
 * Live coverage board updates: any insert/update/delete on shift_assignments for shifts belonging to
 * eventId. Filtering by event happens client-side (the caller already has the event's shift ids from
 * getCoverage()), Realtime's postgres_changes filter can't join through shifts to scope by event_id
 * directly. Returns the channel so the caller can unsubscribe (supabase.removeChannel(channel)) on
 * unmount.
 */
export function subscribeToShiftAssignments(
  shiftIds: string[],
  onChange: (payload: {
    eventType: "INSERT" | "UPDATE" | "DELETE";
    row: ShiftAssignmentRow | null;
    oldRow: ShiftAssignmentRow | null;
  }) => void,
): RealtimeChannel {
  const supabase = createSupabaseBrowserClient();
  const shiftIdSet = new Set(shiftIds);

  const channel = supabase
    .channel("shift_assignments:coverage")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "shift_assignments" },
      (payload) => {
        const row = (payload.new ?? null) as ShiftAssignmentRow | null;
        const oldRow = (payload.old ?? null) as ShiftAssignmentRow | null;
        const shiftId = row?.shift_id ?? oldRow?.shift_id;

        if (shiftId && shiftIdSet.has(shiftId)) {
          onChange({ eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE", row, oldRow });
        }
      },
    )
    .subscribe();

  return channel;
}

/**
 * Live change-requests feed (V2 rename from subscribeToSwapRequests()/swap_requests, no callers
 * existed anywhere in the codebase at the time of this migration, verified via grep, so this is a
 * clean rename). RLS already scopes what a given caller receives (any open swap_any/swap_with row,
 * their own rows in any state, everything a director/admin has authority over), same as
 * getOpenChangeRequests().
 */
export function subscribeToChangeRequests(
  onChange: (payload: {
    eventType: "INSERT" | "UPDATE" | "DELETE";
    row: ChangeRequestRow | null;
    oldRow: ChangeRequestRow | null;
  }) => void,
): RealtimeChannel {
  const supabase = createSupabaseBrowserClient();

  return supabase
    .channel("change_requests:open")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "change_requests" },
      (payload) => {
        onChange({
          eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
          row: (payload.new ?? null) as ChangeRequestRow | null,
          oldRow: (payload.old ?? null) as ChangeRequestRow | null,
        });
      },
    )
    .subscribe();
}

export function unsubscribe(channel: RealtimeChannel): void {
  const supabase = createSupabaseBrowserClient();
  void supabase.removeChannel(channel);
}
