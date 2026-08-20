// prog scheduler service worker.
//
// Scope, deliberately narrow: caches the app shell's static build assets (cache-first, safe since
// Next's /_next/static/ output is content-hashed and immutable) and gives the two read-only
// offline routes the V2 brief calls for (dashboard "/" and "/my-schedule", both Agent 4's) a
// network-first-with-cache-fallback strategy, so opening the installed app icon while offline
// still shows the last-seen schedule instead of a browser error page.
//
// Known limitation, not fixed here: this only intercepts real browser navigations
// (`request.mode === "navigate"`, e.g. opening the app icon, a hard refresh). Soft client-side
// transitions between routes (clicking a next/link while already inside the app) go through
// Next's RSC fetch protocol instead, which this worker does not cache, so navigating between "/"
// and "/my-schedule" via in-app links while offline will still fail. Full App Router offline
// support (caching RSC payloads correctly, keyed by the Next-Router-State-Tree request header)
// is enough surface area that it is normally solved with a library (Workbox/Serwist), which is a
// new dependency this pass did not add without going through the usual package-change channel,
// see docs/contracts/pending.md.
const CACHE_VERSION = "v1";
const CACHE_NAME = `progsu-${CACHE_VERSION}`;
const OFFLINE_SHELL_PATHS = ["/", "/my-schedule"];

// A worker installed by a production build stays registered per-origin and outlives the tab that
// installed it, so running the app in dev on the same origin (localhost) later inherits it. Its
// cache-first /_next/static/ strategy is wrong there, because dev reuses stable chunk URLs and
// rewrites their contents on every recompile, which reload-loops the page. Refusing to run on
// localhost at all keeps a worker that is already installed from poisoning dev, independently of
// whether the app's own dev cleanup gets a chance to run.
const IS_LOCALHOST = self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1";

self.addEventListener("install", () => {
  if (IS_LOCALHOST) {
    self.registration.unregister();
    return;
  }

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (IS_LOCALHOST || request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate" && OFFLINE_SHELL_PATHS.includes(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseCopy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseCopy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached ?? Response.error())),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icon-")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const responseCopy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseCopy));
            return response;
          }),
      ),
    );
  }
});
