"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getAvailabilityEventById,
  getDefaultAvailabilityEvent,
  type AvailabilityEventWindow,
} from "@/lib/availability/event";
import {
  findOverlappingWindow,
  parseAvailabilityFormInput,
  validateWindowInsideEvent,
  type AvailabilityWindowLike,
} from "@/lib/availability/validation";
import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, TablesInsert, TablesUpdate } from "@/types/database";

type AvailabilityWindowRow = Database["public"]["Tables"]["availability_windows"]["Row"];

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function redirectWithAvailabilityResult(ok: boolean, message: string): never {
  const params = new URLSearchParams({
    result: ok ? "success" : "error",
    message,
  });

  redirect(`/my-schedule?${params.toString()}`);
}

async function resolveEventForMutation(eventId: string): Promise<AvailabilityEventWindow> {
  try {
    return eventId ? await getAvailabilityEventById(eventId) : await getDefaultAvailabilityEvent();
  } catch {
    redirectWithAvailabilityResult(false, "That event is not configured.");
  }
}

async function getExistingWindows(input: {
  eventId: string;
  profileId: string;
}): Promise<AvailabilityWindowLike[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("availability_windows")
    .select("id,starts_at,ends_at")
    .eq("event_id", input.eventId)
    .eq("profile_id", input.profileId)
    .eq("status", "available");

  if (error) {
    redirectWithAvailabilityResult(false, "Unable to validate availability overlap.");
  }

  return (data ?? []) as AvailabilityWindowLike[];
}

async function validateSubmittedWindow(formData: FormData, excludeWindowId?: string) {
  const context = await requireAuthenticatedUser();
  const event = await resolveEventForMutation(readString(formData, "eventId"));
  const parsed = parseAvailabilityFormInput(
    {
      date: readString(formData, "date"),
      startsAt: readString(formData, "startsAt"),
      endsAt: readString(formData, "endsAt"),
      note: readString(formData, "note"),
    },
    event.timezone,
  );

  if (!parsed.ok) {
    redirectWithAvailabilityResult(false, parsed.message);
  }

  const boundaryValidation = validateWindowInsideEvent({
    startsAt: parsed.value.startsAt,
    endsAt: parsed.value.endsAt,
    event,
  });

  if (!boundaryValidation.ok) {
    redirectWithAvailabilityResult(false, boundaryValidation.message);
  }

  const existingWindows = await getExistingWindows({
    eventId: event.id,
    profileId: context.profile.id,
  });
  const overlap = findOverlappingWindow({
    startsAt: parsed.value.startsAt,
    endsAt: parsed.value.endsAt,
    existingWindows,
    excludeWindowId,
  });

  if (overlap) {
    redirectWithAvailabilityResult(
      false,
      "You already have availability that overlaps this time. Edit your existing availability instead.",
    );
  }

  return {
    context,
    event,
    window: parsed.value,
  };
}

export async function createAvailabilityWindowAction(formData: FormData) {
  const { context, event, window } = await validateSubmittedWindow(formData);
  const supabase = await createSupabaseServerClient();
  const insert: TablesInsert<"availability_windows"> = {
    event_id: event.id,
    profile_id: context.profile.id,
    starts_at: window.startsAt,
    ends_at: window.endsAt,
    status: "available",
    note: window.note,
  };
  const { error } = await supabase.from("availability_windows").insert(insert as never);

  if (error) {
    redirectWithAvailabilityResult(false, "Unable to add availability.");
  }

  revalidatePath("/my-schedule");
  redirectWithAvailabilityResult(true, "Availability added.");
}

export async function updateAvailabilityWindowAction(formData: FormData) {
  const windowId = readString(formData, "windowId");
  const { context, event, window } = await validateSubmittedWindow(formData, windowId);
  const supabase = await createSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase
    .from("availability_windows")
    .select("*")
    .eq("id", windowId)
    .eq("event_id", event.id)
    .eq("profile_id", context.profile.id)
    .maybeSingle();

  if (existingError || !existing) {
    redirectWithAvailabilityResult(false, "Availability window was not found.");
  }

  const update: TablesUpdate<"availability_windows"> = {
    starts_at: window.startsAt,
    ends_at: window.endsAt,
    status: "available",
    note: window.note,
  };
  const { error } = await supabase
    .from("availability_windows")
    .update(update as never)
    .eq("id", (existing as AvailabilityWindowRow).id);

  if (error) {
    redirectWithAvailabilityResult(false, "Unable to update availability.");
  }

  revalidatePath("/my-schedule");
  redirectWithAvailabilityResult(true, "Availability updated.");
}

export async function deleteAvailabilityWindowAction(formData: FormData) {
  const context = await requireAuthenticatedUser();
  const event = await resolveEventForMutation(readString(formData, "eventId"));
  const windowId = readString(formData, "windowId");
  const supabase = await createSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase
    .from("availability_windows")
    .select("id")
    .eq("id", windowId)
    .eq("event_id", event.id)
    .eq("profile_id", context.profile.id)
    .maybeSingle();

  if (existingError || !existing) {
    redirectWithAvailabilityResult(false, "Availability window was not found.");
  }

  const { error } = await supabase
    .from("availability_windows")
    .delete()
    .eq("id", (existing as Pick<AvailabilityWindowRow, "id">).id);

  if (error) {
    redirectWithAvailabilityResult(false, "Unable to delete availability.");
  }

  revalidatePath("/my-schedule");
  redirectWithAvailabilityResult(true, "Availability deleted.");
}

export type SyncAvailabilityResult = { ok: true } | { ok: false; message: string };

/**
 * Replaces the member's full "available" window set for one event in a single call: the paint
 * grid owns the whole selection rather than one window at a time. Deletes existing windows and
 * inserts the new set rather than diffing, avoiding partial-failure inconsistency between a
 * delta of adds/removes.
 */
export async function syncEventAvailabilityAction(
  eventId: string,
  windows: { startsAt: string; endsAt: string }[],
): Promise<SyncAvailabilityResult> {
  const context = await requireAuthenticatedUser();
  let event: AvailabilityEventWindow;

  try {
    event = await getAvailabilityEventById(eventId);
  } catch {
    return { ok: false, message: "That event is not configured." };
  }

  for (const window of windows) {
    const boundary = validateWindowInsideEvent({ startsAt: window.startsAt, endsAt: window.endsAt, event });
    if (!boundary.ok) {
      return { ok: false, message: boundary.message };
    }
  }

  const supabase = await createSupabaseServerClient();
  const { error: deleteError } = await supabase
    .from("availability_windows")
    .delete()
    .eq("event_id", event.id)
    .eq("profile_id", context.profile.id)
    .eq("status", "available");

  if (deleteError) {
    return { ok: false, message: "Unable to save availability." };
  }

  if (windows.length === 0) {
    revalidatePath("/my-schedule");
    return { ok: true };
  }

  const inserts: TablesInsert<"availability_windows">[] = windows.map((window) => ({
    event_id: event.id,
    profile_id: context.profile.id,
    starts_at: window.startsAt,
    ends_at: window.endsAt,
    status: "available",
    note: null,
  }));
  const { error: insertError } = await supabase.from("availability_windows").insert(inserts as never);

  if (insertError) {
    return { ok: false, message: "Unable to save availability." };
  }

  revalidatePath("/my-schedule");
  return { ok: true };
}
