"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/neu-card";
import { useCascadeItem } from "@/lib/utils/motion";
import { formatDateInTimeZone } from "@/lib/availability/time";
import type { MemberEventSummary } from "@/lib/member/events";

export function MemberEventsList({ events }: { events: MemberEventSummary[] }) {
  // useCascadeItem, not useEntranceCascade: a semester's published events can plausibly exceed 30,
  // motion-spec.md law 6 ("lists longer than 30 items do not stagger; the first 12 cascade, the
  // rest appear with them").
  const cascade = useCascadeItem();

  if (events.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold text-text-primary">No events yet</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
          Published events will show up here once a director creates one.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event, index) => (
        <motion.div animate="visible" initial="hidden" key={event.id} {...cascade.item(index, events.length)}>
          <Link href={`/my-events/${event.id}`}>
            <Card interactive className="h-full">
              <h3 className="text-lg font-semibold text-text-primary">{event.name}</h3>
              <p className="mt-2 font-mono text-sm text-text-secondary">
                {formatDateInTimeZone(event.starts_at, event.timezone)} to {formatDateInTimeZone(event.ends_at, event.timezone)}
              </p>
              {event.location ? <p className="mt-1 text-sm text-text-secondary">{event.location}</p> : null}
              {event.description ? <p className="mt-3 line-clamp-2 text-sm text-text-secondary">{event.description}</p> : null}
            </Card>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
