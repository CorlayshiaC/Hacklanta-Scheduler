import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PublicSchedule } from "@/lib/public/types";
import type { Database } from "@/types/database";

type PublicScheduleRpcShift = {
  id: string;
  title: string;
  station: string | null;
  startsAt: string;
  endsAt: string;
  location: string | null;
  headcountRequired: number;
  headcountFilled: number;
  assignees: string[];
};

type PublicScheduleRpcResult = {
  event: {
    name: string;
    description: string | null;
    location: string | null;
    startsAt: string;
    endsAt: string;
    timezone: string;
  };
  shifts: PublicScheduleRpcShift[];
};

/**
 * Resolves a share token to its public schedule payload via the `get_public_schedule` security
 * definer function (supabase/migrations/20260816130900_share_tokens_and_public_schedule.sql).
 * Returns null for a missing or revoked token, callers 404 on null. The function already excludes
 * email, profile id, role, and any non-published assignment, see docs/contracts/public.md section
 * two, so nothing here needs to re-filter that data, only reshape field names to this module's
 * PublicSchedule contract (the database function uses `station`/`headcountRequired`/
 * `headcountFilled`, this module normalizes those to `stationName`/`needed`/`filled` and adds the
 * aggregate slotsFilled/slotsNeeded totals every caller needs).
 */
/**
 * Request-scoped memoization. `/s/[token]` calls this twice per request, once in
 * `generateMetadata` and once in the page component. postgrest sends `.rpc()` as a POST, and Next's
 * built-in request memoization only covers GET/HEAD, so both calls were executing the
 * `get_public_schedule` security-definer function in full: it joins shifts, assignments and
 * profiles server-side, so this was the single most expensive query on the app's only public page,
 * run twice. `cache()` collapses it to one with no call-site or behavior change.
 */
export const getPublicSchedule = cache(async function getPublicSchedule(
  token: string,
): Promise<PublicSchedule | null> {
  const supabase = await createSupabaseServerClient();
  // createServerClient from @supabase/ssr does not preserve the .rpc() typed overload the way
  // plain createClient<Database> does (same workaround used in src/lib/shifts/actions.ts and
  // src/lib/swaps/actions.ts, runtime behavior is unaffected).
  const { data, error } = await (supabase as unknown as SupabaseClient<Database>).rpc(
    "get_public_schedule",
    { p_token: token },
  );

  if (error) {
    throw new Error(`get_public_schedule failed: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  // The function returns jsonb, typed as Json (string | number | boolean | null | object | array)
  // by the generated client. It is a real object shape by construction (see the migration), never
  // an array or primitive, so this cast is safe: there is no tighter type Postgres can express
  // through a jsonb-returning function signature.
  const result = data as unknown as PublicScheduleRpcResult;

  const shifts = result.shifts.map((shift) => ({
    id: shift.id,
    title: shift.title,
    stationName: shift.station,
    startsAt: shift.startsAt,
    endsAt: shift.endsAt,
    location: shift.location,
    needed: shift.headcountRequired,
    filled: shift.headcountFilled,
    assignees: shift.assignees,
  }));

  const totals = shifts.reduce(
    (acc, shift) => ({ filled: acc.filled + shift.filled, needed: acc.needed + shift.needed }),
    { filled: 0, needed: 0 },
  );

  return {
    event: {
      name: result.event.name,
      description: result.event.description,
      location: result.event.location,
      startsAt: result.event.startsAt,
      endsAt: result.event.endsAt,
      timezone: result.event.timezone,
    },
    shifts,
    slotsFilled: totals.filled,
    slotsNeeded: totals.needed,
  };
});
