// PrintFlow Production Service Worker
// Cache Version: printflow-v1
const CACHE_NAME = "printflow-static-v1";

const STATIC_PRECACHE = [
  "/",
  "/print-centers",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/manifest.json",
];

// Install: precache app shell and static icons
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_PRECACHE).catch((err) => {
        console.warn("[SW] Precache partial failure:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean up outdated cache versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[SW] Removing old cache:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: enforce strict safety boundaries
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Only handle GET requests
  if (req.method !== "GET") {
    return;
  }

  // 2. CRITICAL SECURITY: Never cache private, customer, order, api, or storage data
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/storage/") ||
    url.pathname.startsWith("/dashboard/") ||
    url.pathname.startsWith("/dashboard") ||
    url.pathname.startsWith("/order/") || // Live customer tracker
    url.searchParams.has("customHost")
  ) {
    // Network only, direct pass-through
    return;
  }

  // 3. Static assets (_next/static, fonts, icons): Stale-While-Revalidate
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(req);
        const fetchPromise = fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(req, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 4. HTML Navigations (App Shell): Network first with cache fallback
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              // Cache generic shell routes only
              if (url.pathname === "/" || url.pathname === "/print-centers") {
                cache.put(req, clone);
              }
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const fallbackHome = await caches.match("/");
          if (fallbackHome) return fallbackHome;
          return new Response(
            `<!DOCTYPE html><html><head><title>PrintFlow Offline</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="background:#09090b;color:#fff;font-family:sans-serif;text-align:center;padding:40px;"><h2>You are offline</h2><p>Please check your internet connection to submit or view print jobs.</p><button onclick="location.reload()" style="padding:10px 20px;margin-top:16px;">Try Again</button></body></html>`,
            { headers: { "Content-Type": "text/html" } }
          );
        })
    );
  }
});
