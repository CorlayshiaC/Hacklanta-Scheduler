import { getSwapsPageData } from "@/lib/swaps/data";
import { formatDateInTimeZone, formatTimeInTimeZone } from "@/lib/availability/time";
import { RequestSwapButton } from "@/components/availability/request-swap-button";
import { ClaimSwapButton } from "@/components/availability/claim-swap-button";
import { Card } from "@/components/ui/neu-card";

export const dynamic = "force-dynamic";

function swapStatusPillClass(status: string): string {
  if (status === "open") return "bg-elevated text-text-secondary";
  if (status === "claimed") return "bg-accent-warn text-on-accent";
  if (status === "approved") return "bg-accent-go text-on-accent";
  if (status === "declined") return "bg-accent-warn/20 text-accent-warn";
  return "bg-elevated text-text-muted";
}

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
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-go">{data.event.name}</p>
        <h1 className="mt-2 text-3xl font-semibold text-text-primary">Swaps</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
          Request a swap from any of your shifts, or claim an open request from another member.
        </p>
      </div>

      <section className="mt-4 space-y-3">
        <h2 className="text-sm font-semibold uppercase text-text-secondary">My shifts</h2>
        {data.myShifts.length === 0 ? (
          <Card>
            <h3 className="text-lg font-semibold text-text-primary">No shifts to swap</h3>
            <p className="mt-2 text-sm text-text-secondary">
              Shifts you are assigned to will show up here with a request-swap option.
            </p>
          </Card>
        ) : (
          data.myShifts.map((shift) => (
            <Card key={shift.assignmentId} padded={false} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
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
            </Card>
          ))
        )}
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase text-text-secondary">My swap requests</h2>
        {data.mySwapRequests.length === 0 ? (
          <Card>
            <p className="text-sm text-text-secondary">No swap requests yet.</p>
          </Card>
        ) : (
          data.mySwapRequests.map((request) => (
            <Card key={request.id} padded={false} className="flex items-center justify-between p-4">
              <div>
                <h3 className="text-base font-semibold text-text-primary">{request.shiftTitle}</h3>
                <p className="mt-1 text-sm text-text-secondary">{request.kind === "drop" ? "Drop request" : "Swap request"}</p>
              </div>
              <span className={`inline-flex w-fit items-center rounded-pill px-3 py-1.5 text-xs font-semibold uppercase ${swapStatusPillClass(request.status)}`}>
                {swapStatusLabel(request.status, request.isRequester)}
              </span>
            </Card>
          ))
        )}
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase text-text-secondary">Open swap requests</h2>
        {data.openBoard.length === 0 ? (
          <Card>
            <p className="text-sm text-text-secondary">No open requests from other members right now.</p>
          </Card>
        ) : (
          data.openBoard.map((request) => (
            <Card key={request.id} padded={false} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="inline-flex w-fit items-center rounded-pill bg-elevated px-2.5 py-1 text-xs font-semibold uppercase text-text-secondary">
                  {request.kind === "drop" ? "Drop" : "Swap"}
                </span>
                <h3 className="mt-2 text-lg font-semibold text-text-primary">{request.shiftTitle}</h3>
                <p className="mt-1 font-mono text-sm text-text-secondary">
                  {formatDateInTimeZone(request.startsAt, data.event.timezone)} ·{" "}
                  {formatTimeInTimeZone(request.startsAt, data.event.timezone)} to{" "}
                  {formatTimeInTimeZone(request.endsAt, data.event.timezone)}
                </p>
                {request.location ? <p className="mt-1 text-sm text-text-secondary">{request.location}</p> : null}
                <p className="mt-2 text-sm text-text-secondary">Posted by {request.requestedByName}</p>
                {request.note ? <p className="mt-1 text-sm text-text-secondary">&ldquo;{request.note}&rdquo;</p> : null}
              </div>
              <ClaimSwapButton swapRequestId={request.id} />
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
