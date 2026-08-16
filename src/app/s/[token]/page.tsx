import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicSchedule } from "@/lib/public/get-schedule";
import type { PublicSchedule } from "@/lib/public/types";
import { formatDateInTimeZone, formatTimeInTimeZone } from "@/lib/availability/time";
// STUB(agent-1): replace with the real primitive once components/ui publishes it.
import { MonoText, Slab } from "@/components/public/_stub-primitives";
import { ScheduleView } from "@/components/public/schedule-view";
import "@/components/public/print.css";

// Token-driven, no auth, no cookies: never statically cache this route across different tokens.
export const dynamic = "force-dynamic";

type PublicSchedulePageProps = {
  params: Promise<{ token: string }>;
};

function formatEventRange(event: PublicSchedule["event"]): string {
  const startDate = formatDateInTimeZone(event.startsAt, event.timezone);
  const endDate = formatDateInTimeZone(event.endsAt, event.timezone);
  const startTime = formatTimeInTimeZone(event.startsAt, event.timezone);
  const endTime = formatTimeInTimeZone(event.endsAt, event.timezone);

  if (startDate === endDate) {
    return `${startDate}, ${startTime} to ${endTime}, ${event.timezone}`;
  }

  return `${startDate} ${startTime} to ${endDate} ${endTime}, ${event.timezone}`;
}

export async function generateMetadata({ params }: PublicSchedulePageProps): Promise<Metadata> {
  const { token } = await params;
  const schedule = await getPublicSchedule(token);

  if (!schedule) {
    return { title: "Schedule not found" };
  }

  return {
    title: schedule.event.name,
    description: formatEventRange(schedule.event),
    openGraph: {
      images: [`/api/og/${token}`],
    },
  };
}

export default async function PublicSchedulePage({ params }: PublicSchedulePageProps) {
  const { token } = await params;
  const schedule = await getPublicSchedule(token);

  if (!schedule) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6">
      <Slab>
        <h1 className="text-3xl font-semibold text-zinc-100">{schedule.event.name}</h1>
        <MonoText className="mt-2 block text-sm text-zinc-400">
          {formatEventRange(schedule.event)}
        </MonoText>

        <div className="mt-6">
          <ScheduleView schedule={schedule} />
        </div>
      </Slab>

      <footer className="pb-6 text-center text-xs text-zinc-600">progsu</footer>
    </main>
  );
}
