"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { AvailabilityManager } from "@/components/availability/availability-manager";
import { RequestChangeSheet } from "@/components/availability/request-change-sheet";
import { QuickchatRow } from "@/components/quickchat";
import { Card } from "@/components/ui/neu-card";
import { GradientPanel } from "@/components/ui/gradient-panel";
import { StatBlock } from "@/components/ui/stat-block";
import { StatusPill, type StatusPillState } from "@/components/ui/status-pill";
import { buttonVariants as pillButtonVariants } from "@/components/ui/neu-button";
import { Hero } from "@/components/illustration/hero";
import { TimelinePill, TimelineTrack } from "@/components/ui/timeline-track";
import {
  drawInDelay,
  EASE_OUT_FAST,
  GLINT_KEYFRAMES,
  glintTransition,
  useCountdown,
  useDrawIn,
  useHeroEntrance,
  useMotionPreset,
} from "@/lib/utils/motion";
import { subscribeToShiftAssignments, unsubscribe } from "@/lib/db/realtime";
import { formatDateInTimeZone, formatTimeInTimeZone } from "@/lib/availability/time";
import { getMemberScheduleSummary, groupMemberAssignmentsByDay } from "@/lib/member/schedule-helpers";
import type { AssignmentState, MemberScheduleAssignment, MemberSchedulePageData } from "@/lib/member/schedule";
import type { AvailabilityWindow } from "@/lib/availability/data";
import type { RosterMember } from "@/lib/change-requests/data";

type MemberScheduleWorkspaceProps = {
  availabilityWindows: AvailabilityWindow[];
  calendarUrl: string | null;
  data: MemberSchedulePageData;
  roster: RosterMember[];
};

