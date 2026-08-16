import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Database } from "@/types/database";

type ShiftAssignmentRow = Database["public"]["Tables"]["shift_assignments"]["Row"];
type SwapRequestRow = Database["public"]["Tables"]["swap_requests"]["Row"];

/**
 * Live coverage board updates: any insert/update/delete on shift_assignments for shifts belonging to
 * eventId. Filtering by event happens client-side (the caller already has the event's shift ids from
 * getCoverage()), Realtime's postgres_changes filter can't join through shifts to scope by event_id
 * directly. Returns the channel so the caller can unsubscribe (supabase.removeChannel(channel)) on
 * unmount.
 */
export function subscribeToShiftAssignments(
  shiftIds: string[],
  onChange: (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; row: ShiftAssignmentRow | null; oldRow: ShiftAssignmentRow | null }) => void,
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
 * Live open-swaps feed: any insert/update/delete on swap_requests. RLS already scopes what a given
 * caller receives (own rows, or everything for organizer/admin), same as getOpenSwaps().
 */
export function subscribeToSwapRequests(
  onChange: (payload: { eventType: "INSERT" | "UPDATE" | "DELETE"; row: SwapRequestRow | null; oldRow: SwapRequestRow | null }) => void,
): RealtimeChannel {
  const supabase = createSupabaseBrowserClient();

  return supabase
    .channel("swap_requests:open")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "swap_requests" },
      (payload) => {
        onChange({
          eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
          row: (payload.new ?? null) as SwapRequestRow | null,
          oldRow: (payload.old ?? null) as SwapRequestRow | null,
        });
      },
    )
    .subscribe();
}

export function unsubscribe(channel: RealtimeChannel): void {
  const supabase = createSupabaseBrowserClient();
  void supabase.removeChannel(channel);
}
