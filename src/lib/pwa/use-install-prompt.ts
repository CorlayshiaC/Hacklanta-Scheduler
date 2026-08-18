"use client";

import { useCallback, useEffect, useState } from "react";

// Not in the standard DOM lib yet (Chromium-only API), declared locally rather than pulling in a
// types package for two fields.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function useInstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      // Browsers show their own generic install UI unless this is called; we always suppress it
      // in favor of our own quiet card so the ask stays inside the app's own visual language.
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
    }

    function handleAppInstalled() {
      setIsInstalled(true);
      setDeferredEvent(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      // Server always renders "not installed" (no window to check), reading the real state only
      // after mount, same sanctioned exception sound-manager.tsx uses for localStorage.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredEvent) {
      return false;
    }

    await deferredEvent.prompt();
    const choice = await deferredEvent.userChoice;
    setDeferredEvent(null);
    return choice.outcome === "accepted";
  }, [deferredEvent]);

  return {
    canInstall: deferredEvent !== null && !isInstalled,
    isInstalled,
    promptInstall,
  };
}
