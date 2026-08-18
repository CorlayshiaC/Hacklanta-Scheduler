"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js on mount. Zero props, no visible output: mount once near the root, same
 * pattern as SoundManagerProvider/EasterEggListener. Requested in docs/contracts/requests.md for
 * Agent 1 to mount in src/app/layout.tsx (not mine to edit).
 */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failures (unsupported browser quirks, a blocked scope, dev-mode HTTP without
      // localhost) should never surface to the user, the app works identically without a service
      // worker, just without the offline shell.
    });
  }, []);

  return null;
}
