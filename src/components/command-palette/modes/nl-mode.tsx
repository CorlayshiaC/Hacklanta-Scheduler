"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import type { CommandContext } from "@/components/command-palette/types";
import type { AiResult } from "@/lib/ai/types";
import type { AvailabilityParseOutput } from "@/lib/ai/kinds/availability-parse";
import type { ShiftGenerationOutput } from "@/lib/ai/kinds/shift-generation";

/**
 * Routes by role rather than sniffing the phrase: organizers create shifts, members submit
 * availability, and a member has no path to the organizer-only /api/ai/shift-generation route
 * anyway. Confirm cards are a deliberate STUB(agent-3)/STUB(agent-4): they round-trip the parse
 * to a reviewable draft, per the NL-generation definition of done, but the handoff into a real
 * create flow waits on Agent 3's bulk-generate dialog and Agent 4's paintDraft, see
 * docs/contracts/pending.md.
 */
type NlKind = "shift" | "availability";

function kindForRole(role: CommandContext["role"]): NlKind {
  return role === "member" ? "availability" : "shift";
}

function localTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function formatInstant(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function NlPaletteMode({ ctx, onClose }: { ctx: CommandContext; onClose: () => void }) {
  const kind = kindForRole(ctx.role);
  const [phrase, setPhrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shiftDraft, setShiftDraft] = useState<ShiftGenerationOutput | null>(null);
  const [availabilityDraft, setAvailabilityDraft] = useState<AvailabilityParseOutput | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!phrase.trim() || loading) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setShiftDraft(null);
    setAvailabilityDraft(null);

    const timezone = localTimezone();
    const nowIso = new Date().toISOString();
    const endpoint = kind === "shift" ? "/api/ai/shift-generation" : "/api/ai/availability-parse";
    const body =
      kind === "shift"
        ? { phrase, nowIso, timezone }
        : {
            phrase,
            rangeStart: nowIso,
            rangeEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            timezone,
          };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as AiResult<ShiftGenerationOutput | AvailabilityParseOutput>;

      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }

      if (kind === "shift") {
        setShiftDraft(result.data as ShiftGenerationOutput);
      } else {
        setAvailabilityDraft(result.data as AvailabilityParseOutput);
      }
    } catch {
      setErrorMessage("Could not reach the AI service.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label htmlFor="nl-phrase" className="text-xs uppercase tracking-wide text-text-muted">
          {kind === "shift" ? "Describe the shift" : "Describe your availability"}
        </label>
        <input
          id="nl-phrase"
          autoFocus
          value={phrase}
          onChange={(event) => setPhrase(event.target.value)}
          placeholder={
            kind === "shift"
              ? "setup crew friday 8 to noon in 2 hour blocks, 3 people each"
              : "free weekday evenings except thursday"
          }
          className="rounded-neu bg-bg-sunken px-3 py-2 text-sm text-text-primary shadow-neu-pressed outline-none focus-visible:shadow-neu-focus"
        />
        <button
          type="submit"
          disabled={loading}
          className="self-start rounded-neu bg-bg-surface px-3 py-1.5 text-sm text-text-primary shadow-neu-raised-sm transition-shadow duration-fast ease-neu-out hover:shadow-neu-glow disabled:opacity-50"
        >
          {loading ? "Thinking." : "Parse"}
        </button>
      </form>

      {errorMessage && (
        <p className="text-sm text-text-secondary">
          {errorMessage} Use the manual {kind === "shift" ? "bulk generate dialog" : "availability grid"} instead.
        </p>
      )}

      {shiftDraft && <ShiftDraftCard draft={shiftDraft} onClose={onClose} />}
      {availabilityDraft && <AvailabilityDraftCard draft={availabilityDraft} onClose={onClose} />}
    </div>
  );
}

function LowConfidenceValue({ value, confidence }: { value: string; confidence: number | undefined }) {
  const low = (confidence ?? 1) < 0.6;
  return (
    <span className={low ? "text-purple-400 underline decoration-dotted underline-offset-4" : "text-text-primary"}>
      {value}
    </span>
  );
}

function DraftRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-text-muted">{label}</span>
      {children}
    </div>
  );
}

function ClarificationsList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <ul className="list-disc pl-4 text-xs text-text-secondary">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function ShiftDraftCard({ draft, onClose }: { draft: ShiftGenerationOutput; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-neu bg-bg-surface p-3 shadow-neu-raised-sm">
      <DraftRow label="Window">
        <LowConfidenceValue
          value={`${formatInstant(draft.windowStart)} to ${formatInstant(draft.windowEnd)}`}
          confidence={Math.min(draft.confidence.windowStart ?? 1, draft.confidence.windowEnd ?? 1)}
        />
      </DraftRow>
      <DraftRow label="Block length">
        <LowConfidenceValue value={`${draft.blockLengthMinutes} min`} confidence={draft.confidence.blockLengthMinutes} />
      </DraftRow>
      <DraftRow label="Stations">
        <LowConfidenceValue
          value={draft.stations.map((station) => `${station.name} (${station.headcount})`).join(", ")}
          confidence={draft.confidence.stations}
        />
      </DraftRow>
      <ClarificationsList items={draft.clarifications} />
      <p className="text-xs text-text-muted">
        Continues into the bulk generate dialog once that flow is published (STUB(agent-3)).
      </p>
      <button type="button" onClick={onClose} className="self-start text-xs text-purple-400 hover:text-purple-500">
        Close
      </button>
    </div>
  );
}

function AvailabilityDraftCard({ draft, onClose }: { draft: AvailabilityParseOutput; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-neu bg-bg-surface p-3 shadow-neu-raised-sm">
      <DraftRow label="Windows">
        <LowConfidenceValue
          value={
            draft.windows.length > 0
              ? draft.windows.map((window) => `${formatInstant(window.startsAt)} to ${formatInstant(window.endsAt)}`).join("; ")
              : "None parsed"
          }
          confidence={draft.confidence}
        />
      </DraftRow>
      <ClarificationsList items={draft.clarifications} />
      <p className="text-xs text-text-muted">
        Confirms into the availability grid as a draft selection once paintDraft is published (STUB(agent-4)).
      </p>
      <button type="button" onClick={onClose} className="self-start text-xs text-purple-400 hover:text-purple-500">
        Close
      </button>
    </div>
  );
}
