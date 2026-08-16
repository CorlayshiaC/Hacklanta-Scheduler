import {
  assignShiftCandidateAction,
  createShiftAction,
  removeShiftAction,
  removeShiftAssignmentAction,
  updateShiftAction,
} from "@/lib/admin/shifts/actions";
import type {
  AdminShift,
  CoverageRoleRow,
  ShiftRoleRow,
} from "@/lib/admin/shifts/data";
import {
  formatDateInTimeZone,
  formatInputDateInTimeZone,
  formatInputTimeInTimeZone,
  formatTimeInTimeZone,
} from "@/lib/availability/time";
import type { recommendCandidates } from "@/lib/scheduling/recommendations";

type RecommendationSet = ReturnType<typeof recommendCandidates>;

type ShiftManagementProps = {
  coverageRoles: CoverageRoleRow[];
  shiftRoles: ShiftRoleRow[];
  shifts: AdminShift[];
  candidatesByShiftRole: Record<string, RecommendationSet>;
  eventTimezone: string;
  returnPath?: "/admin/schedule" | "/admin/shifts";
};

const eventDates = [
  { label: "Friday, Oct 9", value: "2026-10-09" },
  { label: "Saturday, Oct 10", value: "2026-10-10" },
  { label: "Sunday, Oct 11", value: "2026-10-11" },
];

const inputClass =
  "hl-input h-10 w-full rounded-md px-3 text-sm";

function statusLabel(status: AdminShift["staffingStatus"]) {
  if (status === "fully_staffed") {
    return "Fully staffed";
  }

  if (status === "partially_staffed") {
    return "Partially staffed";
  }

  return "Unstaffed";
}

function statusClass(status: AdminShift["staffingStatus"]) {
  if (status === "fully_staffed") {
    return "bg-emerald-400/10 text-emerald-300";
  }

  if (status === "partially_staffed") {
    return "bg-warning/10 text-warning";
  }

  return "bg-danger/10 text-danger";
}

function RequirementInputs({
  coverageRoles,
  shift,
}: {
  coverageRoles: CoverageRoleRow[];
  shift?: AdminShift;
}) {
  const existingRequirements = new Map(
    (shift?.requirements ?? []).map((requirement) => [
      requirement.coverage_role_id,
      requirement.required_people,
    ]),
  );

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-ink">Coverage Requirements</legend>
      {coverageRoles.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {coverageRoles.map((role) => {
            const existingCount = existingRequirements.get(role.id);

            return (
              <label
                className="grid grid-cols-[auto_1fr_80px] items-center gap-2 rounded-md border border-line p-3 text-sm"
                key={role.id}
              >
                <input
                  className="size-4 rounded border-line bg-panel text-signal"
                  defaultChecked={existingCount !== undefined}
                  name="coverageRoleId"
                  type="checkbox"
                  value={role.id}
                />
                <span className="font-medium text-ink">{role.name}</span>
                <input
                  aria-label={`${role.name} required people`}
                  className="hl-input h-9 rounded-md px-2 text-sm"
                  defaultValue={existingCount ?? 1}
                  min="1"
                  name={`roleRequiredPeople:${role.id}`}
                  step="1"
                  type="number"
                />
              </label>
            );
          })}
        </div>
      ) : (
        <p className="rounded-lg border border-line bg-elevated/60 p-3 text-sm text-muted">
          No coverage roles are configured for HackLanta II.
        </p>
      )}
    </fieldset>
  );
}

