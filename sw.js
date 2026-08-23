const CACHE_NAME = "streaming-runtime-v1";
const OFFLINE_HTML_KEY = "./index.html";

const STATIC_FILES = [
  "./manifest.json",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// Instalamos solo recursos estáticos.
// NO guardamos index.html aquí para evitar versiones antiguas.
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_FILES))
  );

  self.skipWaiting();
});

// Eliminamos cachés antiguos y activamos esta versión inmediatamente.
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;

  // Solo gestionamos peticiones GET.
  if (request.method !== "GET") {
    return;
  }

  // =========================================================
  // HTML / NAVEGACIÓN
  // =========================================================
  // Siempre intentamos cargar primero la versión nueva
  // directamente desde GitHub Pages.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then(async response => {

          // Si la página se ha cargado correctamente,
          // guardamos una copia únicamente para modo offline.
          if (response && response.ok) {
            const cache = await caches.open(CACHE_NAME);

            await cache.put(
              OFFLINE_HTML_KEY,
              response.clone()
            );
          }

          return response;
        })

        // Si no tenemos internet, usamos la última versión
        // que conseguimos cargar correctamente.
        .catch(async () => {
          const cached = await caches.match(OFFLINE_HTML_KEY);

          if (cached) {
            return cached;
          }

          // Si nunca hemos guardado una versión,
          // mostramos una pequeña página offline.
          return new Response(
            `<!doctype html>
            <html lang="es">

            <head>
              <meta charset="utf-8">

              <meta
                name="viewport"
                content="width=device-width,initial-scale=1"
              >

              <meta
                name="theme-color"
                content="#000000"
              >

              <title>Sin conexión</title>

              <style>

                body {
                  margin: 0;
                  min-height: 100vh;

                  display: grid;
                  place-items: center;

                  background: #000;
                  color: #fff;

                  font-family:
                    -apple-system,
                    BlinkMacSystemFont,
                    "Segoe UI",
                    sans-serif;

                  text-align: center;
                  padding: 24px;
                }

                p {
                  color: #999;
                  line-height: 1.5;
                }

              </style>
            </head>

            <body>

              <main>
                <h1>Sin conexión</h1>

                <p>
                  Conéctate a internet para cargar
                  la última versión de Streaming.
                </p>
              </main>

            </body>

            </html>`,
            {
              headers: {
                "Content-Type": "text/html; charset=utf-8"
              }
            }
          );
        })
    );

    return;
  }

  // =========================================================
  // MANIFEST + ICONOS + RECURSOS LOCALES
  // =========================================================

  if (
    new URL(request.url).origin === self.location.origin
  ) {

    event.respondWith(
      caches.match(request)
        .then(cached => {

          // Intentamos actualizar el recurso desde internet.
          const network = fetch(
            request,
            { cache: "no-store" }
          )

          .then(async response => {

            if (
              response &&
              response.ok
            ) {

              const cache =
                await caches.open(CACHE_NAME);

              await cache.put(
                request,
                response.clone()
              );
            }

            return response;
          })

          // Si falla internet,
          // usamos la copia guardada.
          .catch(() => cached);

          // Si ya tenemos una copia,
          // la mostramos inmediatamente.
          return cached || network;
        })
    );
  }
});
