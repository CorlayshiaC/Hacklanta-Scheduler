"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PillButton } from "@/components/ui/neu-button";
import { NeuInput } from "@/components/ui/neu-input";
import { completeJoinWelcomeAction } from "@/lib/settings/invite-actions";

export function JoinWelcomeForm({ initialFullName }: { initialFullName: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialFullName);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      await completeJoinWelcomeAction(fullName);
      router.push("/");
    } catch {
      setError("Could not save your name. Try again.");
      setIsSaving(false);
    }
  }

  return (
    <form className="flex w-full flex-col items-stretch gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1 text-left">
        <label className="text-xs font-medium uppercase tracking-wide text-text-secondary" htmlFor="join-full-name">
          Your name
        </label>
        <NeuInput
          id="join-full-name"
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Full name"
          value={fullName}
        />
      </div>

      {error ? <p className="text-sm text-accent-warn">{error}</p> : null}

      <PillButton disabled={isSaving} type="submit" variant="primary">
        {isSaving ? "Saving..." : "Continue"}
      </PillButton>
    </form>
  );
}
