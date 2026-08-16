import {
  assignCoverageRoleAction,
  removeCoverageRoleAction,
  updateMemberProfileAction,
  updateMemberSettingsAction,
} from "@/lib/admin/member-actions";
import { formatDateInTimeZone, formatTimeInTimeZone } from "@/lib/availability/time";
import type { AdminMember, CoverageRole } from "@/lib/admin/member-data";

type MemberManagementProps = {
  eventId: string;
  members: AdminMember[];
  coverageRoles: CoverageRole[];
};

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={
        isActive
          ? "inline-flex rounded-md bg-emerald-400/10 px-2 py-1 text-xs font-medium text-emerald-300"
          : "inline-flex rounded-md bg-white/5 px-2 py-1 text-xs font-medium text-muted"
      }
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

export function MemberManagement({ eventId, members, coverageRoles }: MemberManagementProps) {
  if (members.length === 0) {
    return (
      <div className="hl-card rounded-lg p-6 text-sm text-muted">
        No members match the current filters.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {members.map((member) => {
        const assignedRoleIds = new Set(member.coverageRoles.map((role) => role.id));
        const availableRoles = coverageRoles.filter((role) => !assignedRoleIds.has(role.id));

        return (
          <details className="hl-card rounded-lg p-4 shadow-sm" key={member.id}>
            <summary className="cursor-pointer list-none">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold text-ink">
                    {member.fullName.trim() || "Unnamed member"}
                  </h2>
                  <p className="mt-1 truncate text-sm text-muted">{member.email}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
                    <span>{member.coverageRoles.length} role{member.coverageRoles.length === 1 ? "" : "s"}</span>
                    <span>·</span>
                    <span>{member.availabilityWindows.length} availability window{member.availabilityWindows.length === 1 ? "" : "s"}</span>
                    <span>·</span>
                    <span>{member.totalAvailabilityHours.toFixed(1)} available hours</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-line bg-white/5 px-2 py-1 text-xs font-medium text-ink">
                  {member.role === "admin" ? "Admin" : "Board member"}
                </span>
                <StatusBadge isActive={member.isActive} />
                <span className="rounded-md border border-line px-2 py-1 text-xs font-medium text-muted">
                  Manage
                </span>
                </div>
              </div>
            </summary>

            <div className="mt-4 grid gap-5 border-t border-line pt-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <form action={updateMemberProfileAction} className="space-y-4">
                <input name="profileId" type="hidden" value={member.id} />
                <div>
                  <h3 className="text-sm font-semibold text-ink">Profile</h3>
                  <p className="mt-1 text-xs text-muted">Email is managed by Supabase Auth.</p>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-ink" htmlFor={`${member.id}-name`}>
                    Name
                  </label>
                  <input
                    className="hl-input h-10 w-full rounded-md px-3 text-sm"
                    defaultValue={member.fullName}
                    id={`${member.id}-name`}
                    name="fullName"
                    type="text"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-ink" htmlFor={`${member.id}-role`}>
                    Application Role
                  </label>
                  <select
                    className="hl-input h-10 w-full rounded-md px-3 text-sm"
                    defaultValue={member.role}
                    id={`${member.id}-role`}
                    name="role"
                  >
                    <option value="board_member">Board member</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm font-medium text-ink">
                  <input
                    className="size-4 rounded border-line bg-panel text-signal"
                    defaultChecked={member.isActive}
                    name="isActive"
                    type="checkbox"
                  />
                  Active
                </label>
                <button
                  className="hl-button-primary rounded-md px-4 py-2 text-sm font-semibold"
                  type="submit"
                >
                  Save profile
                </button>
              </form>

              <div className="space-y-4">
                <details className="rounded-md border border-line bg-elevated/40 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-ink">Availability</summary>
                  {member.availabilityWindows.length > 0 ? (
                    <div className="mt-3 space-y-2 text-sm text-muted">
                      <p>
                        {member.availabilityWindows.length} windows,{" "}
                        {member.totalAvailabilityHours.toFixed(1)} hours total
                      </p>
                      <ul className="space-y-1">
                        {member.availabilityWindows.map((window) => (
                          <li key={window.id}>
                            {formatDateInTimeZone(window.starts_at)}:{" "}
                            {formatTimeInTimeZone(window.starts_at)} -{" "}
                            {formatTimeInTimeZone(window.ends_at)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted">No availability submitted.</p>
                  )}
                </details>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-ink">Coverage Roles</h3>
                  {member.coverageRoles.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {member.coverageRoles.map((role) => (
                        <form action={removeCoverageRoleAction} key={role.id}>
                          <input name="profileId" type="hidden" value={member.id} />
                          <input name="eventId" type="hidden" value={eventId} />
                          <input name="coverageRoleId" type="hidden" value={role.id} />
                          <button
                            className="rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink transition hover:border-danger/50 hover:text-danger"
                            type="submit"
                          >
                            {role.name} remove
                          </button>
                        </form>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted">No coverage roles assigned.</p>
                  )}

                  {availableRoles.length > 0 ? (
                    <form action={assignCoverageRoleAction} className="flex flex-col gap-2 sm:flex-row">
                      <input name="profileId" type="hidden" value={member.id} />
                      <input name="eventId" type="hidden" value={eventId} />
                      <select
                        className="hl-input h-10 min-w-0 flex-1 rounded-md px-3 text-sm"
                        name="coverageRoleId"
                      >
                        {availableRoles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                      <button
                        className="rounded-md border border-signal px-4 py-2 text-sm font-semibold text-signal transition hover:bg-signal hover:text-field"
                        type="submit"
                      >
                        Add role
                      </button>
                    </form>
                  ) : (
                    <p className="text-sm text-muted">All event coverage roles are assigned.</p>
                  )}
                </section>

                <form action={updateMemberSettingsAction} className="space-y-4">
                  <input name="profileId" type="hidden" value={member.id} />
                  <input name="eventId" type="hidden" value={eventId} />
                  <h3 className="text-sm font-semibold text-ink">Work Constraints</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label
                        className="block text-sm font-medium text-ink"
                        htmlFor={`${member.id}-max-hours`}
                      >
                        Maximum Hours
                      </label>
                      <input
                        className="hl-input h-10 w-full rounded-md px-3 text-sm"
                        defaultValue={member.settings?.max_hours ?? ""}
                        id={`${member.id}-max-hours`}
                        min="0.25"
                        name="maxHours"
                        step="0.25"
                        type="number"
                      />
                    </div>
                    <div className="space-y-2">
                      <label
                        className="block text-sm font-medium text-ink"
                        htmlFor={`${member.id}-minimum-break`}
                      >
                        Minimum Break
                      </label>
                      <input
                        className="hl-input h-10 w-full rounded-md px-3 text-sm"
                        defaultValue={member.settings?.minimum_break_minutes ?? 0}
                        id={`${member.id}-minimum-break`}
                        min="0"
                        name="minimumBreakMinutes"
                        step="1"
                        type="number"
                      />
                    </div>
                  </div>
                  <button
                    className="hl-button-primary rounded-md px-4 py-2 text-sm font-semibold"
                    type="submit"
                  >
                    Save constraints
                  </button>
                </form>
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}
