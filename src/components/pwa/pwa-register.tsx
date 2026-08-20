"use client";

import { useEffect } from "react";

/**
 * Dev-mode cleanup, deliberately an inline script rather than a useEffect.
 *
 * public/sw.js caches /_next/static/* cache-first on the (correct, in production) assumption that
 * those URLs are content-hashed and immutable. In dev they are not: Next reuses stable chunk URLs
 * and rewrites their contents on every recompile. A cache-first worker therefore replays stale JS,
 * the loaded bundle stops matching the server's build, and the page reload-loops forever. It
 * surfaces as "Element type is invalid. Received a promise that resolves to: undefined", because a
 * stale chunk predates a component that has since been added, so that export genuinely is undefined.
 *
 * The cleanup cannot live in a React effect. The stale bundle crashes the tree during render, so
 * effects never run, so the unregister never happens: the worker causing the crash is the reason
 * the code that removes it can't execute. A service worker outlives the tab that installed it, so
 * that state is self-sustaining across restarts with no in-app way out. Running it as an inline
 * script means it fires on HTML parse, before hydration, whether or not React ever renders.
 *
 * The sessionStorage flag bounds it to one reload per tab, so a purge can never itself become a
 * second reload loop.
 */
const DEV_PURGE = `(function () {
  if (!("serviceWorker" in navigator)) return;
  var KEY = "__pwa_dev_purged__";
  Promise.resolve()
    .then(function () {
      return navigator.serviceWorker.getRegistrations();
    })
    .then(function (registrations) {
      var found = registrations.length > 0;
      return Promise.all(registrations.map(function (r) { return r.unregister(); }))
        .then(function () {
          if (!("caches" in window)) return [];
          return caches.keys();
        })
        .then(function (keys) {
          var mine = (keys || []).filter(function (k) { return k.indexOf("progsu-") === 0; });
          if (mine.length) found = true;
          return Promise.all(mine.map(function (k) { return caches.delete(k); }));
        })
        .then(function () {
          if (found && !sessionStorage.getItem(KEY)) {
            sessionStorage.setItem(KEY, "1");
            location.reload();
          }
        });
    })
    .catch(function () {
      // Best effort. A browser that blocks either API is no worse off than before.
    });
})();`;

function ProductionRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failures (unsupported browser quirks, a blocked scope) should never surface to
      // the user; the app works identically without a service worker, just without the offline shell.
    });
  }, []);

  return null;
}

/**
 * Registers public/sw.js in production, purges it in development. Zero props, no visible output:
 * mount once near the root. NODE_ENV is inlined by the bundler, so only one branch ships.
 */
export function PwaRegister() {
  if (process.env.NODE_ENV !== "production") {
    return <script dangerouslySetInnerHTML={{ __html: DEV_PURGE }} />;
  }

  return <ProductionRegister />;
}
