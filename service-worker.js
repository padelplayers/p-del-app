const CACHE_NAME = "padel-players-morvedre-v42";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=31",
  "./logros.js?v=5",
  "./pwa.js?v=5",
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
  event.respondWith(
    fetch(event.request).catch(function() {
      return caches.match(event.request);
    })
  );
});

self.addEventListener("message", function(event) {
  if (!event.data || event.data.type !== "SKIP_WAITING") return;
  self.skipWaiting();
});
