import "server-only";

import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { getMemberSchedulePageData } from "@/lib/member/schedule";
import { getOpenShiftsPageData } from "@/lib/shifts/data";
import { callRpc } from "@/lib/db/rpc";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildCoworkersAnswer,
  buildHoursAnswer,
  buildNextEventAnswer,
  buildOpenShiftsAnswer,
  buildScheduleAnswer,
} from "@/lib/quickchat/build-answers";
import type { QuickchatAnswer, QuickchatQueryKind } from "@/lib/quickchat/types";

/**
 * Real data composed from Agent 3/4's already-published read functions (getMemberSchedulePageData,
 * getOpenShiftsPageData): reading another agent's exported interface, not editing their file, per
 * the file-ownership rule. See docs/contracts/quickchat.md for exactly which of the five answers
 * are real today vs STUB(agent-2)/STUB(agent-3).
 *
 * Every one of these functions is scoped to "the current/default event"
 * (getAvailabilityEventById's own doc comment calls this an interim heuristic pending a real
 * event-context contract from Agent 3): quickchat inherits that same scope honestly rather than
 * pretending to be semester-wide before the data to back that exists.
 */

async function getNextPublishedEvent(): Promise<{
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
} | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("events")
    .select("id,name,starts_at,ends_at,timezone")
    .eq("status", "published")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error("Unable to load upcoming events.");
  }

  return data?.[0] ?? null;
}

async function answerSchedule(): Promise<QuickchatAnswer> {
  const schedule = await getMemberSchedulePageData();
  const next = schedule.summary.nextAssignment;

  return buildScheduleAnswer({
    nextShift: next
      ? {
          label: next.coverageRole?.name ?? next.shift.title,
          eventName: schedule.event.name,
          startsAt: next.shift.starts_at,
          timezone: schedule.event.timezone,
        }
      : null,
  });
}

async function answerNextEvent(): Promise<QuickchatAnswer> {
  const event = await getNextPublishedEvent();
  return buildNextEventAnswer({
    event: event && {
      name: event.name,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      timezone: event.timezone,
    },
  });
}

async function answerHours(userId: string): Promise<QuickchatAnswer> {
  const schedule = await getMemberSchedulePageData();
  const supabase = await createSupabaseServerClient();

  // hours_per_event/hours_semester (Agent 2, 20260817000400_v2_announcements_and_hours.sql) count
  // approved-state assignments only, matching the V2 "scheduled hours only" decision exactly.
  // Real numbers, not the event summary's own assignedHours (which still counts draft/published
  // from the pre-approval-flow status enum, see lib/member/schedule.ts): calling the RPC directly
  // here is more correct than reusing that summary field, not just more current.
  const [eventHours, semesterHours] = await Promise.all([
    callRpc(supabase, "hours_per_event", { p_profile_id: userId, p_event_id: schedule.event.id }),
    callRpc(supabase, "hours_semester", { p_profile_id: userId }),
  ]);

  const round1 = (value: number) => Math.round(value * 10) / 10;

  return buildHoursAnswer({
    eventName: schedule.event.name,
    hoursThisEvent: eventHours.error || eventHours.data === null ? null : round1(eventHours.data),
    hoursSemester: semesterHours.error || semesterHours.data === null ? null : round1(semesterHours.data),
  });
}

async function answerCoworkers(userId: string): Promise<QuickchatAnswer> {
  const schedule = await getMemberSchedulePageData();
  const next = schedule.summary.nextAssignment;

  if (!next) {
    return buildCoworkersAnswer({ shiftLabel: null, coworkerNames: [] });
  }

  const openShifts = await getOpenShiftsPageData(schedule.event.id);
  const shift = openShifts.shifts.find((candidate) => candidate.id === next.shift.id);
  const coworkerNames = (shift?.assignedMembers ?? [])
    .filter((member) => member.id !== userId)
    .map((member) => member.name);

  return buildCoworkersAnswer({
    shiftLabel: next.coverageRole?.name ?? next.shift.title,
    coworkerNames,
  });
}

async function answerOpenShifts(): Promise<QuickchatAnswer> {
  const openShifts = await getOpenShiftsPageData();
  const takeable = openShifts.shifts.filter((shift) => !shift.isFull && !shift.isMine);

  return buildOpenShiftsAnswer({
    openCount: takeable.length,
    firstShiftLabel: takeable[0] ? takeable[0].stationName ?? takeable[0].title : null,
  });
}

export async function getQuickchatAnswer(kind: QuickchatQueryKind): Promise<QuickchatAnswer> {
  const { user } = await requireAuthenticatedUser();

  switch (kind) {
    case "schedule":
      return answerSchedule();
    case "next_event":
      return answerNextEvent();
    case "hours":
      return answerHours(user.id);
    case "coworkers":
      return answerCoworkers(user.id);
    case "open_shifts":
      return answerOpenShifts();
    default: {
      const exhaustive: never = kind;
      throw new Error(`Unknown quickchat kind: ${exhaustive}`);
    }
  }
}

/** Kinds whose answer text can safely reach Gemini for rephrasing. `coworkers` never does: its
 * text names other members, and the shared rule bans sending member personal data to any AI
 * model, no exceptions for "just rephrasing." A static allowlist decided server-side, not a
 * client-supplied flag, so a client can't opt a personal-data answer into the model path. */
const REPHRASE_ELIGIBLE_KINDS: ReadonlySet<QuickchatQueryKind> = new Set(["schedule", "next_event", "hours", "open_shifts"]);

export function isRephraseEligible(kind: QuickchatQueryKind): boolean {
  return REPHRASE_ELIGIBLE_KINDS.has(kind);
}
