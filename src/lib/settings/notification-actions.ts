"use server";

import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/types/database";

const inputSchema = z.object({
  kind: z.string().min(1),
  channel: z.enum(["email", "in_app"]),
  enabled: z.boolean(),
});

/**
 * Called directly from the client (not through a <form>, this is a plain async server action
 * invoked from an onClick handler, a valid Next.js pattern). A profile can only ever write its own
 * rows, enforced both here (requireAuthenticatedUser scopes profile_id to the caller) and by
 * notification_preferences RLS (supabase/migrations/20260816130800_notification_preferences.sql).
 */
export async function setNotificationPreferenceAction(input: {
  kind: string;
  channel: "email" | "in_app";
  enabled: boolean;
}): Promise<void> {
  const { user } = await requireAuthenticatedUser();
  const parsed = inputSchema.parse(input);

  const supabase = await createSupabaseServerClient();
  const row: TablesInsert<"notification_preferences"> = {
    profile_id: user.id,
    kind: parsed.kind,
    channel: parsed.channel,
    enabled: parsed.enabled,
  };
  const { error } = await supabase
    .from("notification_preferences")
    .upsert(row as never, { onConflict: "profile_id,kind,channel" });

  if (error) {
    throw new Error("Could not save notification preference.");
  }
}
