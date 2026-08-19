import { MemberScheduleWorkspace } from "@/components/member/member-schedule-workspace";
import { getMemberAvailabilityPageData } from "@/lib/availability/data";
import { getDefaultAvailabilityEvent } from "@/lib/availability/event";
import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { getMemberSchedulePageData } from "@/lib/member/schedule";
import { getEventRosterForSwap } from "@/lib/change-requests/data";
import { getOrCreateCalendarToken } from "@/lib/db/calendar-tokens";
import { getSiteUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

type MySchedulePageProps = {
  searchParams?: Promise<{
    result?: string;
    message?: string;
  }>;
};

export default async function MySchedulePage({ searchParams }: MySchedulePageProps) {
  const { profile } = await requireAuthenticatedUser();
  const params = await searchParams;
  const result = params?.result === "error" ? "error" : params?.result === "success" ? "success" : null;
  const event = await getDefaultAvailabilityEvent();
  const [availabilityData, scheduleData, calendarToken, roster] = await Promise.all([
    getMemberAvailabilityPageData(event.id),
    getMemberSchedulePageData(event.id),
    getOrCreateCalendarToken(profile.id),
    getEventRosterForSwap(event.id, profile.id),
  ]);
  const calendarUrl = `${getSiteUrl().replace(/^https?:\/\//, "webcal://")}${calendarToken.url}`;

  return (
    <div className="flex w-full flex-col">
      {params?.message && result ? (
        <p
          className={
            result === "error"
              ? "mb-5 rounded-control bg-accent-warn/10 px-3 py-2 text-sm text-accent-warn"
              : "mb-5 rounded-control bg-accent-primary/10 px-3 py-2 text-sm text-accent-primary-glow"
          }
          role={result === "error" ? "alert" : "status"}
        >
          {params.message}
        </p>
      ) : null}
      <MemberScheduleWorkspace
        availabilityWindows={availabilityData.windows}
        calendarUrl={calendarUrl}
        data={scheduleData}
        roster={roster}
      />
    </div>
  );
}
