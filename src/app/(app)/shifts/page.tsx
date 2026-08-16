import { getOpenShiftsPageData } from "@/lib/shifts/data";
import { formatDateInTimeZone, formatTimeInTimeZone } from "@/lib/availability/time";
import { TakeShiftButton } from "@/components/availability/take-shift-button";

export const dynamic = "force-dynamic";

export default async function ShiftsPage() {
  const data = await getOpenShiftsPageData();

  return (
    <div className="flex w-full flex-col">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-purple-400">{data.event.name}</p>
        <h1 className="mt-2 text-3xl font-semibold text-text-primary">Open shifts</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
          Browse shifts that still need people and take one directly.
        </p>
      </div>

      <section className="mt-6 space-y-3">
        {data.shifts.length === 0 ? (
          <div className="rounded-neu border border-hairline bg-bg-sunken p-6 shadow-neu-pressed">
            <h2 className="text-lg font-semibold text-text-primary">No shifts yet</h2>
            <p className="mt-2 text-sm text-text-secondary">Organizers can add shifts from the events page.</p>
          </div>
        ) : (
          data.shifts.map((shift) => (
            <article
              className="rounded-neu border border-hairline bg-bg-surface p-4 shadow-neu-raised-sm"
              key={shift.id}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  {shift.stationName ? (
                    <span className="inline-flex w-fit rounded-neu-sm border border-purple-400/40 bg-purple-500/15 px-2.5 py-1 text-xs font-semibold uppercase text-purple-400">
                      {shift.stationName}
                    </span>
                  ) : null}
                  <h2 className="mt-2 text-xl font-semibold text-text-primary">{shift.title}</h2>
                  <p className="mt-1 font-mono text-sm text-text-secondary">
                    {formatDateInTimeZone(shift.startsAt, data.event.timezone)} ·{" "}
                    {formatTimeInTimeZone(shift.startsAt, data.event.timezone)} to{" "}
                    {formatTimeInTimeZone(shift.endsAt, data.event.timezone)}
                  </p>
                  {shift.location ? <p className="mt-1 text-sm text-text-secondary">{shift.location}</p> : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="font-mono text-sm text-text-secondary">
                    {shift.filledCount}/{shift.requiredPeople} filled
                  </span>
                  <TakeShiftButton isFull={shift.isFull} isMine={shift.isMine} shiftId={shift.id} />
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
