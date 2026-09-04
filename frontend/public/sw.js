// Service worker for OAE Inventory PWA.
// SAFE for Next.js App Router: RSC/router-prefetch requests are never
// intercepted. Immutable static assets (_next/static) are cache-first;
// navigation HTML is network-first with a last-served-page fallback so an
// offline reload boots the real app (data comes from Firestore's local cache
// and the store persist layer — Firebase traffic is never touched here).

// v2: forces every installed PWA to evict all cached chunks/pages from the
// pre-increment-rewrite builds so stale bundles can never execute again.
const STATIC_CACHE = "inv-management-static-v2";
const NAV_CACHE = "inv-management-pages-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== NAV_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept React Server Component or router-prefetch requests — these
  // must always hit the network or App Router client-side navigation breaks.
  if (
    request.headers.get("RSC") === "1" ||
    request.headers.get("Next-Router-Prefetch") === "1"
  ) {
    return;
  }

  // Navigation: network-first so users always get fresh HTML when online.
  // Offline, serve the last-served HTML for THIS URL so a reload boots the
  // real app (cached HTML is skeleton-level — pages fetch data client-side).
  // For URLs never visited while online, fall back to the LAST-SERVED app
  // page so the real app still boots — the app itself is offline-capable
  // (Firestore local cache + queued writes) and shows its own offline
  // banner. No static "You're offline" page: it must never trap the user.
  // Successful responses are re-cached per-URL; every logout clears the
  // whole NAV_CACHE via the CLEAR_NAV_CACHE message handled below.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(NAV_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => {
            if (cached) return cached;
            return caches.open(NAV_CACHE).then((cache) =>
              cache
                .keys()
                .then((keys) =>
                  keys.length ? cache.match(keys[keys.length - 1]) : undefined
                )
            );
          })
        )
    );
    return;
  }

  // Immutable (content-hashed) static assets: cache-first, populate in background.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          });
        })
      )
    );
    return;
  }

  // Everything else (API, data, images, fonts): network-only.
  event.respondWith(fetch(request));
});

// Logout hook: the app's signOut wrapper asks us to drop cached page HTML so
// a signed-out browser holds no authenticated shells. Best-effort — dev has
// no service worker, and a not-yet-controlling worker simply won't get it.
self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_NAV_CACHE") {
    event.waitUntil(caches.delete(NAV_CACHE));
  }
});
