"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js on mount. Zero props, no visible output: mount once near the root, same
 * pattern as SoundManagerProvider/EasterEggListener. Requested in docs/contracts/requests.md for
 * Agent 1 to mount in src/app/layout.tsx (not mine to edit).
 *
 * Production only, deliberately. public/sw.js caches /_next/static/* cache-first on the (correct,
 * in production) assumption that those URLs are content-hashed and immutable. In dev they are not:
 * Next reuses stable chunk URLs (main-app.js, webpack.js, app/layout.js) and rewrites their
 * contents on every recompile. A cache-first worker therefore replays stale JS, the loaded bundle
 * stops matching the server's build, Fast Refresh forces a full reload, the worker serves the same
 * stale chunks again, and the page reload-loops forever. It also surfaces as
 * "Element type is invalid. Received a promise that resolves to: undefined" whenever a cached chunk
 * predates a component that has since been added, because that export genuinely is undefined in the
 * stale bundle. Confirmed live, not theorized: this was reload-looping /my-schedule.
 *
 * The dev branch actively unregisters and purges rather than just skipping registration. A service
 * worker is registered per-origin and outlives the tab that installed it, so a developer whose
 * browser already has the old worker would otherwise stay stuck in the loop no matter how many
 * times the dev server restarts or the tab is reopened, with no in-app way out.
 */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      void (async () => {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((registration) => registration.unregister()));

          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(keys.filter((key) => key.startsWith("progsu-")).map((key) => caches.delete(key)));
          }
        } catch {
          // Best effort cleanup. A browser that blocks either API is no worse off than before.
        }
      })();
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
