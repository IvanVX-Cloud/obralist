// ObraList — Service Worker (funcionar sin internet)
//
// Un service worker es un script que el navegador ejecuta "por detrás" de la página.
// Estrategia "red primero": si hay internet, baja la versión más nueva de cada
// archivo y guarda una copia; si no hay señal (en la obra), usa la copia guardada.
// Así ya no hace falta cambiar VERSION cada vez que editas algo; sólo cuando
// agregues o quites archivos de la lista ARCHIVOS.
const VERSION = "obralist-v15";

// Ojo: no ponemos "./index.html" porque Netlify lo redirige a "./" y una
// respuesta redirigida en caché puede romper la app sin internet.
const ARCHIVOS = [
  "./",
  "./styles.css",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./js/app.js",
  "./js/datos.js",
  "./js/ui.js",
  "./js/instalar.js",
  "./js/config.js",
  "./js/plantillas.js",
  "./js/voz.js",
  "./js/vistas/calculadoras.js",
  "./js/vistas/bitacora.js",
  "./js/iconos.js",
  "./js/fotos.js",
  "./js/nube.js",
  "./js/tipocambio.js",
  "./js/excel.js",
  "./js/excel-datos.js",
  "./js/vistas/listas.js",
  "./js/vistas/catalogo.js",
  "./js/vistas/gastos.js",
  "./js/vistas/mas.js",
];

// 1) "install": guardamos todos los archivos en caché.
self.addEventListener("install", (evento) => {
  evento.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(ARCHIVOS)));
  self.skipWaiting();
});

// 2) "activate": borramos cachés de versiones viejas.
self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((claves) =>
      Promise.all(claves.filter((c) => c !== VERSION).map((c) => caches.delete(c)))
    )
  );
  self.clients.claim();
});

// 3) "fetch": cada petición pasa por aquí.
self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;
  if (peticion.method !== "GET" || new URL(peticion.url).origin !== location.origin) return;
  evento.respondWith(
    fetch(peticion)
      .then((respuesta) => {
        if (respuesta.ok && !respuesta.redirected) {
          const copia = respuesta.clone();
          caches.open(VERSION).then((cache) => cache.put(peticion, copia));
        }
        return respuesta;
      })
      .catch(() =>
        caches.match(peticion, { ignoreSearch: true }).then((r) => r || caches.match("./"))
      )
  );
});
