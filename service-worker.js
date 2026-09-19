const CACHE_NAME = "padel-players-morvedre-v131";

// Solo recursos estÃ¡ticos seguros para uso offline. El HTML, JavaScript, CSS y
// las peticiones de Firebase deben ir siempre a red para evitar mezclar
// versiones distintas de la aplicaciÃ³n.
const STATIC_ASSETS = [
  "./logo.png",
  "./icon-192-v2.png",
  "./icon-512-v2.png",
  "./maskable-192-v2.png",
  "./maskable-512-v2.png"
];

self.addEventListener("install", function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(STATIC_ASSETS);
      })
      .catch(function(error) {
        console.warn("No se pudo completar la precachÃ© estÃ¡tica:", error);
      })

  );
});

self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys()
      .then(function(keys) {
        return Promise.all(keys.map(function(key) {
          if (key !== CACHE_NAME) return caches.delete(key);
          return null;
        }));
      })
      .then(function() {
        return self.clients.claim();
      })
  );
});


self.addEventListener("message", function(event) {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", function(event) {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Nunca interceptar recursos externos (Firebase, gstatic, APIs, etc.).
  if (url.origin !== self.location.origin) return;

  // Nunca interceptar navegaciÃ³n ni recursos de cÃ³digo/configuraciÃ³n.
  // AsÃ­ cada carga obtiene una versiÃ³n coherente directamente de GitHub Pages.
  const esNavegacion =
    event.request.mode === "navigate" ||
    event.request.destination === "document" ||
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html");

  if (
    esNavegacion ||
    ["script", "style", "worker", "manifest"].includes(event.request.destination) ||
    url.pathname.endsWith("/service-worker.js")
  ) {
    return;
  }

  // Solo imÃ¡genes y fuentes locales: cachÃ© primero, red como respaldo y
  // actualizaciÃ³n de cachÃ© cuando la descarga es correcta.
  if (["image", "font"].includes(event.request.destination)) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        if (cached) return cached;

        return fetch(event.request).then(function(response) {
          if (response && response.ok) {
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, response.clone()).catch(function() {});
            });
          }
          return response;
        });
      })
    );
  }
});

