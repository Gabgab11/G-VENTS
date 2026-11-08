/* G-ventZ service worker (PWA, change C3).
 * - App code, fonts and icons: cache first (their URLs change with every build).
 * - Pages: network first, never served stale. Ticket pages (/t/...) that were opened are kept, so a
 *   guest's ticket still shows at the door without signal. Anything else offline: /offline.
 * - Never touches API calls, sign-in, server actions or other sites.
 * Signing out sends "clear-tickets", which drops the saved ticket pages from this device.
 */
const VERSION = "v1";
const STATIC = `gventz-static-${VERSION}`;
const PAGES = `gventz-pages-${VERSION}`;
const OFFLINE = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.addAll([OFFLINE, "/icons/icon-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("gventz-") && k !== STATIC && k !== PAGES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "clear-tickets") {
    event.waitUntil(caches.open(PAGES).then(async (c) => {
      for (const req of await c.keys()) if (new URL(req.url).pathname.startsWith("/t/")) await c.delete(req);
    }));
  }
});

const isStatic = (url) => url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || /\.(?:woff2?|png|svg|ico)$/.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/") || req.headers.has("next-action") || req.headers.get("rsc")) return;

  if (isStatic(url)) {
    event.respondWith(
      caches.open(STATIC).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (req.mode === "navigate") {
    const ticket = url.pathname.startsWith("/t/");
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (ticket && res.ok) caches.open(PAGES).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(async () => (ticket && (await caches.match(req))) || (await caches.match(OFFLINE)) || Response.error()),
    );
  }
});
