import { RecurringAvailabilityManager } from "@/components/availability/recurring-availability-manager";
import { getRecurringAvailabilityPageData } from "@/lib/availability/recurring-data";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  const data = await getRecurringAvailabilityPageData();

  return (
    <RecurringAvailabilityManager
      initialWindows={data.windows.map((window) => ({
        day_of_week: window.day_of_week,
        starts_at_local: window.starts_at_local,
        ends_at_local: window.ends_at_local,
      }))}
    />
  );
}
