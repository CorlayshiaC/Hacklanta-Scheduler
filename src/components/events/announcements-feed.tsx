"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PillButton } from "@/components/ui/neu-button";
import { NeuTextarea } from "@/components/ui/neu-textarea";
import { formatShiftDate, formatShiftTime } from "@/lib/utils/format";
import { createAnnouncementAction } from "@/lib/announcements/actions";

export type AnnouncementFeedItem = {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
};

/**
 * Composer + feed for an event's announcements. createAnnouncementAction (src/lib/announcements/actions.ts)
 * is not ours to edit: it already handles RLS authorization, the Discord webhook post, and revalidation.
 */
export function AnnouncementsFeed({
  eventId,
  announcements,
}: {
  eventId: string;
  announcements: AnnouncementFeedItem[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  // Announcements aren't shift-scoped like the coverage board, so the viewer's own time zone (not
  // the event's) is the natural reference for "when was this posted".
  const timeZone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

  async function handlePost() {
    const trimmed = body.trim();
    if (trimmed.length === 0) {
      return;
    }
    setIsPending(true);
    setMessage(null);
    const result = await createAnnouncementAction(eventId, trimmed);
    setIsPending(false);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <NeuTextarea
          onChange={(event) => setBody(event.target.value)}
          placeholder="Post an update for this event's roster."
          rows={3}
          value={body}
        />
        {message ? (
          <p className="text-xs text-accent-warn" role="status">
            {message}
          </p>
        ) : null}
        <div className="flex justify-end">
          <PillButton disabled={isPending || body.trim().length === 0} onClick={handlePost} variant="primary">
            Post announcement
          </PillButton>
        </div>
      </div>

      {announcements.length === 0 ? (
        <p className="text-sm text-text-secondary">No announcements yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {announcements.map((announcement) => (
            <li
              className="flex flex-col gap-1 rounded-card border border-hairline bg-elevated px-3 py-2"
              key={announcement.id}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-sm font-semibold text-text-primary">{announcement.authorName}</span>
                <span className="font-mono text-xs tabular-nums text-text-secondary">
                  {formatShiftDate(announcement.createdAt, timeZone)} {formatShiftTime(announcement.createdAt, timeZone)}
                </span>
              </div>
              <p className="text-sm text-text-primary">{announcement.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
