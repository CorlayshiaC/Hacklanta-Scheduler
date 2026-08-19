"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { updateMemberProfileAction } from "@/lib/admin/member-actions";
import { StatusPill } from "@/components/ui/status-pill";
import { PillButton } from "@/components/ui/neu-button";

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
  // Demoting an admin is a danger action. V4 has no outlined-badge/pill treatment for that
  // anymore (status renders as a dot plus text, and pill radius is reserved for avatars), so the
  // signal here is a solid warn-fill (bg-accent-warn-fill, the same fill-safe shade destructive
  // actions use for a solid background) on the save action itself, same weight as the primary
  // button would carry, just orange instead of purple, before the confirm() dialog fires.
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
      className="flex flex-col gap-3 rounded-card bg-surface-elevated px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      onSubmit={handleSubmit}
    >
      <input name="profileId" type="hidden" value={member.id} />
      <input name="fullName" type="hidden" value={member.fullName} />
      {/* readCheckbox (lib/admin/member-validation.ts) treats "on" as true and any absent field
          as false, so the hidden isActive input is only rendered when the member is currently
          active, preserving that value unchanged. */}
      {member.isActive ? <input name="isActive" type="hidden" value="on" /> : null}

      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-medium text-text-primary">{member.fullName}</span>
        <span className="text-xs text-text-secondary">{member.email}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Status rendering law: a dot plus plain text, never an outlined badge. Active/inactive
            is the one true status this row shows; role itself stays an editable control below,
            not a status readout, so it isn't dot-ified. StatusPill's state union doesn't literally
            name "active"/"inactive", reused via the label override since its dot+text visual
            treatment (muted dot/text for the neutral state) fits this exactly. */}
        <StatusPill
          label={member.isActive ? "Active" : "Inactive"}
          state={member.isActive ? "approved" : "not_assigned"}
        />

        {/* Hand-rolled, not NeuSelect: needs a per-option disabled + title tooltip ("Organizer role
            ships once the schema update lands"), which NeuSelect's options array doesn't expose. */}
        <select
          className="h-10 cursor-pointer rounded-pill border border-hairline bg-elevated px-3 text-sm text-text-primary outline-none transition-[box-shadow,border-color] duration-fast ease-neu-out focus-visible:border-accent-go focus-visible:shadow-focus-ring"
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
        </select>

        <PillButton className={isDemotingAdmin ? "bg-accent-warn-fill" : undefined} type="submit" variant="primary">
          Save role
        </PillButton>
      </div>
    </form>
  );
}
