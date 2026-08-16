"use client";

import { useMemo } from "react";
import {
  createAvailabilityWindowAction,
  deleteAvailabilityWindowAction,
  updateAvailabilityWindowAction,
} from "@/lib/availability/actions";
import {
  differenceInHours,
  formatDateInTimeZone,
  formatTimeInTimeZone,
  HACKLANTA_TIME_ZONE,
} from "@/lib/availability/time";
import type { AvailabilityWindow, HackLantaEvent } from "@/lib/availability/data";

type AvailabilityManagerProps = {
  event: HackLantaEvent;
  showEventHeader?: boolean;
  windows: AvailabilityWindow[];
};

const eventDays = [
  { date: "2026-10-09", label: "Friday" },
  { date: "2026-10-10", label: "Saturday" },
  { date: "2026-10-11", label: "Sunday" },
];

function validateForm(form: HTMLFormElement) {
  const date = form.elements.namedItem("date");
  const startsAt = form.elements.namedItem("startsAt");
  const endsAt = form.elements.namedItem("endsAt");

  if (
    !(date instanceof HTMLInputElement) ||
    !(startsAt instanceof HTMLInputElement) ||
    !(endsAt instanceof HTMLInputElement)
  ) {
    return true;
  }

  if (!date.value || !startsAt.value || !endsAt.value) {
    return true;
  }

  const start = `${date.value}T${startsAt.value}`;
  const end = `${date.value}T${endsAt.value}`;

  if (start >= end) {
    endsAt.setCustomValidity("End time must be after start time.");
    endsAt.reportValidity();
    return false;
  }

  endsAt.setCustomValidity("");
  return true;
}

