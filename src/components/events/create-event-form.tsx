"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NeuCard } from "@/components/ui/neu-card";
import { NeuButton } from "@/components/ui/neu-button";
import { NeuInput } from "@/components/ui/neu-input";
import { NeuTextarea } from "@/components/ui/neu-textarea";
import { createEvent } from "@/lib/scheduling/actions";
import { zonedTimeToUtcIso } from "@/lib/scheduling/timezone";

export function CreateEventForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
  );
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!startsAt || !endsAt) {
      setMessage({ kind: "error", text: "Choose a start and end time." });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const result = await createEvent({
      name,
      description: description || undefined,
      location: location || undefined,
      startsAt: zonedTimeToUtcIso(startsAt, timezone),
      endsAt: zonedTimeToUtcIso(endsAt, timezone),
      timezone,
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setMessage({ kind: "error", text: result.message });
      return;
    }

    router.push(`/events/${result.data.eventId}`);
  }

  return (
    <NeuCard padded={false}>
      <form className="flex flex-col gap-4 p-4" onSubmit={handleSubmit}>
        <div>
          <label className="text-sm font-medium text-text-primary" htmlFor="event-name">
            Event name
          </label>
          <NeuInput
            className="mt-1"
            id="event-name"
            name="name"
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-text-primary" htmlFor="event-description">
            Description
          </label>
          <NeuTextarea
            className="mt-1"
            id="event-description"
            name="description"
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            value={description}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-text-primary" htmlFor="event-location">
            Location
          </label>
          <NeuInput
            className="mt-1"
            id="event-location"
            name="location"
            onChange={(event) => setLocation(event.target.value)}
            value={location}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-text-primary" htmlFor="event-starts-at">
              Starts at
            </label>
            <NeuInput
              className="mt-1"
              id="event-starts-at"
              name="startsAt"
              onChange={(event) => setStartsAt(event.target.value)}
              required
              type="datetime-local"
              value={startsAt}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-text-primary" htmlFor="event-ends-at">
              Ends at
            </label>
            <NeuInput
              className="mt-1"
              id="event-ends-at"
              name="endsAt"
              onChange={(event) => setEndsAt(event.target.value)}
              required
              type="datetime-local"
              value={endsAt}
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-text-primary" htmlFor="event-timezone">
            Timezone
          </label>
          <NeuInput
            className="mt-1"
            id="event-timezone"
            name="timezone"
            onChange={(event) => setTimezone(event.target.value)}
            required
            value={timezone}
          />
        </div>
        {message ? (
          <p
            className={message.kind === "error" ? "text-sm text-danger" : "text-sm text-purple-400"}
            role={message.kind === "error" ? "alert" : "status"}
          >
            {message.text}
          </p>
        ) : null}
        <NeuButton disabled={isSubmitting} type="submit" variant="primary">
          {isSubmitting ? "Creating event..." : "Create event"}
        </NeuButton>
      </form>
    </NeuCard>
  );
}
