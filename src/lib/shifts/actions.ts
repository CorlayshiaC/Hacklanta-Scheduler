"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type ClaimShiftResult = { ok: true } | { ok: false; message: string };

const CLAIM_SHIFT_ERROR_MESSAGES: Record<string, string> = {
  "shift is fully staffed": "This shift just filled up.",
  "you already have an overlapping shift": "This overlaps a shift you already have.",
  "you are already assigned to this shift": "You already have this shift.",
  "shift is not open for signup": "This shift is not open for signup.",
};

function friendlyClaimShiftMessage(rawMessage: string): string {
  for (const [key, friendly] of Object.entries(CLAIM_SHIFT_ERROR_MESSAGES)) {
    if (rawMessage.includes(key)) {
      return friendly;
    }
  }

  return "Unable to take this shift.";
}

export async function claimShiftAction(shiftId: string): Promise<ClaimShiftResult> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  // @supabase/ssr's createServerClient does not propagate Database["public"]["Functions"] to
  // .rpc() the way plain createClient<Database> does (verified: bare createClient<Database>
  // types claim_shift's Args correctly, the ssr-wrapped client does not). Runtime behavior is
  // identical, both wrap the same underlying PostgrestClient; this is a type-only workaround.
  const { error } = await (supabase as unknown as SupabaseClient<Database>).rpc("claim_shift", { p_shift_id: shiftId });

  if (error) {
    return { ok: false, message: friendlyClaimShiftMessage(error.message) };
  }

  revalidatePath("/shifts");
  revalidatePath("/my-schedule");
  return { ok: true };
}
