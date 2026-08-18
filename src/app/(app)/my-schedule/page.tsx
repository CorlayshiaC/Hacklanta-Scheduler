import Link from "next/link";
import { MemberScheduleWorkspace } from "@/components/member/member-schedule-workspace";
import { getMemberAvailabilityPageData } from "@/lib/availability/data";
import { getDefaultAvailabilityEvent } from "@/lib/availability/event";
import { requireAuthenticatedUser } from "@/lib/auth/authorization";
import { getMemberSchedulePageData } from "@/lib/member/schedule";
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
  const [availabilityData, scheduleData, calendarToken] = await Promise.all([
    getMemberAvailabilityPageData(event.id),
    getMemberSchedulePageData(event.id),
    getOrCreateCalendarToken(profile.id),
  ]);
  const calendarUrl = `${getSiteUrl().replace(/^https?:\/\//, "webcal://")}${calendarToken.url}`;

  return (
    <div className="flex w-full flex-col">
      <div>
        <h1 className="text-3xl font-semibold text-text-primary">My schedule</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
          See when you are scheduled to work, then manage when you are available. Open shifts and swaps live at{" "}
          <Link className="text-accent-go hover:underline" href="/shifts">
            Open shifts
          </Link>{" "}
          and{" "}
          <Link className="text-accent-go hover:underline" href="/swaps">
            Swaps
          </Link>
          .
        </p>
      </div>
      {params?.message && result ? (
        <p
          className={
            result === "error"
              ? "mt-5 rounded-pill bg-accent-warn/10 px-3 py-2 text-sm text-accent-warn"
              : "mt-5 rounded-pill bg-accent-go/10 px-3 py-2 text-sm text-accent-go"
          }
          role={result === "error" ? "alert" : "status"}
        >
          {params.message}
        </p>
      ) : null}
      <div className="mt-6">
        <MemberScheduleWorkspace availabilityWindows={availabilityData.windows} calendarUrl={calendarUrl} data={scheduleData} />
      </div>
    </div>
  );
}
