"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NeuButton } from "@/components/ui/neu-button";
import { publishEvent } from "@/lib/scheduling/actions";

export function PublishEventButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handlePublish() {
    setIsPending(true);
    setMessage(null);
    const result = await publishEvent({ eventId });
    setIsPending(false);
    setConfirming(false);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-text-secondary">Publish shifts to all members?</span>
        <NeuButton disabled={isPending} onClick={handlePublish} variant="primary">
          {isPending ? "Publishing..." : "Confirm publish"}
        </NeuButton>
        <NeuButton onClick={() => setConfirming(false)} variant="ghost">
          Cancel
        </NeuButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <NeuButton onClick={() => setConfirming(true)} variant="primary">
        Publish shifts
      </NeuButton>
      {message ? <p className="text-xs text-danger">{message}</p> : null}
    </div>
  );
}
