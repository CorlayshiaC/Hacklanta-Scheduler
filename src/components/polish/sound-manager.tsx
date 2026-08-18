"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "progsu:sound-enabled";

type SoundKind = "checkin" | "confirm";

type SoundContextValue = {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  play: (kind: SoundKind) => void;
};

const SoundContext = createContext<SoundContextValue | null>(null);

function readStoredPreference(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(STORAGE_KEY) === "true";
}

/** Short synthesized tick, no bundled audio asset. Confirm is a slightly higher pitch than
 * check-in so the two are distinguishable without looking at the screen. */
function playTone(kind: SoundKind) {
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.type = "sine";
  oscillator.frequency.value = kind === "checkin" ? 660 : 880;

  const now = context.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

  oscillator.start(now);
  oscillator.stop(now + 0.2);
  oscillator.onended = () => void context.close();
}

/** Mount once near the root. Off by default; the one global toggle lives in Agent 5's settings
 * via SoundToggle below. Silent under prefers-reduced-motion, per the shared motion rule. */
export function SoundManagerProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);

  useEffect(() => {
    // Always false on the server (readStoredPreference checks `typeof window`), so the initial
    // client render matches SSR output and hydrates cleanly; reading localStorage happens only
    // after mount, one intentional exception to "don't setState in an effect".
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnabledState(readStoredPreference());
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    }
  }, []);

  const play = useCallback(
    (kind: SoundKind) => {
      if (!enabled || typeof window === "undefined") {
        return;
      }
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }
      playTone(kind);
    },
    [enabled],
  );

  const value = useMemo<SoundContextValue>(() => ({ enabled, setEnabled, play }), [enabled, setEnabled, play]);

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound(): SoundContextValue {
  const ctx = useContext(SoundContext);
  if (!ctx) {
    throw new Error("useSound must be used inside SoundManagerProvider.");
  }
  return ctx;
}

/** Drop into Agent 5's settings page. Reads and writes the same context every other sound call
 * site reads, no prop wiring needed.
 * STUB(agent-1): pill toggle built against the shared spec's literal hex constants until Agent 1
 * publishes a real toggle primitive. */
export function SoundToggle() {
  const { enabled, setEnabled } = useSound();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => setEnabled(!enabled)}
      className={
        "flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors duration-150 ease-out " +
        (enabled ? "bg-white text-[#0A0A0A]" : "bg-[#1E1E1E] text-[#9A9A9A]")
      }
    >
      Sound effects: {enabled ? "on" : "off"}
    </button>
  );
}
