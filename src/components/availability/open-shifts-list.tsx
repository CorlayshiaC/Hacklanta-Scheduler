"use client";

import { useMemo, useState } from "react";
import { formatDateInTimeZone, formatTimeInTimeZone } from "@/lib/availability/time";
import { TakeShiftButton } from "@/components/availability/take-shift-button";
import { Card } from "@/components/ui/neu-card";
import { ShiftCapsule, type ShiftCapsuleState } from "@/components/ui/shift-capsule";
import { FilterPill } from "@/components/ui/filter-pill";
import type { OpenShift } from "@/lib/shifts/data";

type OpenShiftsListProps = {
  shifts: OpenShift[];
  timezone: string;
  memberHasAvailability: boolean;
};

const FIT_OPTIONS = [
  { value: "fits", label: "My availability" },
  { value: "all", label: "All shifts" },
];

function capsuleState(shift: OpenShift): ShiftCapsuleState {
  if (shift.filledCount === 0) return "empty";
  if (shift.isFull) return "full";
  return "partial";
}

export function OpenShiftsList({ shifts, timezone, memberHasAvailability }: OpenShiftsListProps) {
  const [fit, setFit] = useState(memberHasAvailability ? "fits" : "all");
  const visible = useMemo(
    () => (fit === "fits" ? shifts.filter((shift) => shift.fitsAvailability) : shifts),
    [shifts, fit],
  );

  return (
    <div className="space-y-3">
      <FilterPill label="Fits" onValueChange={setFit} options={FIT_OPTIONS} value={fit} />

      {visible.length === 0 ? (
        <Card className="bg-card">
          <h2 className="text-lg font-semibold text-text-primary">
            {shifts.length === 0 ? "No shifts yet" : "No shifts match your availability"}
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            {shifts.length === 0
              ? "Organizers can add shifts from the events page."
              : "Switch the filter to All shifts, or paint more availability."}
          </p>
        </Card>
      ) : (
        visible.map((shift) => (
          <Card key={shift.id} padded={false} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {shift.stationName ? (
                <span className="inline-flex w-fit items-center rounded-pill bg-elevated px-2.5 py-1 text-xs font-semibold uppercase text-text-secondary">
                  {shift.stationName}
                </span>
              ) : null}
              <h2 className="mt-2 text-xl font-semibold text-text-primary">{shift.title}</h2>
              <p className="mt-1 font-mono text-sm text-text-secondary">
                {formatDateInTimeZone(shift.startsAt, timezone)} · {formatTimeInTimeZone(shift.startsAt, timezone)} to{" "}
                {formatTimeInTimeZone(shift.endsAt, timezone)}
              </p>
              {shift.location ? <p className="mt-1 text-sm text-text-secondary">{shift.location}</p> : null}
            </div>
            <div className="flex flex-col items-end gap-2">
              <ShiftCapsule
                className="w-auto"
                filled={shift.filledCount}
                members={shift.assignedMembers}
                needed={shift.requiredPeople}
                state={capsuleState(shift)}
              />
              <TakeShiftButton isFull={shift.isFull} isMine={shift.isMine} shiftId={shift.id} />
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
