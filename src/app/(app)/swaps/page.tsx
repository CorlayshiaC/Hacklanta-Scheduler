import { getSwapsPageData } from "@/lib/swaps/data";
import { formatDateInTimeZone, formatTimeInTimeZone } from "@/lib/availability/time";
import { RequestSwapButton } from "@/components/availability/request-swap-button";

export const dynamic = "force-dynamic";

function swapStatusLabel(status: string, isRequester: boolean): string {
  if (status === "open") return "Open, waiting for someone to claim it";
  if (status === "claimed") return isRequester ? "Claimed, waiting on organizer approval" : "You claimed this";
  if (status === "approved") return "Approved";
  if (status === "declined") return "Declined";
  return "Cancelled";
}

export default async function SwapsPage() {
  const data = await getSwapsPageData();

  return (
    <div className="flex w-full flex-col">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-purple-400">{data.event.name}</p>
        <h1 className="mt-2 text-3xl font-semibold text-text-primary">Swaps</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
          Request a swap from any of your shifts. The board of open requests from other members is not visible
          yet, tracked in docs/contracts/requests.md.
        </p>
      </div>

      <section className="mt-4 space-y-3">
        <h2 className="text-sm font-semibold uppercase text-text-secondary">My shifts</h2>
        {data.myShifts.length === 0 ? (
          <div className="rounded-neu border border-hairline bg-bg-sunken p-6 shadow-neu-pressed">
            <h3 className="text-lg font-semibold text-text-primary">No shifts to swap</h3>
            <p className="mt-2 text-sm text-text-secondary">
              Shifts you are assigned to will show up here with a request-swap option.
            </p>
          </div>
        ) : (
          data.myShifts.map((shift) => (
            <article
              className="flex flex-col gap-3 rounded-neu border border-hairline bg-bg-surface p-4 shadow-neu-raised-sm sm:flex-row sm:items-center sm:justify-between"
              key={shift.assignmentId}
            >
              <div>
                <h3 className="text-lg font-semibold text-text-primary">{shift.shiftTitle}</h3>
                <p className="mt-1 font-mono text-sm text-text-secondary">
                  {formatDateInTimeZone(shift.startsAt, data.event.timezone)} ·{" "}
                  {formatTimeInTimeZone(shift.startsAt, data.event.timezone)} to{" "}
                  {formatTimeInTimeZone(shift.endsAt, data.event.timezone)}
                </p>
                {shift.location ? <p className="mt-1 text-sm text-text-secondary">{shift.location}</p> : null}
              </div>
              <RequestSwapButton
                assignmentId={shift.assignmentId}
                hasOpenRequest={data.myAssignmentIdsWithOpenRequest.has(shift.assignmentId)}
              />
            </article>
          ))
        )}
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase text-text-secondary">My swap requests</h2>
        {data.mySwapRequests.length === 0 ? (
          <div className="rounded-neu border border-hairline bg-bg-sunken p-6 shadow-neu-pressed">
            <p className="text-sm text-text-secondary">No swap requests yet.</p>
          </div>
        ) : (
          data.mySwapRequests.map((request) => (
            <article
              className="flex items-center justify-between rounded-neu border border-hairline bg-bg-surface p-4 shadow-neu-raised-sm"
              key={request.id}
            >
              <div>
                <h3 className="text-base font-semibold text-text-primary">{request.shiftTitle}</h3>
                <p className="mt-1 text-sm text-text-secondary">
                  {request.kind === "drop" ? "Drop request" : "Swap request"} ·{" "}
                  {swapStatusLabel(request.status, request.isRequester)}
                </p>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase text-text-secondary">Open swap requests</h2>
        <div className="rounded-neu border border-hairline bg-bg-sunken p-6 shadow-neu-pressed">
          <p className="text-sm text-text-secondary">
            Requests from other members are not visible here yet. Claim links will appear once that read access
            ships.
          </p>
        </div>
      </section>
    </div>
  );
}
