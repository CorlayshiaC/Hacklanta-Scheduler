"use client";

import { useState } from "react";
import type { FormEvent } from "react";
// STUB(agent-1): replace with the real primitives once components/ui publishes it.
import { MonoText, PillButton, TextInput } from "@/components/settings/_stub-primitives";

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
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-1">
        {/* MonoText's stub type takes no id, so this is a span, not a form-associated label. */}
        <span className="text-xs font-medium uppercase tracking-wide text-[#5E5E5E]">Email</span>
        <MonoText className="text-sm text-[#9A9A9A]">{email}</MonoText>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium uppercase tracking-wide text-[#5E5E5E]" htmlFor="profile-full-name">
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
        <label className="text-xs font-medium uppercase tracking-wide text-[#5E5E5E]" htmlFor="profile-timezone">
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
        <label className="text-xs font-medium uppercase tracking-wide text-[#5E5E5E]" htmlFor="profile-avatar-url">
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
        <label className="text-xs font-medium uppercase tracking-wide text-[#5E5E5E]" htmlFor="profile-max-hours">
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

      {error ? <p className="text-sm text-[#FF9F2E]">{error}</p> : null}

      <div>
        <PillButton disabled={isSaving} type="submit" variant="primary">
          {isSaving ? "Saving..." : "Save changes"}
        </PillButton>
      </div>
    </form>
  );
}
