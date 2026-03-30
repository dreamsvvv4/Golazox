/**
 * sw.js — GolazOX PWA Service Worker
 *
 * Caching architecture:
 *  - STATIC_CACHE   → Cache-First  : CSS, JS, fonts, logo, manifest
 *  - DYNAMIC_CACHE  → Network-First: API responses (/catalog, /lookup…)
 *  - IMAGE_CACHE    → Cache-First  : badges, flags, stadium images
 *
 * Bump CACHE_VERSION to invalidate ALL caches on next deploy.
 */

const CACHE_VERSION  = 'v23';
const STATIC_CACHE   = `golazox-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE  = `golazox-dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE    = `golazox-images-${CACHE_VERSION}`;
const ALL_CACHES     = [STATIC_CACHE, DYNAMIC_CACHE, IMAGE_CACHE];

// Critical assets to pre-cache during SW install.
// These make the app usable immediately on the next visit, even offline.
const PRECACHE_ASSETS = [
  '/',
  '/style.css',
  '/app.js',
  '/player_ratings.js',
  '/manifest.json',
  '/golazox-logo.png',
  '/golazox-coin.png',
  '/golazox-wordmark.png',
  '/fonts/rajdhani-500.woff2',
  '/fonts/rajdhani-600.woff2',
  '/fonts/rajdhani-700.woff2',
];

// ── Install ───────────────────────────────────────────────────────────────────
// Precache critical assets; skipWaiting() so the new SW activates immediately
// without waiting for all tabs to close.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Precache failed (non-fatal):', err))
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────
// Delete any stale caches from previous versions, then immediately claim
// all open clients so the new SW takes effect without a page reload.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => !ALL_CACHES.includes(k))
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only intercept same-origin GET requests.
  // POST (/simulate) is network-only — we never cache simulation results.
  if (url.origin !== self.location.origin) return;
  if (request.method !== 'GET') return;

  const p = url.pathname;

  // ── Images: badges, flags, stadium photos ─────────────────────────────────
  // Cache-First with fallback fetch → images are large and change rarely.
  if (p.startsWith('/img/') || p.endsWith('.png') || p.endsWith('.jpg')
      || p.endsWith('.svg') || p.endsWith('.webp')) {
    event.respondWith(_cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // ── Fonts & immutable static assets ───────────────────────────────────────
  if (p.startsWith('/fonts/')) {
    event.respondWith(_cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ── player_ratings.js, manifest.json, config.js ───────────────────────────
  if (p === '/player_ratings.js' || p === '/manifest.json' || p === '/config.js') {
    event.respondWith(_staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // ── app.js, style.css ─────────────────────────────────────────────────────
  // If the URL has a version query (?v=49) treat it as network-only so the
  // browser ALWAYS gets the exact versioned file from the server — never
  // from cache. Versioned assets are immutable: a new version = new URL.
  if (p === '/app.js' || p === '/style.css') {
    if (url.search) {
      // Has ?v=... → always fetch fresh, never cache
      event.respondWith(fetch(request).catch(() => caches.match(request)));
      return;
    }
    // No query string (direct /app.js) → Network-First with cache fallback
    event.respondWith(_networkFirst(request, STATIC_CACHE));
    return;
  }

  // ── Catalog API (/catalog, /squads by slug) ───────────────────────────────
  // Network-First: fresh data when online; cached fallback when offline.
  if (p === '/catalog' || p.startsWith('/lineup/') || p.startsWith('/lookup')) {
    event.respondWith(_networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  // ── HTML navigation (the single-page app shell) ───────────────────────────
  if (request.headers.get('Accept')?.includes('text/html')) {
    event.respondWith(_networkFirstHtml(request));
    return;
  }

  // ── Default: stale-while-revalidate for everything else ───────────────────
  event.respondWith(_staleWhileRevalidate(request, STATIC_CACHE));
});

// ══ Strategies ════════════════════════════════════════════════════════════════

/**
 * Cache-First: Return cached response if available; otherwise fetch, cache, return.
 * Best for: images, fonts — assets that don't change often.
 */
async function _cacheFirst(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('', { status: 503 });
  }
}

/**
 * Stale-While-Revalidate: Return cached immediately while fetching fresh version.
 * Best for: CSS, JS, versioned assets — user gets speed; fresh on next load.
 */
async function _staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  // Do NOT use ignoreSearch — versioned URLs (style.css?v=22) must bypass old cache
  const cached = await cache.match(request);

  // Always fire the network request in the background regardless of cache hit
  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  // Return cached immediately if available; wait for network only when cold
  return cached ?? (await fetchPromise) ?? new Response('', { status: 503 });
}

/**
 * Network-First: Try network; fall back to cache on failure.
 * Best for: API endpoints — fresh data when possible; cached when offline.
 */
async function _networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Return a structured offline error so the UI can show a message
    return new Response(
      JSON.stringify({ error: 'offline', message: 'Sin conexión — mostrando datos en caché.' }),
      { status: 503, headers: { 'Content-Type': 'application/json', 'X-SW-Offline': '1' } }
    );
  }
}

/**
 * Network-First for HTML navigation with app-shell fallback.
 * Best for: the index.html SPA shell — user always gets the latest HTML;
 * offline falls back to the cached shell so the app still opens.
 */
async function _networkFirstHtml(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    // Try the exact URL, then fall back to the root shell
    return (
      (await cache.match(request)) ??
      (await cache.match('/')) ??
      new Response('<h1 style="font-family:sans-serif;color:#fff;background:#0a0f1a;padding:2rem">GolazOX — Sin conexión</h1>',
        { status: 503, headers: { 'Content-Type': 'text/html' } })
    );
  }
}

// ── Message ───────────────────────────────────────────────────────────────────
// Allow pages to trigger skipWaiting() so the new SW takes over immediately
// without forcing a reload (the page posts SKIP_WAITING on updatefound).
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
