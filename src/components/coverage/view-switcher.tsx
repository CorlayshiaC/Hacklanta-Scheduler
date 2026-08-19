import Link from "next/link";
import { buttonVariants } from "@/components/ui/neu-button";
import { cn } from "@/lib/utils/cn";

export const SCHEDULE_VIEWS = ["person", "station", "day", "list"] as const;
export type ScheduleView = (typeof SCHEDULE_VIEWS)[number];

const VIEW_LABELS: Record<ScheduleView, string> = {
  person: "By person",
  station: "By station",
  day: "Day",
  list: "List",
};

export function parseScheduleView(value: string | undefined): ScheduleView {
  return (SCHEDULE_VIEWS as readonly string[]).includes(value ?? "") ? (value as ScheduleView) : "person";
}

/** URL-held view state: plain links, no client JS needed to switch views. */
export function ViewSwitcher({ eventId, active }: { eventId: string; active: ScheduleView }) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="tablist">
      {SCHEDULE_VIEWS.map((view) => (
        <Link
          aria-selected={view === active}
          className={cn(buttonVariants({ variant: view === active ? "primary" : "default", size: "sm" }))}
          href={view === "person" ? `/coverage/${eventId}` : `/coverage/${eventId}?view=${view}`}
          key={view}
          role="tab"
        >
          {VIEW_LABELS[view]}
        </Link>
      ))}
    </div>
  );
}
