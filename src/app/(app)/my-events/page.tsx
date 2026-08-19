import { MemberEventsList } from "@/components/member/member-events-list";
import { listMemberEvents } from "@/lib/member/events";

export const dynamic = "force-dynamic";

export default async function MyEventsPage() {
  const events = await listMemberEvents();

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold text-text-primary">Events</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
          Browse published progsu events. Open one to see your confirmed shifts, hours, and announcements.
        </p>
      </div>
      <MemberEventsList events={events} />
    </div>
  );
}
