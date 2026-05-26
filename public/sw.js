/* eslint-disable no-restricted-globals */
const CACHE_VERSION = "oyamacrm-v1";
const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/manifest.webmanifest"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== APP_SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  // Never intercept localhost traffic to avoid blocking Next.js dev HMR updates.
  if (requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1") return;

  // Let Next internals and API routes always hit the network.
  if (requestUrl.pathname.startsWith("/_next/") || requestUrl.pathname.startsWith("/__nextjs/") || requestUrl.pathname.startsWith("/api/")) {
    return;
  }

  // Navigation (HTML) requests: always network-first, no caching.
  // Caching HTML causes stale Next.js chunk URLs after a new deployment.
  // The browser already respects the server's Cache-Control: no-cache on HTML.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return caches.match(OFFLINE_URL);
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200) return response;
          const cloned = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, cloned)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(OFFLINE_URL));
    })
  );
});
