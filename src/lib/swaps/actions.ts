"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, TablesInsert } from "@/types/database";

export type SwapActionResult = { ok: true } | { ok: false; message: string };

export async function requestSwapAction(
  assignmentId: string,
  kind: "swap" | "drop",
  note?: string,
): Promise<SwapActionResult> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return { ok: false, message: "You need to sign in again." };
  }

  const insert: TablesInsert<"swap_requests"> = {
    shift_assignment_id: assignmentId,
    requested_by: authData.user.id,
    kind,
    note: note?.trim() || null,
  };
  const { error } = await supabase.from("swap_requests").insert(insert as never);

  if (error) {
    return { ok: false, message: "Unable to request a swap for this shift." };
  }

  revalidatePath("/swaps");
  revalidatePath("/my-schedule");
  return { ok: true };
}

export async function claimSwapAction(swapRequestId: string): Promise<SwapActionResult> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  // Type-only workaround, see the matching comment in lib/shifts/actions.ts claimShiftAction:
  // @supabase/ssr's createServerClient does not propagate Database["public"]["Functions"] to
  // .rpc() the way plain createClient<Database> does; runtime behavior is unaffected.
  const { error } = await (supabase as unknown as SupabaseClient<Database>).rpc("claim_swap", { p_swap_id: swapRequestId });

  if (error) {
    return { ok: false, message: error.message.includes("no longer open") ? "Someone already claimed this." : "Unable to claim this swap." };
  }

  revalidatePath("/swaps");
  revalidatePath("/my-schedule");
  return { ok: true };
}

export async function cancelSwapRequestAction(swapRequestId: string): Promise<SwapActionResult> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("swap_requests")
    .update({ status: "cancelled" } as never)
    .eq("id", swapRequestId)
    .eq("status", "open");

  if (error) {
    return { ok: false, message: "Unable to cancel this request." };
  }

  revalidatePath("/swaps");
  revalidatePath("/my-schedule");
  return { ok: true };
}
