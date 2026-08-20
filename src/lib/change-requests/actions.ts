"use server";

import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/db/rpc";
import type { TablesInsert, TablesUpdate } from "@/types/database";
import type { ChangeRequestKind } from "@/lib/change-requests/types";

export type ChangeRequestActionResult = { ok: true } | { ok: false; message: string };

const REVALIDATE_PATHS = ["/swaps", "/my-schedule"];

function revalidateChangeRequestPaths() {
  for (const path of REVALIDATE_PATHS) {
    revalidatePath(path);
  }
}

export type SubmitChangeRequestInput = {
  eventId: string;
  kind: ChangeRequestKind;
  assignmentId?: string;
  targetUserId?: string;
  note?: string;
};

export async function submitChangeRequestAction(input: SubmitChangeRequestInput): Promise<ChangeRequestActionResult> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return { ok: false, message: "You need to sign in again." };
  }

  if (input.kind === "swap_with" && !input.targetUserId) {
    return { ok: false, message: "Pick who you'd like to swap with." };
  }

  if (input.kind !== "more_hours" && !input.assignmentId) {
    return { ok: false, message: "Pick a shift for this request." };
  }

  const insert: TablesInsert<"change_requests"> = {
    event_id: input.eventId,
    assignment_id: input.kind === "more_hours" ? null : (input.assignmentId ?? null),
    requested_by: authData.user.id,
    kind: input.kind,
    target_user_id: input.kind === "swap_with" ? (input.targetUserId ?? null) : null,
    note: input.note?.trim() || null,
  };
  // `as never`: same established workaround the pre-V2 swap_requests actions used for this exact
  // insert-overload-resolution gap on the @supabase/ssr-wrapped server client, runtime unaffected.
  const { error } = await supabase.from("change_requests").insert(insert as never);

  if (error) {
    return { ok: false, message: error.message.includes("already open") || error.message.includes("duplicate") ? "You already have an open request for this shift." : "Unable to submit this request." };
  }

  revalidateChangeRequestPaths();
  return { ok: true };
}

export async function claimChangeRequestAction(changeRequestId: string): Promise<ChangeRequestActionResult> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await callRpc(supabase, "claim_change_request", { p_id: changeRequestId });

  if (error) {
    return { ok: false, message: error.message.includes("no longer open") ? "Someone already claimed this." : "Unable to claim this request." };
  }

  revalidateChangeRequestPaths();
  return { ok: true };
}

export async function cancelChangeRequestAction(changeRequestId: string): Promise<ChangeRequestActionResult> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const update: TablesUpdate<"change_requests"> = { state: "cancelled" };
  const { error } = await supabase
    .from("change_requests")
    .update(update as never)
    .eq("id", changeRequestId)
    .eq("state", "open");

  if (error) {
    return { ok: false, message: "Unable to cancel this request." };
  }

  revalidateChangeRequestPaths();
  return { ok: true };
}
