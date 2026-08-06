const CACHE_NAME = "sfs-v1";

// ─── Instalación ─────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// ─── Activación ──────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// ─── Fetch ───────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // NUNCA interceptar POST, PUT, DELETE, PATCH
  if (request.method !== "GET" && request.method !== "HEAD") return;

  const url = new URL(request.url);

  // API calls: Network First — intentar servidor, NUNCA cachear
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request).catch(() => offlineResponse()));
    return;
  }

  // Navegación y assets: Network First con fallback a cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Solo cachear respuestas exitosas y del mismo origen
        if (response.ok && url.origin === self.location.origin) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, cloned);
          });
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        // Si es navegación, devolver la app shell
        if (request.mode === "navigate") {
          const shell = await caches.match("/auth/login");
          return shell || offlineResponse();
        }
        return offlineResponse();
      })
  );
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function offlineResponse() {
  return new Response("Sin conexión — intentá de nuevo cuando tengas internet", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

// ─── Mensajes ────────────────────────────────────────────────────────────────

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
