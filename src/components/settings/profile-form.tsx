"use client";

import { useState } from "react";
import type { FormEvent } from "react";
// STUB(agent-1): replace with the real primitives once components/ui publishes it.
import { MonoText, PrimaryButton, Slab, TextInput } from "@/components/settings/_stub-primitives";

type ProfileFormProps = {
  profileId: string;
  initialFullName: string;
  email: string;
  initialTimezone: string;
  initialAvatarUrl: string | null;
  initialMaxHours: number | null;
  onSave: (formData: FormData) => Promise<void>;
};

export function ProfileForm({
  profileId,
  initialFullName,
  email,
  initialTimezone,
  initialAvatarUrl,
  initialMaxHours,
  onSave,
}: ProfileFormProps) {
  const [fullName, setFullName] = useState(initialFullName);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? "");
  const [maxHours, setMaxHours] = useState(initialMaxHours === null ? "" : String(initialMaxHours));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    const formData = new FormData();
    formData.set("profileId", profileId);
    formData.set("fullName", fullName);
    formData.set("timezone", timezone);
    formData.set("avatarUrl", avatarUrl);
    formData.set("maxHours", maxHours);

    try {
      await onSave(formData);
    } catch {
      setError("Could not save changes. Try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Slab>
      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1">
          {/* MonoText's stub type takes no id, so this is a span, not a form-associated label. */}
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Email</span>
          <MonoText className="text-sm text-zinc-300">{email}</MonoText>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wide text-zinc-500" htmlFor="profile-full-name">
            Full name
          </label>
          <TextInput
            id="profile-full-name"
            maxLength={120}
            name="fullName"
            onChange={(event) => setFullName(event.target.value)}
            type="text"
            value={fullName}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wide text-zinc-500" htmlFor="profile-timezone">
            Timezone
          </label>
          <TextInput
            id="profile-timezone"
            name="timezone"
            onChange={(event) => setTimezone(event.target.value)}
            placeholder="America/New_York"
            type="text"
            value={timezone}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wide text-zinc-500" htmlFor="profile-avatar-url">
            Avatar URL
          </label>
          <TextInput
            id="profile-avatar-url"
            name="avatarUrl"
            onChange={(event) => setAvatarUrl(event.target.value)}
            placeholder="https://..."
            type="text"
            value={avatarUrl}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wide text-zinc-500" htmlFor="profile-max-hours">
            Max hours per week
          </label>
          <TextInput
            id="profile-max-hours"
            min={0}
            name="maxHours"
            onChange={(event) => setMaxHours(event.target.value)}
            step="0.5"
            type="number"
            value={maxHours}
          />
        </div>

        {error ? <p className="text-sm text-rose-400">{error}</p> : null}

        <div>
          <PrimaryButton disabled={isSaving} type="submit">
            {isSaving ? "Saving..." : "Save changes"}
          </PrimaryButton>
        </div>
      </form>
    </Slab>
  );
}
