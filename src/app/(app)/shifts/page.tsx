import { getOpenShiftsPageData } from "@/lib/shifts/data";
import { OpenShiftsList } from "@/components/availability/open-shifts-list";
import { PageEntrance } from "@/components/ui/page-entrance";

export const dynamic = "force-dynamic";

export default async function ShiftsPage() {
  const data = await getOpenShiftsPageData();

  // Header then list, one stagger apart. Spacing moves to the cascade's gap so the regions do not
  // also carry their own margins.
  return (
    <PageEntrance className="flex w-full flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-go">{data.event.name}</p>
        <h1 className="mt-2 text-3xl font-semibold text-text-primary">Open shifts</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
          Browse shifts that still need people and take one directly.
        </p>
      </div>

      <section>
        <OpenShiftsList memberHasAvailability={data.memberHasAvailability} shifts={data.shifts} timezone={data.event.timezone} />
      </section>
    </PageEntrance>
  );
}