function ShiftFields({
  coverageRoles,
  shift,
  shiftRoles,
  submitLabel,
  returnPath = "/admin/shifts",
}: {
  coverageRoles: CoverageRoleRow[];
  shift?: AdminShift;
  shiftRoles: ShiftRoleRow[];
  submitLabel: string;
  returnPath?: "/admin/schedule" | "/admin/shifts";
}) {
  return (
    <div className="space-y-4">
      <input name="returnTo" type="hidden" value={returnPath} />
      {shift ? <input name="shiftId" type="hidden" value={shift.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <label className="block text-sm font-medium text-ink" htmlFor={`${shift?.id ?? "new"}-title`}>
            Title
          </label>
          <input
            className={inputClass}
            defaultValue={shift?.title ?? ""}
            id={`${shift?.id ?? "new"}-title`}
            maxLength={120}
            name="title"
            required
            type="text"
          />
        </div>
        <div className="space-y-2">
          <label
            className="block text-sm font-medium text-ink"
            htmlFor={`${shift?.id ?? "new"}-shift-role`}
          >
            Shift Type
          </label>
          <select
            className={inputClass}
            defaultValue={shift?.shift_role_id ?? ""}
            id={`${shift?.id ?? "new"}-shift-role`}
            name="shiftRoleId"
          >
            <option value="">General</option>
            {shiftRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label
            className="block text-sm font-medium text-ink"
            htmlFor={`${shift?.id ?? "new"}-date`}
          >
            Date
          </label>
          <input
            className={inputClass}
            defaultValue={shift ? formatInputDateInTimeZone(shift.starts_at) : "2026-10-09"}
            id={`${shift?.id ?? "new"}-date`}
            name="date"
            required
            type="date"
          />
        </div>
        <div className="space-y-2">
          <label
            className="block text-sm font-medium text-ink"
            htmlFor={`${shift?.id ?? "new"}-starts-at`}
          >
            Starts
          </label>
          <input
            className={inputClass}
            defaultValue={shift ? formatInputTimeInTimeZone(shift.starts_at) : "09:00"}
            id={`${shift?.id ?? "new"}-starts-at`}
            name="startsAt"
            required
            type="time"
          />
        </div>
        <div className="space-y-2">
          <label
            className="block text-sm font-medium text-ink"
            htmlFor={`${shift?.id ?? "new"}-ends-at`}
          >
            Ends
          </label>
          <input
            className={inputClass}
            defaultValue={shift ? formatInputTimeInTimeZone(shift.ends_at) : "12:00"}
            id={`${shift?.id ?? "new"}-ends-at`}
            name="endsAt"
            required
            type="time"
          />
        </div>
        <div className="space-y-2">
          <label
            className="block text-sm font-medium text-ink"
            htmlFor={`${shift?.id ?? "new"}-required`}
          >
            General Required People
          </label>
          <input
            className={inputClass}
            defaultValue={shift?.required_people ?? 1}
            id={`${shift?.id ?? "new"}-required`}
            min="1"
            name="requiredPeople"
            required
            step="1"
            type="number"
          />
        </div>
        <div className="space-y-2">
          <label
            className="block text-sm font-medium text-ink"
            htmlFor={`${shift?.id ?? "new"}-location`}
          >
            Location
          </label>
          <input
            className={inputClass}
            defaultValue={shift?.location ?? ""}
            id={`${shift?.id ?? "new"}-location`}
            maxLength={120}
            name="location"
            type="text"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <label className="block text-sm font-medium text-ink" htmlFor={`${shift?.id ?? "new"}-notes`}>
            Notes
          </label>
          <textarea
            className="hl-input min-h-20 w-full rounded-md px-3 py-2 text-sm"
            defaultValue={shift?.notes ?? ""}
            id={`${shift?.id ?? "new"}-notes`}
            maxLength={500}
            name="notes"
          />
        </div>
      </div>
      <RequirementInputs coverageRoles={coverageRoles} shift={shift} />
      <button
        className="hl-button-primary rounded-md px-4 py-2 text-sm font-semibold"
        type="submit"
      >
        {submitLabel}
      </button>
    </div>
  );
}

function ActiveAssignments({
  returnPath = "/admin/shifts",
  shift,
}: {
  returnPath?: "/admin/schedule" | "/admin/shifts";
  shift: AdminShift;
}) {
  const activeAssignments = shift.assignments.filter(
    (assignment) => assignment.status === "draft" || assignment.status === "published",
  );

  if (activeAssignments.length === 0) {
    return <p className="text-sm text-muted">No draft assignments yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {activeAssignments.map((assignment) => (
        <li
          className="flex flex-col gap-2 rounded-md border border-line p-3 sm:flex-row sm:items-center sm:justify-between"
          key={assignment.id}
        >
          <div>
            <p className="text-sm font-medium text-ink">
              {assignment.profile?.full_name?.trim() || assignment.profile?.email || "Unknown member"}
            </p>
            <p className="text-xs text-muted">
              {assignment.coverageRole?.name ?? "General coverage"} · {assignment.status}
            </p>
          </div>
          {assignment.status === "draft" ? (
            <form action={removeShiftAssignmentAction}>
              <input name="returnTo" type="hidden" value={returnPath} />
              <input name="assignmentId" type="hidden" value={assignment.id} />
              <input name="shiftId" type="hidden" value={shift.id} />
              <button
                className="rounded-md border border-danger/35 px-3 py-1.5 text-sm font-medium text-danger transition hover:bg-danger/10"
                type="submit"
              >
                Remove
              </button>
            </form>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function CandidateList({
  coverageRoleId,
  recommendations,
  returnPath = "/admin/shifts",
  shift,
  title,
}: {
  coverageRoleId: string | null;
  recommendations: RecommendationSet | undefined;
  returnPath?: "/admin/schedule" | "/admin/shifts";
  shift: AdminShift;
  title: string;
}) {
  const candidates = recommendations?.recommendations ?? [];
  const rejections = recommendations?.rejections ?? [];
  const topRecommendedProfileId = candidates[0]?.profileId ?? "";

  return (
    <section className="space-y-3">
      <h4 className="text-sm font-semibold text-ink">{title}</h4>
      {candidates.length > 0 ? (
        <div className="space-y-2">
          {candidates.map((candidate, index) => (
            <div
              className="rounded-md border border-line bg-panel/70 p-3"
              key={`${shift.id}-${coverageRoleId ?? "general"}-${candidate.profileId}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ink">
                      {index + 1}. {candidate.fullName}
                    </p>
                    {index === 0 ? (
                      <span className="rounded-md border border-signal/35 bg-signal/10 px-2 py-0.5 text-xs font-semibold text-signal">
                        Recommended
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted">{candidate.email}</p>
                  <p className="mt-2 text-xs text-muted">
                    {candidate.assignedHours.toFixed(1)} assigned hours ·{" "}
                    {candidate.remainingHours === null
                      ? "no max set"
                      : `${candidate.remainingHours.toFixed(1)} hours remaining`}
                  </p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-signal">
                      Eligibility details
                    </summary>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {candidate.reasons.map((reason) => (
                        <li
                          className="rounded-md border border-signal/25 bg-signal/10 px-2 py-1 text-xs text-signal"
                          key={reason}
                        >
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
                <form action={assignShiftCandidateAction}>
                  <input name="returnTo" type="hidden" value={returnPath} />
                  <input name="shiftId" type="hidden" value={shift.id} />
                  <input name="profileId" type="hidden" value={candidate.profileId} />
                  <input name="coverageRoleId" type="hidden" value={coverageRoleId ?? ""} />
                  <input
                    name="topRecommendedProfileId"
                    type="hidden"
                    value={topRecommendedProfileId}
                  />
                  <button
                    className="rounded-md border border-signal px-3 py-1.5 text-sm font-semibold text-signal transition hover:bg-signal hover:text-field"
                    type="submit"
                  >
                    Assign
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-line bg-elevated/60 p-3 text-sm text-muted">
          No eligible candidates right now.
        </p>
      )}
      {rejections.length > 0 ? (
        <details className="rounded-md border border-line bg-elevated/50 p-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase text-muted">
            Excluded candidates ({rejections.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {rejections.slice(0, 6).map((rejection) => (
              <li className="text-xs leading-5 text-muted" key={rejection.profileId}>
                <span className="font-semibold text-ink">{rejection.fullName}</span>:{" "}
                {rejection.reason}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function ShiftCard({
  candidatesByShiftRole,
  coverageRoles,
  eventTimezone,
  returnPath = "/admin/shifts",
  shift,
  shiftRoles,
}: {
  candidatesByShiftRole: Record<string, RecommendationSet>;
  coverageRoles: CoverageRoleRow[];
  eventTimezone: string;
  returnPath?: "/admin/schedule" | "/admin/shifts";
  shift: AdminShift;
  shiftRoles: ShiftRoleRow[];
}) {
  const requirementCandidates =
    shift.requirements.length > 0
      ? shift.requirements.map((requirement) => ({
          coverageRoleId: requirement.coverage_role_id,
          title: `${requirement.coverageRole?.name ?? "Coverage role"} candidates`,
        }))
      : [{ coverageRoleId: null, title: "General coverage candidates" }];

  return (
    <article className="hl-card rounded-lg p-4 shadow-sm" id={shift.id}>
      <div className="flex flex-col gap-3 border-b border-line pb-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-ink">{shift.title}</h3>
            <span className={`rounded-md px-2 py-1 text-xs font-medium ${statusClass(shift.staffingStatus)}`}>
              {statusLabel(shift.staffingStatus)}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            {formatDateInTimeZone(shift.starts_at, eventTimezone)} ·{" "}
            {formatTimeInTimeZone(shift.starts_at, eventTimezone)} -{" "}
            {formatTimeInTimeZone(shift.ends_at, eventTimezone)}
          </p>
          <p className="mt-1 text-sm text-muted">
            {shift.shiftRole?.name ?? "General shift"} · {shift.location || "No location"}
          </p>
        </div>
        <div className="rounded-md border border-line bg-white/5 px-3 py-2 text-sm font-medium text-ink">
          {shift.activeAssignmentCount}/{shift.requiredTotal} assigned
        </div>
      </div>

      <div className="grid gap-4 pt-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
        <div className="space-y-4">
          <section className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold text-ink">Coverage Needed</h4>
              <span className="rounded-md border border-line px-2 py-1 text-xs text-muted">
                General: {shift.required_people}
              </span>
            </div>
            {shift.requirements.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {shift.requirements.map((requirement) => {
                  const assignedForRole = shift.assignments.filter(
                    (assignment) =>
                      (assignment.status === "draft" || assignment.status === "published")
                      && assignment.coverage_role_id === requirement.coverage_role_id,
                  ).length;

                  return (
                    <span
                      className="rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink"
                      key={requirement.id}
                    >
                      {requirement.coverageRole?.name ?? "Role"}: {assignedForRole}/
                      {requirement.required_people}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted">No role-specific requirements.</p>
            )}
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-ink">Draft Assignments</h4>
            <ActiveAssignments returnPath={returnPath} shift={shift} />
          </section>

          {shift.notes ? (
            <details className="rounded-md border border-line bg-elevated/40 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-ink">Notes</summary>
              <p className="mt-2 text-sm leading-5 text-muted">{shift.notes}</p>
            </details>
          ) : null}

          <details className="rounded-md border border-line p-3">
            <summary className="cursor-pointer text-sm font-semibold text-ink">Edit shift</summary>
            <form action={updateShiftAction} className="mt-4">
              <ShiftFields
                coverageRoles={coverageRoles}
                returnPath={returnPath}
                shift={shift}
                shiftRoles={shiftRoles}
                submitLabel="Save shift"
              />
            </form>
          </details>

          {shift.activeAssignmentCount === 0 ? (
            <form action={removeShiftAction}>
              <input name="returnTo" type="hidden" value={returnPath} />
              <input name="shiftId" type="hidden" value={shift.id} />
              <button
                className="rounded-md border border-danger/35 px-4 py-2 text-sm font-semibold text-danger transition hover:bg-danger/10"
                type="submit"
              >
                Delete shift
              </button>
            </form>
          ) : null}
        </div>

        <aside className="space-y-4 rounded-lg border border-line bg-elevated/60 p-3">
          <details open={shift.staffingStatus !== "fully_staffed"}>
            <summary className="cursor-pointer text-sm font-semibold text-ink">
              Suggest People
            </summary>
          <div className="mt-3">
            <h4 className="text-sm font-semibold text-ink">Suggest People</h4>
            <p className="mt-1 text-xs leading-5 text-muted">
              Recommendations are calculated live from roles, availability, current assignments,
              max hours, and minimum breaks.
            </p>
          </div>
          <div className="mt-4 space-y-4">
          {requirementCandidates.map((requirement) => (
            <CandidateList
              coverageRoleId={requirement.coverageRoleId}
              key={`${shift.id}-${requirement.coverageRoleId ?? "general"}`}
              recommendations={
                candidatesByShiftRole[`${shift.id}:${requirement.coverageRoleId ?? "general"}`]
              }
              returnPath={returnPath}
              shift={shift}
              title={requirement.title}
            />
          ))}
          </div>
          </details>
        </aside>
      </div>
    </article>
  );
}

export function ShiftManagement({
  candidatesByShiftRole,
  coverageRoles,
  eventTimezone,
  returnPath = "/admin/shifts",
  shifts,
  shiftRoles,
}: ShiftManagementProps) {
  const groupedShifts = eventDates.map((date) => ({
    ...date,
    shifts: shifts.filter((shift) => formatInputDateInTimeZone(shift.starts_at, eventTimezone) === date.value),
  }));

  return (
    <div className="space-y-5">
      <details className="hl-card rounded-lg p-4 shadow-sm" id="create-shift" open={shifts.length === 0}>
        <summary className="cursor-pointer text-lg font-semibold text-ink">Create Shift</summary>
        <form action={createShiftAction} className="mt-4">
          <ShiftFields
            coverageRoles={coverageRoles}
            returnPath={returnPath}
            shiftRoles={shiftRoles}
            submitLabel="Create shift"
          />
        </form>
      </details>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Coverage Shifts</h2>
          <p className="mt-1 text-sm text-muted">{shifts.length} shift{shifts.length === 1 ? "" : "s"} in the current view.</p>
        </div>
        {shifts.length === 0 ? (
          <div className="hl-card rounded-lg p-6 text-sm text-muted">
            No shifts match the current filters.
          </div>
        ) : (
          groupedShifts.map((group) =>
            group.shifts.length > 0 ? (
              <div className="space-y-3" key={group.value}>
                <h3 className="text-sm font-semibold uppercase text-muted">{group.label}</h3>
                {group.shifts.map((shift) => (
                  <ShiftCard
                    candidatesByShiftRole={candidatesByShiftRole}
                    coverageRoles={coverageRoles}
                    eventTimezone={eventTimezone}
                    key={shift.id}
                    returnPath={returnPath}
                    shift={shift}
                    shiftRoles={shiftRoles}
                  />
                ))}
              </div>
            ) : null,
          )
        )}
      </section>
    </div>
  );
}
