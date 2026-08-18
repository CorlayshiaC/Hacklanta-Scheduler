"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { updateMemberProfileAction } from "@/lib/admin/member-actions";
// STUB(agent-1): replace with the real primitives once components/ui publishes it.
import { FilterPillSelect, PillButton } from "@/components/settings/_stub-primitives";

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

export function RolesTable({ members }: { members: RolesTableMember[] }) {
  return (
    <div className="flex flex-col gap-2">
      {members.map((member) => (
        <RoleRow key={member.id} member={member} />
      ))}
    </div>
  );
}

function RoleRow({ member }: { member: RolesTableMember }) {
  const [role, setRole] = useState<RolesTableMember["role"]>(member.role);
  // Demoting an admin is a danger action per _shared-context.md's design system section
  // ("revoke token, demote" get the outlined-orange-pill treatment), so the save action itself
  // carries that signal before the confirm() dialog even fires.
  const isDemotingAdmin = member.role === "admin" && role !== "admin";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (isDemotingAdmin) {
      const confirmed = window.confirm(
        "Remove admin access from this member? This cannot be the last admin.",
      );

      if (!confirmed) {
        event.preventDefault();
      }
    }
  }

  return (
    <form
      action={updateMemberProfileAction}
      className="flex flex-col gap-3 rounded-2xl bg-[#1E1E1E] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      onSubmit={handleSubmit}
    >
      <input name="profileId" type="hidden" value={member.id} />
      <input name="fullName" type="hidden" value={member.fullName} />
      {/* readCheckbox (lib/admin/member-validation.ts) treats "on" as true and any absent field
          as false, so the hidden isActive input is only rendered when the member is currently
          active, preserving that value unchanged. */}
      {member.isActive ? <input name="isActive" type="hidden" value="on" /> : null}

      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-[#F5F5F5]">{member.fullName}</span>
        <span className="text-xs text-[#9A9A9A]">{member.email}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-[#5E5E5E]">{member.isActive ? "Active" : "Inactive"}</span>

        <FilterPillSelect
          label="Role"
          name="role"
          onChange={(event) => setRole(event.target.value as RolesTableMember["role"])}
          value={role}
        >
          {ROLE_OPTIONS.map((option) => (
            <option
              disabled={option.disabled}
              key={option.value}
              title={option.disabled ? "Organizer role ships once the schema update lands." : undefined}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </FilterPillSelect>

        <PillButton type="submit" variant={isDemotingAdmin ? "outline-warn" : "neutral"}>
          Save role
        </PillButton>
      </div>
    </form>
  );
}
