"use client";

import { useState, useTransition } from "react";
import { NeuCard as Card } from "@/components/ui/neu-card";
import { PillButton } from "@/components/ui/neu-button";
import { NeuInput as TextInput } from "@/components/ui/neu-input";
import { NeuSelect } from "@/components/ui/neu-select";
import {
  createInviteAction,
  revokeInviteAction,
  type InviteRole,
  type InviteSummary,
} from "@/lib/settings/invite-actions";

const ROLE_OPTIONS: { label: string; value: InviteRole }[] = [
  { label: "Member", value: "member" },
  { label: "Director", value: "director" },
  { label: "Admin", value: "admin" },
];

function formatExpiry(invite: InviteSummary): string {
  if (!invite.expiresAt) {
    return "No expiry";
  }
  return `Expires ${new Date(invite.expiresAt).toLocaleDateString()}`;
}

function formatUses(invite: InviteSummary): string {
  return invite.maxUses === null ? `${invite.usedCount} used` : `${invite.usedCount} of ${invite.maxUses} used`;
}

const FIELD_LABEL = "text-[11px] text-text-secondary";

export function InviteLinksPanel({ initialInvites }: { initialInvites: InviteSummary[] }) {
  const [invites, setInvites] = useState(initialInvites);
  const [role, setRole] = useState<InviteRole>("member");
  const [eventId, setEventId] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [maxUses, setMaxUses] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    startTransition(async () => {
      const invite = await createInviteAction({
        role,
        eventId: role === "director" ? eventId.trim() || null : null,
        expiresInDays: expiresInDays ? Number.parseInt(expiresInDays, 10) : null,
        maxUses: maxUses ? Number.parseInt(maxUses, 10) : null,
      });
      setInvites((current) => [invite, ...current]);
    });
  }

  function handleRevoke(token: string) {
    startTransition(async () => {
      await revokeInviteAction(token);
      setInvites((current) => current.filter((invite) => invite.token !== token));
    });
  }

  function handleCopy(token: string) {
    const url = `${window.location.origin}/join/${token}`;
    void navigator.clipboard.writeText(url);
    setCopiedToken(token);
    window.setTimeout(() => setCopiedToken((current) => (current === token ? null : current)), 2000);
  }

  return (
    <Card title="Invite links">
      <div className="flex flex-col gap-5">
        <p className="text-[13px] text-text-secondary">
          Roles are granted by sending someone a link, not by self-service sign-up. A director
          link scopes that person to one event.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <span className={FIELD_LABEL}>Role</span>
            <NeuSelect onValueChange={(value) => setRole(value as InviteRole)} options={ROLE_OPTIONS} value={role} />
          </div>

          {role === "director" ? (
            <div className="flex flex-col gap-1">
              <label className={FIELD_LABEL} htmlFor="invite-event-id">
                Event ID
              </label>
              <TextInput
                id="invite-event-id"
                onChange={(event) => setEventId(event.target.value)}
                placeholder="event UUID"
                value={eventId}
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-1">
            <label className={FIELD_LABEL} htmlFor="invite-expires">
              Expires in (days)
            </label>
            <TextInput
              className="w-28"
              id="invite-expires"
              min={0}
              onChange={(event) => setExpiresInDays(event.target.value)}
              type="number"
              value={expiresInDays}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className={FIELD_LABEL} htmlFor="invite-max-uses">
              Max uses
            </label>
            <TextInput
              className="w-28"
              id="invite-max-uses"
              min={0}
              onChange={(event) => setMaxUses(event.target.value)}
              placeholder="Unlimited"
              type="number"
              value={maxUses}
            />
          </div>

          <PillButton disabled={isPending} onClick={handleCreate} variant="primary">
            Create link
          </PillButton>
        </div>

        {invites.length === 0 ? (
          <p className="text-[13px] text-text-secondary">No invite links yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {invites.map((invite) => (
              <div
                className="flex flex-col gap-2 rounded-card bg-surface-elevated px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                key={invite.token}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-medium text-text-primary">
                    {ROLE_OPTIONS.find((option) => option.value === invite.role)?.label ?? invite.role}
                    {invite.eventId ? ` · event ${invite.eventId}` : ""}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-text-secondary">
                    {formatExpiry(invite)} · {formatUses(invite)}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <PillButton className="text-xs" onClick={() => handleCopy(invite.token)} variant="link">
                    {copiedToken === invite.token ? "Copied" : "Copy link"}
                  </PillButton>
                  {/* Destructive action: a text link in the warn color, not a second filled/pill
                      button, per V4's "one filled button per view" and "no outlined badge pills"
                      rules. */}
                  <PillButton
                    className="text-xs text-accent-warn hover:text-accent-warn"
                    disabled={isPending}
                    onClick={() => handleRevoke(invite.token)}
                    variant="link"
                  >
                    Revoke
                  </PillButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
