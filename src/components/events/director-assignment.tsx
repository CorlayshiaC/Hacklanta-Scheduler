"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IconButton } from "@/components/ui/icon-button";
import { PillButton } from "@/components/ui/neu-button";
import { NeuSelect } from "@/components/ui/neu-select";
import { assignEventDirector, removeEventDirector } from "@/lib/scheduling/actions";

export type DirectorCandidate = { userId: string; fullName: string; email: string };

/**
 * Admin-only picker for which directors are scoped to this event (event_directors table).
 * assignEventDirector / removeEventDirector (src/lib/scheduling/actions.ts) already enforce the
 * admin-only RLS write and handle revalidation.
 */
export function DirectorAssignment({
  eventId,
  currentDirectors,
  candidates,
}: {
  eventId: string;
  currentDirectors: DirectorCandidate[];
  candidates: DirectorCandidate[];
}) {
  const router = useRouter();
  const assignedIds = useMemo(
    () => new Set(currentDirectors.map((director) => director.userId)),
    [currentDirectors],
  );
  const remaining = candidates.filter((candidate) => !assignedIds.has(candidate.userId));
  const [selectedUserId, setSelectedUserId] = useState(remaining[0]?.userId ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleAdd() {
    if (!selectedUserId) {
      return;
    }
    setIsPending(true);
    setMessage(null);
    const result = await assignEventDirector({ eventId, userId: selectedUserId });
    setIsPending(false);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    router.refresh();
  }

  async function handleRemove(userId: string) {
    setIsPending(true);
    setMessage(null);
    const result = await removeEventDirector({ eventId, userId });
    setIsPending(false);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    router.refresh();
  }

  if (currentDirectors.length === 0 && candidates.length === 0) {
    return <p className="text-sm text-text-secondary">No directors yet. Grant the director role in Settings first.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {currentDirectors.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {currentDirectors.map((director) => (
            <li
              className="flex items-center gap-2 rounded-pill bg-elevated px-3 py-1 text-sm text-text-primary"
              key={director.userId}
            >
              {director.fullName}
              <IconButton
                aria-label={`Remove ${director.fullName} as director`}
                disabled={isPending}
                onClick={() => handleRemove(director.userId)}
                size="sm"
                variant="ghost"
              >
                ×
              </IconButton>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-secondary">No directors assigned to this event yet.</p>
      )}

      {remaining.length > 0 ? (
        <div className="flex items-center gap-2">
          <NeuSelect
            className="flex-1"
            onValueChange={setSelectedUserId}
            options={remaining.map((candidate) => ({ value: candidate.userId, label: candidate.fullName }))}
            placeholder="Choose a director"
            value={selectedUserId}
          />
          <PillButton disabled={isPending} onClick={handleAdd} variant="default">
            Add director
          </PillButton>
        </div>
      ) : null}

      {message ? (
        <p className="text-xs text-accent-warn" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
