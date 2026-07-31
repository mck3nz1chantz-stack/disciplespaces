/**
 * DiscipleSpaces service worker — app shell + Bible JSON (runtime cache).
 * Vanilla SW (no workbox generateSW) so production builds work on Node 25/26.
 *
 * Brick-prevention:
 * - Bump SHELL_CACHE when install strategy changes.
 * - Hashed /assets/* are network-first (avoid stale JS/CSS vs new index.html).
 * - skipWaiting + clients.claim; clients should reload on controllerchange.
 */
/* eslint-disable no-restricted-globals */
/** Bump when shell caching strategy or pre-cache list must force-refresh. */
const SHELL_CACHE = "ds-shell-v7";
const BIBLE_CACHE = "bible-data-pd-v1";

const SHELL_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.svg?v=3",
  "/icons/icon-192.png?v=3",
  "/icons/icon-512.png?v=3",
];

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== BIBLE_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim())
      .then(() =>
        self.clients.matchAll({ type: "window" }).then((clients) => {
          for (const client of clients) {
            client.postMessage({ type: "DS_SW_ACTIVATED" });
          }
        }),
      ),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Bible JSON — cache first after first visit
  if (/\/data\/bible\/.*\.json$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(req, BIBLE_CACHE));
    return;
  }

  // Favicon + app icons — network first so icon updates actually show
  if (
    /\/favicon\.(svg|ico|png)$/i.test(url.pathname) ||
    /\/icons\/icon-\d+\.png$/i.test(url.pathname)
  ) {
    event.respondWith(networkFirst(req, SHELL_CACHE));
    return;
  }

  // Navigations — network first, fall back to cached shell
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            void caches.open(SHELL_CACHE).then((c) => c.put("/index.html", copy));
          }
          return res;
        })
        .catch(() =>
          caches.match("/index.html").then((r) => r || caches.match("/")),
        ),
    );
    return;
  }

  // Hashed Vite bundles — network first (stale-while-revalidate caused
  // old JS + new HTML mismatches that look like a white-screen brick).
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(networkFirst(req, SHELL_CACHE));
    return;
  }

  // Media (scroll-play video) — always network; never pin a stale encode
  if (url.pathname.startsWith("/media/")) {
    event.respondWith(
      fetch(req, { cache: "no-store" }).catch(() => caches.match(req)).then(
        (r) => r || Response.error(),
      ),
    );
    return;
  }

  // Other static shell assets — stale-while-revalidate
  if (/\.(?:js|css|png|svg|ico|woff2|webmanifest)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(req, SHELL_CACHE));
  }
});

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) {
    const cache = await caches.open(cacheName);
    void cache.put(req, res.clone());
  }
  return res;
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req, { cache: "no-store" });
    if (res.ok) void cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    // Try bare path without query
    const bare = req.url.split("?")[0];
    return (await cache.match(bare)) || Response.error();
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res.ok) void cache.put(req, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || network;
}
