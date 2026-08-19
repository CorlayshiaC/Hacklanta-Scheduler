"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { QuickchatAnswerCard, QuickchatButton } from "@/components/ui/quickchat";
import { Skeleton } from "@/components/ui/skeleton";
import { pillPress } from "@/lib/utils/motion";
import { springStandard, useReducedTransition } from "@/lib/design-stub/motion-v4";
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

  const morphTransition = useReducedTransition(springStandard);

  return (
    // motion-spec.md v4.1 section 5: "Quickchat chip to its answer card inside the gradient panel
    // and back." Each cell shares one layoutId across its collapsed (button) and expanded (card)
    // render, so the tapped chip's own bounding box grows into the card in place; `layout` on the
    // row lets sibling chips spring out of the way rather than reflowing instantly.
    <motion.div layout className="flex flex-wrap items-start gap-2" transition={morphTransition}>
      {QUICKCHAT_QUERIES.map((query) => {
        const state = states[query.kind];
        const isActive = activeKind === query.kind;

        if (!isActive || state.status === "idle") {
          return (
            <motion.div key={query.kind} layout layoutId={`quickchat-${query.kind}`} transition={morphTransition}>
              <motion.div whileTap={pillPress} className="inline-flex">
                <QuickchatButton onClick={() => handleTap(query.kind)}>{query.label}</QuickchatButton>
              </motion.div>
            </motion.div>
          );
        }

        return (
          <motion.div
            key={query.kind}
            layout
            layoutId={`quickchat-${query.kind}`}
            transition={morphTransition}
            className="w-full max-w-sm"
          >
            {state.status === "loading" && <Skeleton className="h-16 w-full rounded-card" />}
            {state.status === "error" && (
              <QuickchatAnswerCard>
                <p className="text-sm text-text-secondary">Couldn&apos;t load that right now.</p>
              </QuickchatAnswerCard>
            )}
            {state.status === "ready" && (
              <QuickchatAnswerCard>
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.12, delay: 0.06 }}
                  className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary"
                >
                  {query.label}
                </motion.span>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12, delay: 0.06 }}>
                  <Link href={state.answer.deepLink} className="block hover:text-accent-go">
                    {renderWithMonoNumbers(state.answer.text)}
                  </Link>
                </motion.div>
              </QuickchatAnswerCard>
            )}
          </motion.div>
        );
      })}
    </motion.div>
  );
}
