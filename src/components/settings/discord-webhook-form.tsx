"use client";

import { useState } from "react";
import { Card } from "@/components/ui/neu-card";
import { NeuInput } from "@/components/ui/neu-input";
import { PillButton } from "@/components/ui/neu-button";
import { NeuToggle } from "@/components/ui/neu-toggle";

const NOTIFICATION_KINDS = [
  { key: "announcement", label: "Announcements" },
  { key: "schedule_published", label: "Schedule published" },
  { key: "day_before_reminder", label: "Day-before reminder" },
] as const;

// STUB(agent-2): org_settings has no webhook_url column and there is no send-test-post endpoint
// yet (V2 brief item 6, "Discord: channel webhook posts"), see docs/contracts/schema-requests.md.
// Rendered disabled with an explanatory caption rather than either hiding the section (an admin
// should be able to see this is coming) or silently no-op "saving" it (would be a lie), same
// pattern as V1's disabled "Organizer" role option in roles-table.tsx.
export function DiscordWebhookForm() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [enabledKinds, setEnabledKinds] = useState<Record<string, boolean>>({
    announcement: true,
    schedule_published: true,
    day_before_reminder: true,
  });

  return (
    <Card title="Discord">
      <div className="flex flex-col gap-5">
        <p className="text-sm text-text-secondary">
          Posts announcements, schedule-published notices, and day-before reminders to a Discord
          channel via an incoming webhook.
        </p>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wide text-text-secondary" htmlFor="discord-webhook-url">
            Webhook URL
          </label>
          <NeuInput
            id="discord-webhook-url"
            onChange={(event) => setWebhookUrl(event.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
            type="url"
            value={webhookUrl}
          />
        </div>

        <div className="flex flex-col gap-2">
          {NOTIFICATION_KINDS.map((kind) => (
            <div className="flex items-center justify-between" key={kind.key}>
              <span className="text-sm text-text-primary">{kind.label}</span>
              <NeuToggle
                checked={enabledKinds[kind.key]}
                onCheckedChange={(checked) =>
                  setEnabledKinds((current) => ({ ...current, [kind.key]: checked }))
                }
              />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <PillButton disabled title="Discord webhook config ships once the schema lands." variant="default">
            Save changes
          </PillButton>
          <PillButton disabled title="Discord webhook config ships once the schema lands." variant="ghost">
            Send test post
          </PillButton>
        </div>
      </div>
    </Card>
  );
}
