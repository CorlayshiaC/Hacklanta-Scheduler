import { RecurringAvailabilityManager } from "@/components/availability/recurring-availability-manager";
import { PageEntrance } from "@/components/ui/page-entrance";
import { getRecurringAvailabilityPageData } from "@/lib/availability/recurring-data";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  const data = await getRecurringAvailabilityPageData();

  // The manager animates its own cells while you paint, but nothing brought the page in. One
  // region here, so this is a rise-in rather than a cascade.
  return (
    <PageEntrance>
      <RecurringAvailabilityManager
        initialWindows={data.windows.map((window) => ({
          day_of_week: window.day_of_week,
          starts_at_local: window.starts_at_local,
          ends_at_local: window.ends_at_local,
        }))}
      />
    </PageEntrance>
  );
}
