"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/neu-card";
import { StatBlock } from "@/components/ui/stat-block";
import { Hero } from "@/components/illustration/hero";
import { useCascadeItem, useEntranceCascade } from "@/lib/utils/motion";
import { formatDateInTimeZone, formatTimeInTimeZone } from "@/lib/availability/time";
import { groupMemberAssignmentsByDay } from "@/lib/member/schedule-helpers";
import type { MemberEventDetail as MemberEventDetailData } from "@/lib/member/events";

function formatHours(hours: number) {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function MemberEventDetail({ data }: { data: MemberEventDetailData }) {
  const { event, assignments, hours, announcements } = data;
  const groupedAssignments = groupMemberAssignmentsByDay(assignments, event);
  const dateRange = `${formatDateInTimeZone(event.starts_at, event.timezone)} to ${formatDateInTimeZone(event.ends_at, event.timezone)}`;
  const cascade = useEntranceCascade();
  // A semester's announcements for one event can plausibly exceed 30, so this nested list is
  // capped per motion-spec.md law 6, unlike the outer four-section cascade above it (never more
  // than four sections, no cap needed there).
  const announcementCascade = useCascadeItem();

  return (
    <motion.div animate="visible" className="space-y-5" initial="hidden" variants={cascade.container}>
      <motion.div variants={cascade.item}>
        <Hero>
          <h1 className="font-display text-2xl font-semibold text-text-primary sm:text-3xl">{event.name}</h1>
          <p className="mt-2 font-mono text-sm text-text-secondary">{dateRange}</p>
          {event.location ? <p className="mt-1 text-sm text-text-secondary">{event.location}</p> : null}
          {event.description ? <p className="mt-4 max-w-2xl text-sm leading-6 text-text-primary">{event.description}</p> : null}
        </Hero>
      </motion.div>

      <motion.div variants={cascade.item}>
        <Card className="w-fit" title="My hours">
          <StatBlock animated label="This event" value={formatHours(hours.event)} />
        </Card>
      </motion.div>

      <motion.div className="space-y-4" variants={cascade.item}>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">My schedule</h2>
        {assignments.length === 0 ? (
          <Card>
            <p className="text-sm text-text-secondary">
              No confirmed shifts for this event yet. Once a director approves you for a shift, it appears here.
            </p>
          </Card>
        ) : (
          groupedAssignments.map((group) =>
            group.assignments.length > 0 ? (
              <div className="space-y-2" key={group.value}>
                <h3 className="text-sm font-semibold uppercase text-text-secondary">{group.label}</h3>
                <div className="grid gap-2">
                  {group.assignments.map((assignment) => (
                    <Card key={assignment.id} padded={false} className="p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-accent-go">
                        {assignment.coverageRole?.name ?? "General coverage"}
                      </p>
                      <h4 className="mt-1 text-lg font-semibold text-text-primary">{assignment.shift.title}</h4>
                      <p className="mt-1 font-mono text-sm text-text-secondary">
                        {formatTimeInTimeZone(assignment.shift.starts_at, event.timezone)}
                        {" - "}
                        {formatTimeInTimeZone(assignment.shift.ends_at, event.timezone)}
                      </p>
                      {assignment.shift.location ? <p className="mt-1 text-sm text-text-secondary">{assignment.shift.location}</p> : null}
                    </Card>
                  ))}
                </div>
              </div>
            ) : null,
          )
        )}
      </motion.div>

      <motion.div className="space-y-3" variants={cascade.item}>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Announcements</h2>
        {announcements.length === 0 ? (
          <Card>
            <p className="text-sm text-text-secondary">No announcements for this event yet.</p>
          </Card>
        ) : (
          <div className="grid gap-2">
            {announcements.map((announcement, index) => (
              <motion.div
                animate="visible"
                initial="hidden"
                key={announcement.id}
                {...announcementCascade.item(index, announcements.length)}
              >
                <Card padded={false} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-text-primary">{announcement.authorName}</span>
                    <span className="font-mono text-xs text-text-secondary">
                      {formatDateInTimeZone(announcement.createdAt, event.timezone)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">{announcement.body}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
