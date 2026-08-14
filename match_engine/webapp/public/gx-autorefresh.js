/* GolazoX · auto-refresco suave de páginas de contenido (SSR)
   ---------------------------------------------------------------
   Recarga la página para traer los datos frescos que el servidor mantiene
   calientes (clasificaciones, noticias, agenda, valores, estadísticas), pero
   SOLO cuando no molesta: pestaña visible, sin inputs enfocados, sin texto
   seleccionado y con la página cerca del inicio, para no interrumpir la lectura
   ni perder el scroll. Una recarga explícita (location.reload) revalida el
   documento con el servidor, así que siempre se obtiene el HTML fresco.

   Se auto-desactiva si la página ya tiene su propio refrescador no intrusivo
   (p.ej. fichajes con su píldora "actualizado"), para no pisar esa UX. */
(function () {
  'use strict';

  // Páginas que ya gestionan su propia actualización → no forzamos recarga.
  if (document.getElementById('refreshPill')) return;
  if (document.body && document.body.hasAttribute('data-no-autorefresh')) return;

  var REFRESH_MS = 5 * 60 * 1000;   // recarga como muy pronto cada 5 min
  var STALE_MS   = 5 * 60 * 1000;   // al volver a la pestaña si lleva >5 min
  var loadedAt = Date.now();

  function busy() {
    var a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return true;
    if (a && a.isContentEditable) return true;
    var sel = window.getSelection && window.getSelection();
    if (sel && String(sel).length > 0) return true;
    return false;
  }

  function tryRefresh() {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - loadedAt < REFRESH_MS) return;
    if (window.scrollY >= 240) return;   // el usuario está leyendo hacia abajo
    if (busy()) return;
    location.reload();
  }

  setInterval(tryRefresh, 60 * 1000);

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - loadedAt < STALE_MS) return;
    if (window.scrollY >= 800) return;
    if (busy()) return;
    location.reload();
  });
})();
