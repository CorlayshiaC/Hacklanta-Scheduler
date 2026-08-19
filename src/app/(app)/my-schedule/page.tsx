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
  // Auth stays first and on its own. It is tempting to fold it into the Promise.all below, since
  // getDefaultAvailabilityEvent uses the service-role client and does not depend on the caller, but
  // Promise.all rejects with whichever promise rejects FIRST: requireAuthenticatedUser signals a
  // redirect by throwing, and it throws only after two network round trips, so a faster failure
  // from the event lookup (a fresh instance with no events throws "No event is configured yet.")
  // would win the race and surface an error boundary to a signed-out visitor instead of sending
  // them to /sign-in. It would also mean every unauthenticated hit ran a service-role query before
  // being turned away.
  const { profile } = await requireAuthenticatedUser();

  // These two are genuinely independent and neither can pre-empt a redirect: searchParams is an
  // I/O-free promise and the event lookup is now behind the auth gate. Auth is memoized per request
  // (React cache() in lib/auth/authorization.ts), so the loaders below reuse the resolution above
  // rather than repeating it.
  const [params, event] = await Promise.all([searchParams, getDefaultAvailabilityEvent()]);
  const result = params?.result === "error" ? "error" : params?.result === "success" ? "success" : null;
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
