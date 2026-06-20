const CACHE_NAME = "padel-players-morvedre-v62";
const APP_SHELL = [
  "./styles.css?v=41",
  "./logros.js?v=5",
  "./perfil.js?v=28",
  "./jugadores.js?v=3",
  "./chat.js?v=13",
  "./partidas.js?v=24",
  "./notifications.js?v=10",
  "./estadisticas.js?v=4",
  "./pwa.js?v=22",
  "./app.js?v=17",
  "./logo.png"
];

self.addEventListener("install", function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(APP_SHELL);
    }).catch(function() {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(key) {
        if (key !== CACHE_NAME) return caches.delete(key);
        return null;
      }));
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function(event) {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const esNavegacion =
    event.request.mode === "navigate" ||
    event.request.destination === "document" ||
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html");

  if (esNavegacion) {
    event.respondWith(
      fetch(event.request, { cache: "reload" }).catch(function() {
        return new Response("Sin conexi\u00f3n", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      })
    );
    return;
  }

  if (url.origin === self.location.origin && url.pathname.endsWith("/service-worker.js")) {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }

  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(event.request).catch(function() {
      return caches.match(event.request);
    }));
    return;
  }

  if (["script", "style", "worker", "manifest"].includes(event.request.destination)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return fetch(event.request, { cache: "reload" }).then(function(response) {
          if (response && response.status === 200) {
            cache.put(event.request, response.clone()).catch(function() {});
          }
          return response;
        }).catch(function() {
          return caches.match(event.request).then(function(cached) {
            return cached || new Response("", { status: 504 });
          });
        });
      })
    );
    return;
  }

  if (["image", "font"].includes(event.request.destination)) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        if (cached) return cached;

        return caches.open(CACHE_NAME).then(function(cache) {
          return fetch(event.request).then(function(response) {
            if (response && response.status === 200) {
              cache.put(event.request, response.clone()).catch(function() {});
            }
            return response;
          });
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(function(cache) {
      return fetch(event.request, { cache: "reload" }).then(function(response) {
        if (response && response.status === 200) {
          cache.put(event.request, response.clone()).catch(function() {});
        }
        return response;
      }).catch(function() {
        return caches.match(event.request).then(function(cached) {
          return cached || new Response("", { status: 504 });
        });
      });
    })
  );
});

self.addEventListener("message", function(event) {
  if (!event.data || event.data.type !== "SKIP_WAITING") return;
  self.skipWaiting();
});
