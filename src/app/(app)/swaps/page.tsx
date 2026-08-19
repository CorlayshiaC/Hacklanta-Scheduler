import { getChangeRequestsPageData, getEventRosterForSwap } from "@/lib/change-requests/data";
import { CHANGE_REQUEST_KIND_LABELS, type ChangeRequestState } from "@/lib/change-requests/types";
import { formatDateInTimeZone, formatTimeInTimeZone } from "@/lib/availability/time";
import { RequestChangeSheet } from "@/components/availability/request-change-sheet";
import { ClaimChangeRequestButton } from "@/components/availability/claim-change-request-button";
import { Card } from "@/components/ui/neu-card";
import { PageEntrance } from "@/components/ui/page-entrance";

export const dynamic = "force-dynamic";

function changeRequestStatusPillClass(state: ChangeRequestState): string {
  if (state === "open") return "bg-elevated text-text-secondary";
  // accent-warn-fill, not accent-warn: the everyday champagne shade fails contrast under
  // on-accent white text, see tokens.css's fill-vs-glow split.
  if (state === "claimed") return "bg-accent-warn-fill text-on-accent";
  if (state === "approved") return "bg-accent-go text-on-accent";
  if (state === "declined") return "bg-accent-warn/20 text-accent-warn";
  return "bg-elevated text-text-muted";
}

function changeRequestStatusLabel(state: ChangeRequestState, isRequester: boolean): string {
  if (state === "open") return "Open, waiting for someone to claim it";
  if (state === "claimed") return isRequester ? "Claimed, waiting on director approval" : "You claimed this";
  if (state === "approved") return "Approved";
  if (state === "declined") return "Declined";
  return "Cancelled";
}

export default async function SwapsPage() {
  const data = await getChangeRequestsPageData();
  const roster = await getEventRosterForSwap(data.event.id, data.profile.id);

  // Header, then each section, one stagger apart.
  return (
    <PageEntrance className="flex w-full flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-go">{data.event.name}</p>
        <h1 className="mt-2 text-3xl font-semibold text-text-primary">Swaps</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
          Request a change on any of your shifts, or claim an open swap from another member.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-text-secondary">My shifts</h2>
        {data.myShifts.length === 0 ? (
          <Card>
            <h3 className="text-lg font-semibold text-text-primary">No shifts to change</h3>
            <p className="mt-2 text-sm text-text-secondary">
              Shifts you are assigned to will show up here with a request-a-change option.
            </p>
          </Card>
        ) : (
          data.myShifts.map((shift) => (
            <Card hoverLift key={shift.assignmentId} padded={false} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">{shift.shiftTitle}</h3>
                <p className="mt-1 font-mono text-sm text-text-secondary">
                  {formatDateInTimeZone(shift.startsAt, data.event.timezone)} ·{" "}
                  {formatTimeInTimeZone(shift.startsAt, data.event.timezone)} to{" "}
                  {formatTimeInTimeZone(shift.endsAt, data.event.timezone)}
                </p>
                {shift.location ? <p className="mt-1 text-sm text-text-secondary">{shift.location}</p> : null}
              </div>
              {data.myAssignmentIdsWithOpenRequest.has(shift.assignmentId) ? (
                <span className="inline-flex w-fit items-center rounded-pill border border-accent-warn bg-transparent px-3 py-2 text-sm font-semibold text-accent-warn">
                  Request pending
                </span>
              ) : (
                <RequestChangeSheet
                  assignment={{ id: shift.assignmentId, shiftTitle: shift.shiftTitle }}
                  eventId={data.event.id}
                  roster={roster}
                />
              )}
            </Card>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-text-secondary">My requests</h2>
        {data.myRequests.length === 0 ? (
          <Card>
            <p className="text-sm text-text-secondary">No change requests yet.</p>
          </Card>
        ) : (
          data.myRequests.map((request) => (
            <Card key={request.id} padded={false} className="flex items-center justify-between p-4">
              <div>
                <h3 className="text-base font-semibold text-text-primary">{request.shiftTitle}</h3>
                <p className="mt-1 text-sm text-text-secondary">{CHANGE_REQUEST_KIND_LABELS[request.kind]}</p>
              </div>
              <span className={`inline-flex w-fit items-center rounded-pill px-3 py-1.5 text-xs font-semibold uppercase ${changeRequestStatusPillClass(request.state)}`}>
                {changeRequestStatusLabel(request.state, request.isRequester)}
              </span>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-text-secondary">Open swap requests</h2>
        {data.openBoard.length === 0 ? (
          <Card>
            <p className="text-sm text-text-secondary">No open requests from other members right now.</p>
          </Card>
        ) : (
          data.openBoard.map((request) => (
            <Card hoverLift key={request.id} padded={false} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="inline-flex w-fit items-center rounded-pill bg-elevated px-2.5 py-1 text-xs font-semibold uppercase text-text-secondary">
                  {request.kind === "swap_with" ? "Swap (with you)" : "Swap"}
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
              <ClaimChangeRequestButton changeRequestId={request.id} />
            </Card>
          ))
        )}
      </section>
    </PageEntrance>
  );
}
