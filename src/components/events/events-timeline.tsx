"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/neu-card";
import { TimelinePill, TimelineTrack } from "@/components/coverage/timeline-track";
import { formatShiftDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { useEntranceCascade } from "@/lib/utils/motion";

/**
 * Semester-wide events timeline for the events index. One pill per published event, laid out on
 * a day-granularity TimelineTrack with a today marker. Events don't overlap the way shifts do
 * within a single event's board, so this only stacks rows when two events' date ranges actually
 * overlap (greedy row-packing in start order).
 */

const PX_PER_DAY = 120;
const PX_PER_MS = PX_PER_DAY / 86_400_000;
const ROW_HEIGHT = 40;
const ROW_PAD_TOP = 6;
const PAD_DAYS = 1;
const DATE_LABEL_MIN_WIDTH = 90;

export type EventsTimelineEvent = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
};

function packRows(events: EventsTimelineEvent[]): EventsTimelineEvent[][] {
  const sorted = [...events].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const rows: EventsTimelineEvent[][] = [];

  for (const event of sorted) {
    const eventStart = new Date(event.startsAt).getTime();
    const row = rows.find((candidate) => {
      const last = candidate[candidate.length - 1];
      return new Date(last.endsAt).getTime() <= eventStart;
    });
    if (row) {
      row.push(event);
    } else {
      rows.push([event]);
    }
  }

  return rows;
}

export function EventsTimeline({ events }: { events: EventsTimelineEvent[] }) {
  const cascade = useEntranceCascade();

  if (events.length === 0) {
    return null;
  }

  const starts = events.map((event) => new Date(event.startsAt).getTime());
  const ends = events.map((event) => new Date(event.endsAt).getTime());
  const trackStart = new Date(Math.min(...starts) - PAD_DAYS * 86_400_000);
  const trackEnd = new Date(Math.max(...ends) + PAD_DAYS * 86_400_000);
  const timeZone = events[0].timezone;

  const rows = packRows(events);

  return (
    <Card title="This semester">
      <div className="overflow-x-auto">
        <TimelineTrack
          axisUnit="day"
          contentHeight={rows.length * ROW_HEIGHT}
          end={trackEnd}
          pxPerMs={PX_PER_MS}
          start={trackStart}
          timeZone={timeZone}
        >
          <motion.div animate="visible" initial="hidden" variants={cascade.container}>
            {rows.map((row, rowIndex) =>
              row.map((event) => (
                <TimelinePill
                  end={event.endsAt}
                  key={event.id}
                  pxPerMs={PX_PER_MS}
                  start={event.startsAt}
                  top={rowIndex * ROW_HEIGHT + ROW_PAD_TOP}
                  trackStart={trackStart}
                >
                  <motion.div variants={cascade.item}>
                    <Link
                      className={cn(
                        "flex h-7 items-center gap-2 truncate rounded-pill bg-accent-go px-3 py-1.5 text-xs font-semibold text-on-accent",
                        "transition-opacity duration-fast ease-neu-out hover:opacity-90",
                      )}
                      href={"/events/" + event.id}
                    >
                      <span className="truncate">{event.name}</span>
                      <TimelinePillDate event={event} timeZone={timeZone} />
                    </Link>
                  </motion.div>
                </TimelinePill>
              )),
            )}
          </motion.div>
        </TimelineTrack>
      </div>
    </Card>
  );
}

function TimelinePillDate({ event, timeZone }: { event: EventsTimelineEvent; timeZone: string }) {
  const width = Math.max(24, (new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime()) * PX_PER_MS);
  if (width <= DATE_LABEL_MIN_WIDTH) {
    return null;
  }
  return <span className="shrink-0 font-mono text-[10px] tabular-nums opacity-80">{formatShiftDate(event.startsAt, timeZone)}</span>;
}
