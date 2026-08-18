"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import type { CommandContext } from "@/components/command-palette/types";
import { Card } from "@/components/ui/neu-card";
import { PillButton } from "@/components/ui/neu-button";
import { NeuBadge } from "@/components/ui/neu-badge";
import { ShiftCapsule } from "@/components/ui/shift-capsule";
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
          className="rounded-pill bg-elevated px-4 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-muted focus-visible:shadow-focus-ring"
        />
        <PillButton type="submit" variant="primary" disabled={loading} className="self-start">
          {loading ? "Thinking." : "Parse"}
        </PillButton>
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

function isLowConfidence(confidence: number | undefined): boolean {
  return (confidence ?? 1) < 0.6;
}

/** Small orange dot on a low-confidence field, per the design contract's confidence convention. */
function ConfidenceDot({ low }: { low: boolean }) {
  if (!low) {
    return null;
  }
  return <span aria-hidden="true" className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent-warn" />;
}

function LowConfidenceValue({ value, low }: { value: string; low: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-text-primary">
      <ConfidenceDot low={low} />
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
  const windowLow = isLowConfidence(Math.min(draft.confidence.windowStart ?? 1, draft.confidence.windowEnd ?? 1));
  const stationsLow = isLowConfidence(draft.confidence.stations);
  const blockLow = isLowConfidence(draft.confidence.blockLengthMinutes);

  return (
    <Card padded className="flex flex-col gap-3 border border-hairline">
      <DraftRow label="Window">
        <LowConfidenceValue
          value={`${formatInstant(draft.windowStart)} to ${formatInstant(draft.windowEnd)}`}
          low={windowLow}
        />
      </DraftRow>
      <DraftRow label="Block length">
        <LowConfidenceValue value={`${draft.blockLengthMinutes} min`} low={blockLow} />
      </DraftRow>

      <div className="flex flex-col gap-1.5">
        <span className="flex items-center gap-1.5 text-xs text-text-muted">
          <ConfidenceDot low={stationsLow} />
          Stations, hollow until created
        </span>
        <div className="flex flex-wrap gap-1.5">
          {draft.stations.map((station) => (
            <ShiftCapsule
              key={station.name}
              state="empty"
              size="sm"
              label={`${station.name} (${station.headcount})`}
              className="w-auto shrink-0"
            />
          ))}
        </div>
      </div>

      <ClarificationsList items={draft.clarifications} />

      <div className="flex items-center justify-between gap-3 pt-1">
        <PillButton
          variant="primary"
          disabled
          title="Opens once the bulk generate dialog accepts a prefill (STUB(agent-3))"
        >
          Create these shifts
        </PillButton>
        <PillButton variant="ghost" onClick={onClose}>
          Close
        </PillButton>
      </div>
      <p className="text-xs text-text-muted">
        Continues into the bulk generate dialog once that flow is published (STUB(agent-3)).
      </p>
    </Card>
  );
}

function AvailabilityDraftCard({ draft, onClose }: { draft: AvailabilityParseOutput; onClose: () => void }) {
  const low = isLowConfidence(draft.confidence);

  return (
    <Card padded className="flex flex-col gap-3 border border-hairline">
      <div className="flex flex-col gap-1.5">
        <span className="flex items-center gap-1.5 text-xs text-text-muted">
          <ConfidenceDot low={low} />
          Windows
        </span>
        {draft.windows.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {draft.windows.map((window) => (
              <NeuBadge key={`${window.startsAt}-${window.endsAt}`} className="font-mono tabular-nums">
                {formatInstant(window.startsAt)} to {formatInstant(window.endsAt)}
              </NeuBadge>
            ))}
          </div>
        ) : (
          <span className="text-sm text-text-secondary">None parsed</span>
        )}
      </div>

      <ClarificationsList items={draft.clarifications} />

      <div className="flex items-center justify-between gap-3 pt-1">
        <PillButton
          variant="primary"
          disabled
          title="Opens once the availability grid accepts a paintDraft selection (STUB(agent-4))"
        >
          Confirm into grid
        </PillButton>
        <PillButton variant="ghost" onClick={onClose}>
          Close
        </PillButton>
      </div>
      <p className="text-xs text-text-muted">
        Confirms into the availability grid as a draft selection once paintDraft is published (STUB(agent-4)).
      </p>
    </Card>
  );
}
