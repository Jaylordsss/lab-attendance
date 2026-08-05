/**
 * Service worker.
 *
 * Deliberately minimal. Attendance is a live transaction — a cached roster or
 * a cached "you are present" screen would be worse than no cache at all, so
 * nothing under /api or any page that reads the database is stored.
 *
 * What it does cache is the shell: icons and static assets, so the app opens
 * instantly and shows something useful when the laboratory wifi drops.
 */

const CACHE = "lab-attendance-v1";

const SHELL = [
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/offline",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() =>
      self.skipWaiting(),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never serve a stale answer for anything that touches the database.
  if (url.pathname.startsWith("/api/")) return;

  // Navigations: try the network, fall back to the offline notice.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/offline").then((r) => r ?? Response.error()),
      ),
    );
    return;
  }

  // Static assets: cache first, they do not change without a new filename.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico")
  ) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
            return res;
          }),
      ),
    );
  }
});
