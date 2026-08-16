"use client";

import type { FormEvent } from "react";
import { updateMemberProfileAction } from "@/lib/admin/member-actions";

export type RolesTableMember = {
  id: string;
  fullName: string;
  email: string;
  role: "admin" | "organizer" | "board_member";
  isActive: boolean;
};

// The underlying enum is still `admin | board_member` (see src/types/database.ts). The visible
// "Member" option maps to the real `board_member` value. "Organizer" is disabled until the
// schema update lands: this will be enabled once the app_role type gains an organizer value, see
// docs/contracts/schema-requests.md and docs/contracts/pending.md item three.
const ROLE_OPTIONS = [
  { label: "Member", value: "board_member", disabled: false },
  { label: "Organizer", value: "organizer", disabled: true },
  { label: "Admin", value: "admin", disabled: false },
] as const;

function handleRoleFormSubmit(originalRole: "admin" | "organizer" | "board_member") {
  return (event: FormEvent<HTMLFormElement>) => {
    const roleSelect = event.currentTarget.elements.namedItem("role") as HTMLSelectElement | null;
    const nextRole = roleSelect?.value;

    if (originalRole === "admin" && nextRole !== "admin") {
      const confirmed = window.confirm(
        "Remove admin access from this member? This cannot be the last admin.",
      );

      if (!confirmed) {
        event.preventDefault();
      }
    }
  };
}

export function RolesTable({ members }: { members: RolesTableMember[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/5">
      <table className="w-full min-w-[560px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-black/20 text-xs font-medium uppercase tracking-wide text-zinc-500">
            <th className="px-3 py-2" scope="col">
              Name
            </th>
            <th className="px-3 py-2" scope="col">
              Email
            </th>
            <th className="px-3 py-2" scope="col">
              Role
            </th>
            <th className="px-3 py-2" scope="col">
              Active
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr className="border-b border-white/5 last:border-b-0" key={member.id}>
              <td className="px-3 py-2 text-zinc-100">{member.fullName}</td>
              <td className="px-3 py-2 text-zinc-300">{member.email}</td>
              <td className="px-3 py-2">
                <form
                  action={updateMemberProfileAction}
                  className="flex items-center gap-2"
                  onSubmit={handleRoleFormSubmit(member.role)}
                >
                  <input name="profileId" type="hidden" value={member.id} />
                  <input name="fullName" type="hidden" value={member.fullName} />
                  {/* readCheckbox (lib/admin/member-validation.ts) treats "on" as true and any
                      absent field as false, so the hidden isActive input is only rendered when
                      the member is currently active, preserving that value unchanged. */}
                  {member.isActive ? <input name="isActive" type="hidden" value="on" /> : null}
                  <select
                    className="rounded-lg border border-white/5 bg-black/30 px-2 py-1 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                    defaultValue={member.role}
                    name="role"
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option
                        disabled={option.disabled}
                        key={option.value}
                        title={
                          option.disabled
                            ? "Organizer role ships once the schema update lands."
                            : undefined
                        }
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-200 transition hover:bg-white/10"
                    type="submit"
                  >
                    Save role
                  </button>
                </form>
              </td>
              <td className="px-3 py-2 text-zinc-300">{member.isActive ? "Active" : "Inactive"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
