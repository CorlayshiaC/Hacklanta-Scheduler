"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/neu-card";
import { PillButton } from "@/components/ui/neu-button";
import { useInstallPrompt } from "@/lib/pwa/use-install-prompt";

const SETTINGS_DISMISS_KEY = "progsu:install-prompt-dismissed";
const VISIT_COUNT_KEY = "progsu:visit-count";

/** Always-visible while installable, permanently dismissible. Mounted in Settings. */
export function InstallPromptSettingsCard() {
  const { canInstall, promptInstall } = useInstallPrompt();
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    // Server always renders "dismissed" (no localStorage), reading the real flag only after
    // mount, same sanctioned exception sound-manager.tsx uses.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDismissed(window.localStorage.getItem(SETTINGS_DISMISS_KEY) === "true");
  }, []);

  if (!canInstall || isDismissed) {
    return null;
  }

  function dismiss() {
    window.localStorage.setItem(SETTINGS_DISMISS_KEY, "true");
    setIsDismissed(true);
  }

  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-text-primary">Install progsu</p>
        <p className="mt-1 text-sm text-text-secondary">
          Add it to your home screen for quicker access and offline schedule viewing.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <PillButton onClick={dismiss} variant="ghost">
          Not now
        </PillButton>
        <PillButton onClick={() => void promptInstall()} variant="primary">
          Install app
        </PillButton>
      </div>
    </Card>
  );
}

/**
 * Self-contained, zero props: only starts showing on the visitor's second visit (tracked in
 * localStorage), dismissible for the rest of the session. Requested in docs/contracts/requests.md
 * for Agent 4 to mount on the dashboard, "surfaced ... after second visit" per the V2 brief.
 */
export function InstallPromptBanner() {
  const { canInstall, promptInstall } = useInstallPrompt();
  const [isEligible, setIsEligible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(VISIT_COUNT_KEY);
    const count = raw ? Number.parseInt(raw, 10) || 0 : 0;
    window.localStorage.setItem(VISIT_COUNT_KEY, String(count + 1));
    // Server always renders "not eligible" (no localStorage), reading the real visit count only
    // after mount, same sanctioned exception sound-manager.tsx uses.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsEligible(count >= 1);
  }, []);

  if (!canInstall || !isEligible || isDismissed) {
    return null;
  }

  return (
    <Card className="flex items-center justify-between gap-3">
      <p className="text-sm text-text-primary">Install progsu for quicker access.</p>
      <div className="flex items-center gap-2">
        <PillButton onClick={() => setIsDismissed(true)} size="sm" variant="ghost">
          Dismiss
        </PillButton>
        <PillButton onClick={() => void promptInstall()} size="sm" variant="primary">
          Install
        </PillButton>
      </div>
    </Card>
  );
}