function formatHours(hours: number) {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

/** "3d 4h" down to the minute, then "45s" in the final minute, then "Now". Formatting layer over
 * useCountdown's raw seconds-remaining (motion-spec.md section 6): the hook owns the once-per-second
 * tick and the isFinalMinute flag, this just renders the number into the same "3d 4h" shape the
 * dashboard has always shown. */
function formatSecondsRemaining(totalSeconds: number): string {
  if (totalSeconds <= 0) return "Now";

  const totalMinutes = Math.floor(totalSeconds / 60);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${totalSeconds}s`;
}

function NextShiftCountdown({ targetIso }: { targetIso: string }) {
  const { secondsRemaining, isFinalMinute } = useCountdown(new Date(targetIso).getTime());

  return (
    <span
      className={`font-mono text-3xl font-bold leading-none tabular-nums transition-colors duration-1000 md:text-4xl ${
        isFinalMinute ? "text-accent-warn" : "text-text-primary"
      }`}
    >
      {formatSecondsRemaining(secondsRemaining)}
    </span>
  );
}

/** Gates a value's first reveal until `delayMs` after mount, so a StatBlock's count-up "begins the
 * frame its card lands" (motion-spec.md section 3) instead of rolling to completion while the card
 * is still fading in behind it. Collapses to an immediate reveal under reduced motion, per law 5. */
function useRevealAfter(delayMs: number): boolean {
  const reduced = useReducedMotion();
  // Covers the reduced-motion/no-delay case at mount; the effect below only ever needs to arm a
  // timer for the remaining case (a real delay, motion not reduced), never call setState directly
  // in its own body, satisfying react-hooks/set-state-in-effect.
  const [revealed, setRevealed] = useState(reduced || delayMs === 0);

  useEffect(() => {
    if (reduced || delayMs === 0) return;
    const timer = window.setTimeout(() => setRevealed(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, reduced]);

  return revealed;
}

/**
 * TimelinePill (components/ui/timeline-track.tsx, Agent 1's file) has no children slot, so the
 * drawIn sweep happens one level up, on this per-lane wrapper: transform-scaling the whole lane is
 * the only way to sweep an absolutely positioned child in from the left without editing a primitive
 * that isn't mine to edit. Same reasoning for the approval-flip cue: motion-spec.md section 7's
 * "the row's hairline glints once" reads correctly as a full-width row glint (GLINT_KEYFRAMES,
 * glintTransition(500), the self-approval duration) rendered as a sibling hairline under the pill,
 * not a bespoke layer inside a primitive with no slot for one.
 */
function ScheduleStripLane({
  assignment,
  index,
  justApproved,
  laneEntranceDelayMs,
  timezone,
}: {
  assignment: MemberScheduleAssignment;
  index: number;
  justApproved: boolean;
  laneEntranceDelayMs: number;
  timezone: string;
}) {
  const drawIn = useDrawIn();
  const label = `${formatDateInTimeZone(assignment.shift.starts_at, timezone)} ${formatTimeInTimeZone(assignment.shift.starts_at, timezone)}`;
  // motion-spec.md section 4: stagger-bars, capped at the first 24 bars, remainder lands with the
  // 24th (drawInDelay's own doc comment: clamp the index yourself for longer lists).
  const cappedIndex = Math.min(index, 24);

  return (
    <motion.div
      animate="visible"
      className="relative h-7 origin-left"
      initial="hidden"
      transition={{ ...drawIn.transition, delay: laneEntranceDelayMs / 1000 + drawInDelay(cappedIndex) }}
      variants={drawIn.variants}
    >
      <TimelinePill end={assignment.shift.ends_at} label={label} start={assignment.shift.starts_at} tone={assignment.state === "approved" ? "go" : "warn"} />
      {justApproved ? (
        <motion.span
          aria-hidden
          animate={{ opacity: GLINT_KEYFRAMES }}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-accent-primary-glow"
          transition={glintTransition(500)}
        />
      ) : null}
    </motion.div>
  );
}

export function MemberScheduleWorkspace({ availabilityWindows, calendarUrl, data, roster }: MemberScheduleWorkspaceProps) {
  // Local overrides from realtime events only, never a full mirror of `data.assignments`: merging
  // the two during render (below) avoids both re-mirroring a prop into state on every server
  // refetch (react-hooks/set-state-in-effect) and reading/writing a ref during render
  // (react-hooks/refs) to detect that refetch, since neither is allowed in this codebase's lint
  // config.
  const [statePatches, setStatePatches] = useState<Map<string, AssignmentState>>(new Map());
  const [justApprovedIds, setJustApprovedIds] = useState<Set<string>>(new Set());

  const assignments = useMemo(
    () =>
      data.assignments.map((assignment) =>
        statePatches.has(assignment.id) ? { ...assignment, state: statePatches.get(assignment.id) as AssignmentState } : assignment,
      ),
    [data.assignments, statePatches],
  );

  const shiftIds = useMemo(() => Array.from(new Set(data.assignments.map((assignment) => assignment.shift.id))), [data.assignments]);

  // Live "your shift just got approved" sweep: patches the affected capsule's state in place and
  // flags it for a brief highlight, rather than waiting on a full page refresh to see the flip.
  // Re-subscribes whenever the server hands us fresh assignments (a `router.refresh()` elsewhere,
  // e.g. after submitting a change request), which also refreshes the "was it previously not
  // approved" baseline this effect compares each event against.
  useEffect(() => {
    if (shiftIds.length === 0) return;

    const baselineStates = new Map(data.assignments.map((assignment) => [assignment.id, assignment.state]));

    const channel = subscribeToShiftAssignments(shiftIds, ({ eventType, row }) => {
      if (eventType !== "UPDATE" || !row || row.profile_id !== data.profile.id) return;

      setStatePatches((current) => {
        const next = new Map(current);
        next.set(row.id, row.state);
        return next;
      });

      const previousState = baselineStates.get(row.id);
      if (previousState && previousState !== "approved" && row.state === "approved") {
        setJustApprovedIds((current) => new Set(current).add(row.id));
        window.setTimeout(() => {
          setJustApprovedIds((current) => {
            const next = new Set(current);
            next.delete(row.id);
            return next;
          });
        }, 600);
      }
    });

    return () => unsubscribe(channel);
  }, [shiftIds, data.assignments, data.profile.id]);

  // Memoized for the same reason `assignments` and `shiftIds` above already are: this component
  // re-renders on the 220ms hours reveal, on every realtime state patch, and twice per approval
  // glint, and each of those re-renders reaches down into AvailabilityManager and its ~336-cell
  // grid. groupMemberAssignmentsByDay is the expensive one: it filters every assignment per day and
  // constructs an Intl.DateTimeFormat inside the filter predicate, so it was days x assignments
  // formatter constructions on every one of those renders. Same inputs, same output, just not
  // recomputed when nothing it reads has changed.
  const groupedAssignments = useMemo(
    () => groupMemberAssignmentsByDay(assignments, data.event),
    [assignments, data.event],
  );
  const summary = useMemo(() => getMemberScheduleSummary(assignments), [assignments]);
  const nextAssignment = summary.nextAssignment;
  const dateRange = useMemo(
    () =>
      `${formatDateInTimeZone(data.event.starts_at, data.event.timezone)} to ${formatDateInTimeZone(
        data.event.ends_at,
        data.event.timezone,
      )}`,
    [data.event.starts_at, data.event.ends_at, data.event.timezone],
  );
  const upcomingStatus: StatusPillState = nextAssignment?.state ?? "not_assigned";

  const heroEntrance = useHeroEntrance();
  const riseEntrance = useMotionPreset();
  const today = useMemo(
    () => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date()),
    [],
  );
  const hoursRevealed = useRevealAfter(220);
  // motion-spec.md section 4: this strip's own bars draw in relative to the timeline card's own
  // 320ms landing, not from t=0, so the sweep visibly starts once the card itself has arrived.
  const TIMELINE_ENTRANCE_DELAY_MS = 320;

  return (
    <div className="space-y-5">
      {/* motion-spec.md section 3, exact sequence (Agent 4's dashboard choreography), a single
          timeline under 700ms, fires once per navigation (law 2: no cascade container/item pair
          here, every element gets its own explicit delay against the 0ms baseline below). */}
      <motion.div animate={{ opacity: 1 }} initial={{ opacity: 0 }} transition={EASE_OUT_FAST}>
        <h1 className="text-3xl font-semibold text-text-primary">My schedule</h1>
        <p className="mt-1 font-mono text-sm text-text-secondary">{today}</p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
          See when you are scheduled to work, then manage when you are available. Open shifts and swaps live at{" "}
          <Link className="text-accent-primary-glow hover:underline" href="/shifts">
            Open shifts
          </Link>{" "}
          and{" "}
          <Link className="text-accent-primary-glow hover:underline" href="/swaps">
            Swaps
          </Link>
          .
        </p>
      </motion.div>

      {/* 60ms: hero card, entrance-rise-large on spring-gentle. */}
      <motion.div animate="visible" initial="hidden" transition={{ ...heroEntrance.transition, delay: 0.06 }} variants={heroEntrance.variants}>
        <Hero>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{data.event.name}</h2>
              <p className="mt-2 font-mono text-sm text-text-secondary">{dateRange}</p>
              {data.event.location ? <p className="mt-1 text-sm text-text-secondary">{data.event.location}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {calendarUrl ? (
                  <a className={pillButtonVariants({ variant: "primary" })} href={calendarUrl}>
                    Add to calendar
                  </a>
                ) : null}
                {nextAssignment ? (
                  <RequestChangeSheet
                    assignment={{ id: nextAssignment.id, shiftTitle: nextAssignment.shift.title }}
                    eventId={data.event.id}
                    roster={roster}
                  />
                ) : null}
              </div>
            </div>
            <StatusPill state={upcomingStatus} />
          </div>
        </Hero>
      </motion.div>

      {/* 140ms: the one gradient panel on this view (Ask Proggy), entrance-rise on spring-standard.
          Chip contents and their own cascade are Agent 6's QuickchatRow; requested the 220ms
          stagger-tight chip cascade from them in requests.md since that needs an edit inside their
          file, not mine to make. */}
      <motion.div
        animate="visible"
        initial="hidden"
        transition={{ ...riseEntrance.transition, delay: 0.14 }}
        variants={riseEntrance.variants}
      >
        <GradientPanel>
          <p className="text-sm font-semibold text-text-primary">Ask Proggy</p>
          <div className="mt-3">
            <QuickchatRow />
          </div>
        </GradientPanel>
      </motion.div>

      {/* 180 to 260ms: three stat cards, entrance-rise on spring-standard, stagger-standard apart. */}
      <div className="grid items-stretch gap-3 sm:grid-cols-3">
        <motion.div className="h-full" animate="visible" initial="hidden" transition={{ ...riseEntrance.transition, delay: 0.18 }} variants={riseEntrance.variants}>
          <Card hoverLift className="h-full" title="Next shift">
            {nextAssignment ? (
              <>
                <span className="inline-flex w-fit items-center rounded-control bg-elevated px-2.5 py-1 text-xs font-semibold uppercase text-text-secondary">
                  {nextAssignment.coverageRole?.name ?? "General coverage"}
                </span>
                <div className="mt-2 flex flex-col gap-1">
                  <NextShiftCountdown targetIso={nextAssignment.shift.starts_at} />
                  <span className="truncate text-xs font-medium uppercase tracking-wide text-text-secondary">{nextAssignment.shift.title}</span>
                </div>
                {nextAssignment.shift.location ? <p className="mt-1 text-sm text-text-secondary">{nextAssignment.shift.location}</p> : null}
              </>
            ) : (
              <p className="text-sm text-text-secondary">No shift scheduled yet.</p>
            )}
          </Card>
        </motion.div>

        <motion.div className="h-full" animate="visible" initial="hidden" transition={{ ...riseEntrance.transition, delay: 0.22 }} variants={riseEntrance.variants}>
          <Card hoverLift className="h-full" title="Hours for next event">
            <StatBlock animated label="This event" value={hoursRevealed ? formatHours(data.hours.event) : 0} />
            <p className="mt-3 font-mono text-sm text-text-secondary">
              {formatHours(data.hours.semester)}h <span className="text-xs uppercase tracking-wide text-text-secondary">Semester total</span>
            </p>
          </Card>
        </motion.div>

        <motion.div className="h-full" animate="visible" initial="hidden" transition={{ ...riseEntrance.transition, delay: 0.26 }} variants={riseEntrance.variants}>
          <Card hoverLift className="h-full" title="Schedule status">
            <StatusPill state={upcomingStatus} />
            <p className="mt-2 text-sm text-text-secondary">
              {upcomingStatus === "approved"
                ? "Your next shift is confirmed."
                : upcomingStatus === "in_approval"
                  ? "Waiting on approval."
                  : "No shift assigned yet."}
            </p>
          </Card>
        </motion.div>
      </div>

      {/* 320ms: timeline card, entrance-rise. Bars inside draw in relative to this delay, see
          ScheduleStripLane. The "today line draws top to bottom, last" and "markers fade in left to
          right" pieces are internal to TimelineTrack (Agent 1's file, no hook exposed for either),
          requested in requests.md rather than reimplemented from outside a closed primitive. */}
      {assignments.length > 0 ? (
        <motion.div
          animate="visible"
          initial="hidden"
          transition={{ ...riseEntrance.transition, delay: TIMELINE_ENTRANCE_DELAY_MS / 1000 }}
          variants={riseEntrance.variants}
        >
          <Card hoverLift padded={false} className="overflow-x-auto p-3" title="This week">
            <TimelineTrack pxPerDay={96} rangeStart={data.event.starts_at} rangeEnd={data.event.ends_at}>
              {assignments.map((assignment, index) => (
                <ScheduleStripLane
                  assignment={assignment}
                  index={index}
                  justApproved={justApprovedIds.has(assignment.id)}
                  key={assignment.id}
                  laneEntranceDelayMs={TIMELINE_ENTRANCE_DELAY_MS}
                  timezone={data.event.timezone}
                />
              ))}
            </TimelineTrack>
          </Card>
        </motion.div>
      ) : null}

      {/* Two placed rows: schedule and the availability rail sit side by side, then the paint grid
          spans the full width underneath. The grid used to live in the 360px rail, where a whole
          week of half-hour cells had room to show about four hours at a time. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4 lg:col-start-1 lg:row-start-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-go">My schedule</p>
            <h2 className="mt-2 text-2xl font-semibold text-text-primary">When you are scheduled to work.</h2>
          </div>

          {assignments.length === 0 ? (
            <Card>
              <h3 className="text-lg font-semibold text-text-primary">No shifts assigned yet</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
                Your availability has been submitted. Your schedule will appear here once a director or admin
                assigns you to a shift.
              </p>
            </Card>
          ) : (
            groupedAssignments.map((group) =>
              group.assignments.length > 0 ? (
                <div className="space-y-3" key={group.value}>
                  <h3 className="text-sm font-semibold uppercase text-text-secondary">{group.label}</h3>
                  <div className="grid gap-3">
                    {group.assignments.map((assignment) => (
                      <Card interactive key={assignment.id} padded={false} className="p-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-accent-go">
                              {assignment.coverageRole?.name ?? "General coverage"}
                            </p>
                            <h4 className="mt-2 text-xl font-semibold text-text-primary">{assignment.shift.title}</h4>
                            <p className="mt-2 font-mono text-sm text-text-secondary">
                              {formatDateInTimeZone(assignment.shift.starts_at, data.event.timezone)} ·{" "}
                              {formatTimeInTimeZone(assignment.shift.starts_at, data.event.timezone)}
                              {" - "}
                              {formatTimeInTimeZone(assignment.shift.ends_at, data.event.timezone)}
                            </p>
                          </div>
                          <StatusPill state={assignment.state} />
                        </div>

                        <div className="mt-3 grid gap-3 text-sm text-text-secondary sm:grid-cols-2">
                          <p>
                            <span className="block font-medium text-text-primary">Coverage role</span>
                            {assignment.coverageRole?.name ?? "General coverage"}
                          </p>
                          {assignment.shift.location ? (
                            <p>
                              <span className="block font-medium text-text-primary">Location</span>
                              {assignment.shift.location}
                            </p>
                          ) : null}
                        </div>

                        {assignment.state === "in_approval" ? (
                          <p className="mt-3 rounded-card bg-elevated p-3 text-sm text-accent-warn">Waiting on approval.</p>
                        ) : null}

                        {assignment.shift.notes ? (
                          <p className="mt-3 text-sm leading-6 text-text-secondary">
                            <span className="font-medium text-text-primary">Notes: </span>
                            {assignment.shift.notes}
                          </p>
                        ) : null}

                        <div className="mt-3">
                          <RequestChangeSheet
                            assignment={{ id: assignment.id, shiftTitle: assignment.shift.title }}
                            eventId={data.event.id}
                            roster={roster}
                            trigger={
                              <button className={pillButtonVariants({ variant: "ghost", size: "sm" })} type="button">
                                Request a change
                              </button>
                            }
                          />
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : null,
            )
          )}

          <Link className="text-sm font-medium text-accent-go hover:underline" href="/swaps">
            View swap board and change requests
          </Link>
        </section>

        <AvailabilityManager
          event={data.event}
          gridClassName="lg:col-span-2 lg:row-start-2"
          showEventHeader={false}
          summaryClassName="lg:col-start-2 lg:row-start-1 lg:flex lg:h-full lg:flex-col"
          summaryHeader={
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-go">My availability</p>
              <h2 className="mt-1 text-xl font-semibold text-text-primary">When you can work.</h2>
            </div>
          }
          summaryFooter={
            // Fills the rail the grid vacated with the one thing this page could not do before:
            // reach the recurring weekly availability screen, which nothing else here linked to.
            <Card hoverLift padded={false} className="p-4 lg:flex lg:flex-1 lg:flex-col lg:justify-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Every week</p>
              <p className="mt-2 text-sm text-text-secondary">
                Free at the same times most weeks? Set it once instead of painting each event.
              </p>
              <Link
                className="mt-3 inline-flex text-sm font-medium text-accent-go hover:underline"
                href="/availability"
              >
                Set weekly availability
              </Link>
            </Card>
          }
          windows={availabilityWindows}
        />
      </div>
    </div>
  );
}