function AvailabilityForm({
  action,
  submitLabel,
  window,
}: {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  window?: AvailabilityWindow;
}) {
  const defaultDate = window?.starts_at
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone: HACKLANTA_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(window.starts_at))
    : "2026-10-09";

  const defaultStart = window?.starts_at
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: HACKLANTA_TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(window.starts_at))
    : "";

  const defaultEnd = window?.ends_at
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: HACKLANTA_TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(window.ends_at))
    : "";

  return (
    <form
      action={action}
      className="grid gap-3 sm:grid-cols-[150px_120px_120px_1fr_auto]"
      onSubmit={(event) => {
        if (!validateForm(event.currentTarget)) {
          event.preventDefault();
        }
      }}
    >
      {window ? <input name="windowId" type="hidden" value={window.id} /> : null}
      <label className="space-y-1 text-sm font-medium text-ink">
        <span>Date</span>
        <input
          className="hl-input h-10 w-full rounded-md px-3 text-sm"
          defaultValue={defaultDate}
          max="2026-10-11"
          min="2026-10-09"
          name="date"
          required
          type="date"
        />
      </label>
      <label className="space-y-1 text-sm font-medium text-ink">
        <span>Start</span>
        <input
          className="hl-input h-10 w-full rounded-md px-3 text-sm"
          defaultValue={defaultStart}
          name="startsAt"
          required
          type="time"
        />
      </label>
      <label className="space-y-1 text-sm font-medium text-ink">
        <span>End</span>
        <input
          className="hl-input h-10 w-full rounded-md px-3 text-sm"
          defaultValue={defaultEnd}
          name="endsAt"
          required
          type="time"
        />
      </label>
      <label className="space-y-1 text-sm font-medium text-ink">
        <span>Note</span>
        <input
          className="hl-input h-10 w-full rounded-md px-3 text-sm"
          defaultValue={window?.note ?? ""}
          maxLength={160}
          name="note"
          placeholder="Optional"
          type="text"
        />
      </label>
      <div className="flex items-end">
        <button
          className="hl-button-primary h-10 w-full rounded-md px-4 text-sm font-semibold sm:w-auto"
          type="submit"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

export function AvailabilityManager({ event, showEventHeader = true, windows }: AvailabilityManagerProps) {
  const totalHours = useMemo(
    () => windows.reduce((total, window) => total + differenceInHours(window.starts_at, window.ends_at), 0),
    [windows],
  );
  const groupedWindows = useMemo(
    () =>
      eventDays.map((day) => ({
        ...day,
        windows: windows.filter((window) => {
          const date = new Intl.DateTimeFormat("en-CA", {
            timeZone: HACKLANTA_TIME_ZONE,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date(window.starts_at));
          return date === day.date;
        }),
      })),
    [windows],
  );

  return (
    <div className="space-y-4">
      {showEventHeader ? (
        <section className="hl-card rounded-lg p-5 shadow-sm">
          <p className="text-sm font-medium uppercase text-signal">HackLanta II</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Availability</h1>
          <div className="mt-4 grid gap-3 text-sm text-muted sm:grid-cols-3">
            <p>
              <span className="block font-medium text-ink">October 9-11, 2026</span>
              Full operational event window
            </p>
            <p>
              <span className="block font-medium text-ink">Operational coverage</span>
              Friday 7:00 AM to Sunday 3:00 PM
            </p>
            <p>
              <span className="block font-medium text-ink">Timezone</span>
              {event.timezone}
            </p>
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="hl-card rounded-lg p-3">
          <p className="text-sm text-muted">Total availability</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{totalHours.toFixed(1)} hours</p>
        </div>
        <div className="hl-card rounded-lg p-3">
          <p className="text-sm text-muted">Availability windows</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{windows.length}</p>
        </div>
      </section>

      <section className="hl-card rounded-lg p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Add Availability</h2>
        <p className="mt-1 text-sm text-muted">
          Add times when you can help during the operational event window. Times are shown in
          America/New_York.
        </p>
        <div className="mt-4">
          <AvailabilityForm action={createAvailabilityWindowAction} submitLabel="Add" />
        </div>
      </section>

      <section className="hl-card rounded-lg p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Timeline</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {groupedWindows.map((day) => (
            <div className="rounded-lg border border-line bg-elevated/60 p-3" key={day.date}>
              <p className="font-medium text-ink">{day.label}</p>
              {day.windows.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {day.windows.map((window) => (
                    <div className="rounded-md bg-elevated/80 px-3 py-2 text-sm text-ink" key={window.id}>
                      {formatTimeInTimeZone(window.starts_at)} - {formatTimeInTimeZone(window.ends_at)}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted">No availability submitted.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <details className="space-y-4">
        <summary className="cursor-pointer text-lg font-semibold text-ink">Submitted Availability</summary>
        {windows.length === 0 ? (
          <div className="hl-card mt-3 rounded-lg p-4 text-sm text-muted">
            No availability submitted yet.
          </div>
        ) : (
          windows.map((window) => (
            <article className="hl-card mt-3 rounded-lg p-4 shadow-sm" key={window.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium text-ink">{formatDateInTimeZone(window.starts_at)}</p>
                  <p className="mt-1 text-sm text-muted">
                    {formatTimeInTimeZone(window.starts_at)} - {formatTimeInTimeZone(window.ends_at)}
                  </p>
                  {window.note ? <p className="mt-2 text-sm text-muted">{window.note}</p> : null}
                </div>
                <form
                  action={deleteAvailabilityWindowAction}
                  onSubmit={(event) => {
                    if (!globalThis.confirm("Delete this availability window?")) {
                      event.preventDefault();
                    }
                  }}
                >
                  <input name="windowId" type="hidden" value={window.id} />
                  <button
                    className="rounded-md border border-danger/35 px-3 py-2 text-sm font-medium text-danger transition hover:bg-danger/10"
                    type="submit"
                  >
                    Delete
                  </button>
                </form>
              </div>
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-signal">Edit</summary>
                <div className="mt-3">
                  <AvailabilityForm
                    action={updateAvailabilityWindowAction}
                    submitLabel="Save"
                    window={window}
                  />
                </div>
              </details>
            </article>
          ))
        )}
      </details>
    </div>
  );
}
