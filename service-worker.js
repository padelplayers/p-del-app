const CACHE_NAME = "padel-players-morvedre-v47";
const APP_SHELL = [
  "./styles.css?v=33",
  "./logros.js?v=5",
  "./chat.js?v=13",
  "./partidas.js?v=23",
  "./pwa.js?v=7",
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
      fetch(event.request, { cache: "no-store" }).catch(function() {
        return caches.match("./index.html");
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(event.request).catch(function() {
      return caches.match(event.request);
    }));
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(function(cache) {
      return fetch(event.request, { cache: "no-cache" }).then(function(response) {
        if (response && response.status === 200) {
          cache.put(event.request, response.clone()).catch(function() {});
        }
        return response;
      }).catch(function() {
        return caches.match(event.request);
      });
    })
  );
});

self.addEventListener("message", function(event) {
  if (!event.data || event.data.type !== "SKIP_WAITING") return;
  self.skipWaiting();
});
