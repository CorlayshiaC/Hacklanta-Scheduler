import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicSchedule } from "@/lib/public/get-schedule";
import type { PublicSchedule } from "@/lib/public/types";
import { formatDateInTimeZone, formatTimeInTimeZone } from "@/lib/availability/time";
import { NeuCard } from "@/components/ui/neu-card";
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
    <main className="min-h-screen w-full bg-surface-canvas px-4 py-10 sm:px-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        {/*
          V4: no decorative shapes here, that law is sign-in-page-only. Plain flat Card holding
          the event name/date, no aurora wash/gradient of any kind.
        */}
        <NeuCard>
          <div className="flex flex-col gap-2">
            <h1 className="text-[20px] font-medium text-text-primary">{schedule.event.name}</h1>
            <span className="font-mono tabular-nums text-[13px] text-text-secondary">
              {formatEventRange(schedule.event)}
            </span>
          </div>
        </NeuCard>

        <NeuCard>
          <ScheduleView schedule={schedule} />
        </NeuCard>

        <footer className="pb-6 text-center text-xs text-text-secondary">progsu</footer>
      </div>
    </main>
  );
}
