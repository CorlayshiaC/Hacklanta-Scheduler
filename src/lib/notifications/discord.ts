import "server-only";

export type DiscordPostResult = { ok: true } | { ok: false; message: string };

/**
 * Plain, compact webhook post: a title line, nothing fancier (no embeds), per the shared V2 brief
 * ("Post format: plain, compact, no embeds fancier than a title line"). Gated by the caller checking
 * org_settings.webhook_url / discord_notify_kinds first; this function itself has no opinion on
 * whether posting was appropriate, it just posts.
 */
export async function postToDiscord(
  webhookUrl: string,
  content: string,
): Promise<DiscordPostResult> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      return { ok: false, message: `Discord webhook responded with ${response.status}.` };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Unknown Discord webhook error.",
    };
  }
}

const DISCORD_KIND_LABELS: Record<string, string> = {
  ASSIGNMENT_APPROVED: "Shift confirmed",
  SCHEDULE_PUBLISHED: "Schedule published",
  SHIFT_CANCELLED: "Shift cancelled",
  CHANGE_REQUEST_OPENED: "Change request opened",
  ANNOUNCEMENT_POSTED: "Announcement",
  REMINDER_24H: "Reminder: shift tomorrow",
};

/** One line, mono-free (Discord's own markdown handles code spans if a caller wants them). */
export function buildDiscordMessage(input: {
  kind: string;
  eventName: string;
  detail?: string;
}): string {
  const label = DISCORD_KIND_LABELS[input.kind] ?? input.kind;
  return input.detail
    ? `**${label}** — ${input.eventName}: ${input.detail}`
    : `**${label}** — ${input.eventName}`;
}
