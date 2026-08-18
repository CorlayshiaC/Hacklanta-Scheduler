"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { QuickchatAnswerCard, QuickchatButton } from "@/components/ui/quickchat";
import { Skeleton } from "@/components/ui/skeleton";
import { useMotionPreset } from "@/lib/utils/motion";
import { QUICKCHAT_QUERIES, type QuickchatAnswer, type QuickchatQueryKind } from "@/lib/quickchat/types";

type QueryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; answer: QuickchatAnswer; source: "template" | "rephrased" }
  | { status: "error" };

const IDLE: QueryState = { status: "idle" };

/** Wraps any whitespace-delimited token containing a digit in mono tabular figures, per the
 * shared brief: "mono for every time and number." Word-level, not a full parser: good enough for
 * short template sentences, doesn't need to be exact for punctuation attached to a token. */
function renderWithMonoNumbers(text: string): ReactNode {
  return text.split(" ").map((word, index) => {
    const key = `${word}-${index}`;
    if (/\d/.test(word)) {
      return (
        <span key={key} className="font-mono tabular-nums">
          {word}{" "}
        </span>
      );
    }
    return <span key={key}>{word} </span>;
  });
}

async function fetchAnswer(kind: QuickchatQueryKind): Promise<QuickchatAnswer | null> {
  const response = await fetch("/api/quickchat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind }),
  });
  const result = (await response.json().catch(() => null)) as { ok: boolean; answer?: QuickchatAnswer } | null;
  return result?.ok ? (result.answer ?? null) : null;
}

async function fetchRephrase(kind: QuickchatQueryKind, template: string): Promise<{ text: string; source: "template" | "rephrased" } | null> {
  const response = await fetch("/api/quickchat/rephrase", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, template }),
  });
  const result = (await response.json().catch(() => null)) as { ok: boolean; text?: string; source?: "template" | "rephrased" } | null;
  if (!result?.ok || !result.text || !result.source) {
    return null;
  }
  return { text: result.text, source: result.source };
}

/**
 * Mounts on the member dashboard (docs/contracts/quickchat.md). Self-contained: fetches its own
 * answers, Agent 4 only needs to place `<QuickchatRow />` somewhere in the dashboard layout.
 */
export function QuickchatRow() {
  const [states, setStates] = useState<Record<QuickchatQueryKind, QueryState>>({
    schedule: IDLE,
    next_event: IDLE,
    hours: IDLE,
    coworkers: IDLE,
    open_shifts: IDLE,
  });
  const [activeKind, setActiveKind] = useState<QuickchatQueryKind | null>(null);
  const { variants, fast } = useMotionPreset();

  async function handleTap(kind: QuickchatQueryKind) {
    setActiveKind(kind);

    const existing = states[kind];
    if (existing.status === "ready" || existing.status === "loading") {
      return;
    }

    setStates((prev) => ({ ...prev, [kind]: { status: "loading" } }));
    const answer = await fetchAnswer(kind);

    if (!answer) {
      setStates((prev) => ({ ...prev, [kind]: { status: "error" } }));
      return;
    }

    setStates((prev) => ({ ...prev, [kind]: { status: "ready", answer, source: "template" } }));

    // Background upgrade only, never blocks the instant template answer above. Server decides
    // eligibility (coworkers answers name other members and are never sent for rephrasing); this
    // fetch is safe to fire unconditionally, an ineligible kind just echoes the template back.
    const rephrase = await fetchRephrase(kind, answer.text);
    if (rephrase && rephrase.source === "rephrased") {
      setStates((prev) => {
        const current = prev[kind];
        if (current.status !== "ready") {
          return prev;
        }
        return { ...prev, [kind]: { ...current, answer: { ...current.answer, text: rephrase.text }, source: "rephrased" } };
      });
    }
  }

  const activeState = activeKind ? states[activeKind] : null;
  const activeLabel = QUICKCHAT_QUERIES.find((query) => query.kind === activeKind)?.label;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {QUICKCHAT_QUERIES.map((query) => (
          <QuickchatButton
            key={query.kind}
            onClick={() => handleTap(query.kind)}
            className={activeKind === query.kind ? "border-transparent bg-pill-white text-on-accent hover:bg-pill-white" : ""}
          >
            {query.label}
          </QuickchatButton>
        ))}
      </div>

      {activeState && activeState.status === "loading" && <Skeleton className="h-16 w-full max-w-sm rounded-card" />}

      {activeState && activeState.status === "error" && (
        <p className="text-sm text-text-secondary">Couldn&apos;t load that right now.</p>
      )}

      {activeState && activeState.status === "ready" && (
        <motion.div key={activeKind} initial="hidden" animate="visible" variants={variants} transition={fast}>
          <QuickchatAnswerCard>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
              {activeLabel}
            </span>
            <Link href={activeState.answer.deepLink} className="block hover:text-accent-go">
              {renderWithMonoNumbers(activeState.answer.text)}
            </Link>
          </QuickchatAnswerCard>
        </motion.div>
      )}
    </div>
  );
}
